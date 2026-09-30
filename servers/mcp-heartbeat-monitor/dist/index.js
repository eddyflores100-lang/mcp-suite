#!/usr/bin/env node
/**
 * MCP Server: Heartbeat Monitor
 * El agente reporta latidos: detecta congelamientos y sesiones huérfanas
 *
 * Dolor que resuelve: Un agente congelado no falla: simplemente desaparece. Sin heartbeats, nadie nota la muerte silenciosa.
 * Categoría: Observabilidad | Generado por mcp-suite | id: heartbeat-monitor
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
// ——— helpers de respuesta ———
function ok(data) {
    return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg) {
    return { content: [{ type: "text", text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o) { return Object.values(o); }
function __ents(o) { return Object.entries(o); }
// ——— persistencia local: ~/.mcp-suite/heartbeat-monitor/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "heartbeat-monitor");
const STORE_FILE = join(STORE_DIR, "state.json");
const store = {
    load() {
        try {
            return existsSync(STORE_FILE) ? JSON.parse(readFileSync(STORE_FILE, "utf8")) : {};
        }
        catch {
            return {};
        }
    },
    save(data) {
        mkdirSync(STORE_DIR, { recursive: true });
        writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
        return data;
    },
};
const server = new McpServer({ name: "heartbeat-monitor", version: "1.0.0" });
server.tool("beat", "Registra un latido de una unidad de trabajo (agente/bucle). Devuelve si está en riesgo (mucho tiempo sin latir no puede pasar, pero múltiple beats largos sí alertan).", {
    unidad: z.string().describe("Nombre de la unidad (ej: agent-scraper)"),
    fase: z.string().describe("Fase actual del trabajo").optional(),
}, async (args) => {
    const { unidad, fase } = args;
    const st = store.load();
    st.unidades = st.unidades || {};
    const u = st.unidades[unidad] = st.unidades[unidad] || { latidos: [], fases: [] };
    u.latidos.push(new Date().toISOString());
    u.fases.push(fase || "");
    u.latidos = u.latidos.slice(-100);
    u.fases = u.fases.slice(-100);
    store.save(st);
    return ok({ unidad, total_latidos: u.latidos.length, ultimo: u.latidos[u.latidos.length - 1] });
});
server.tool("status", "Estado de todas las unidades: último latido, intervalo medio y alerta si el intervalo creció (posible congelamiento lento).", {
    umbral_factor: z.number().describe("Factor de degradación para alertar").default(3),
}, async (args) => {
    const { umbral_factor } = args;
    const st = store.load();
    const ahora = Date.now();
    const reporte = __ents(st.unidades || {}).map(([nombre, u]) => {
        const latidos = u.latidos || [];
        if (!latidos.length)
            return { nombre, estado: "sin_datos" };
        const ultimo = new Date(latidos[latidos.length - 1]).getTime();
        const intervalos = [];
        for (let i = 1; i < latidos.length; i++)
            intervalos.push(new Date(latidos[i]).getTime() - new Date(latidos[i - 1]).getTime());
        const media = intervalos.length ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length : 0;
        const ultimo_intervalo = intervalos.length ? intervalos[intervalos.length - 1] : 0;
        const silencio_min = Math.round((ahora - ultimo) / 60000);
        return { nombre, ultimo_latido: latidos[latidos.length - 1], silencio_minutos: silencio_min, intervalo_medio_ms: Math.round(media), fase_reciente: (u.fases || []).slice(-3), alerta: media > 0 && ultimo_intervalo > media * (umbral_factor ?? 3) ? "intervalo degradado " + Math.round(ultimo_intervalo / 1000) + "s vs media " + Math.round(media / 1000) + "s" : null };
    });
    return ok({ unidades: reporte });
});
server.tool("health_check", "Verifica que el servidor heartbeat-monitor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "heartbeat-monitor", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[heartbeat-monitor] fatal:", e);
    process.exit(1);
});

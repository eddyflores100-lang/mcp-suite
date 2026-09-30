#!/usr/bin/env node
/**
 * MCP Server: Retro Analyzer
 * Retrospectivas: qué salió bien, qué no y acciones concretas
 *
 * Dolor que resuelve: Sin retros el agente repite los mismos errores: el aprendizaje de la ejecución se pierde.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: retro-analyzer
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
// ——— persistencia local: ~/.mcp-suite/retro-analyzer/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "retro-analyzer");
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
const server = new McpServer({ name: "retro-analyzer", version: "1.0.0" });
server.tool("log_event", "Registra un evento de la ejecución para la retrospectiva: tipo (logro/fallo/bloqueo/sorpresa) y detalle.", {
    tipo: z.enum(["logro", "fallo", "bloqueo", "sorpresa"]).describe("Tipo de evento"),
    detalle: z.string().describe("Qué pasó"),
    causa: z.string().describe("Causa raíz (para fallos)").optional(),
}, async (args) => {
    const { tipo, detalle, causa } = args;
    const st = store.load();
    st.eventos = st.eventos || [];
    st.eventos.push({ tipo, detalle, causa: causa || "", ts: new Date().toISOString() });
    store.save(st);
    return ok({ total_eventos: st.eventos.length });
});
server.tool("analyze", "Genera la retrospectiva: patrones por tipo de evento, causas recurrentes y acciones concretas priorizadas.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const evs = st.eventos || [];
    if (!evs.length)
        return fail("sin eventos: log_event primero");
    const conteo = {};
    for (const e of evs)
        conteo[e.tipo] = (conteo[e.tipo] || 0) + 1;
    const causas = {};
    for (const e of evs.filter((e) => e.causa))
        causas[e.causa] = (causas[e.causa] || 0) + 1;
    const causas_top = __ents(causas).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const acciones = causas_top.map(([causa, n]) => ({ accion: "ataca la causa recurrente: " + causa, prioridad: n >= 2 ? "alta" : "media", apariciones: n }));
    return ok({ eventos: evs.length, resumen: conteo, causas_recurrentes: causas_top, acciones, keep: evs.filter((e) => e.tipo === "logro").slice(0, 3).map((e) => e.detalle), drop: evs.filter((e) => e.tipo === "bloqueo" || e.tipo === "fallo").slice(0, 3).map((e) => e.detalle) });
});
server.tool("health_check", "Verifica que el servidor retro-analyzer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "retro-analyzer", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[retro-analyzer] fatal:", e);
    process.exit(1);
});

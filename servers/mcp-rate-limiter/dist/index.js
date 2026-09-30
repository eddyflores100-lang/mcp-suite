#!/usr/bin/env node
/**
 * MCP Server: Rate Limiter
 * Límite de llamadas por ventana deslizante: respeta cuotas de APIs
 *
 * Dolor que resuelve: Las APIs te tiran 429 y bannean: el agente necesita respetar rate limits por servicio sin pensarlo.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: rate-limiter
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
// ——— persistencia local: ~/.mcp-suite/rate-limiter/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "rate-limiter");
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
const server = new McpServer({ name: "rate-limiter", version: "1.0.0" });
server.tool("configure", "Configura el límite de un servicio: N llamadas por ventana (ms).", {
    servicio: z.string().describe("Servicio/API"),
    max_llamadas: z.number().describe("Máx llamadas"),
    ventana_ms: z.number().describe("Ventana en ms").default(60000),
}, async (args) => {
    const { servicio, max_llamadas, ventana_ms } = args;
    const st = store.load();
    st.limits = st.limits || {};
    st.limits[servicio] = { max: max_llamadas, ventana: ventana_ms ?? 60000, llamadas: [] };
    store.save(st);
    return ok({ servicio, limite: max_llamadas + "/" + (ventana_ms ?? 60000) + "ms" });
});
server.tool("acquire", "Pide un slot: devuelve permitido=true y cuánto esperar si no (ventana deslizante real).", {
    servicio: z.string().describe("Servicio"),
}, async (args) => {
    const { servicio } = args;
    const st = store.load();
    const cfg = st.limits?.[servicio];
    if (!cfg)
        return ok({ servicio, permitido: true, razon: "sin límite configurado" });
    const ahora = Date.now();
    cfg.llamadas = (cfg.llamadas || []).filter((t) => ahora - t < cfg.ventana);
    if (cfg.llamadas.length >= cfg.max) {
        const esperar = cfg.ventana - (ahora - cfg.llamadas[0]);
        store.save(st);
        return ok({ servicio, permitido: false, esperar_ms: esperar, en_ventana: cfg.llamadas.length });
    }
    cfg.llamadas.push(ahora);
    store.save(st);
    return ok({ servicio, permitido: true, restantes: cfg.max - cfg.llamadas.length });
});
server.tool("status", "Estado actual de uso de todos los límites configurados.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ahora = Date.now();
    const estado = __ents(st.limits || {}).map(([servicio, c]) => {
        const activas = (c.llamadas || []).filter((t) => ahora - t < c.ventana).length;
        return { servicio, uso: activas + "/" + c.max, ventana_ms: c.ventana };
    });
    return ok({ limites: estado });
});
server.tool("health_check", "Verifica que el servidor rate-limiter está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "rate-limiter", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[rate-limiter] fatal:", e);
    process.exit(1);
});

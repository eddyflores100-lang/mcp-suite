#!/usr/bin/env node
/**
 * MCP Server: Latency Tracker
 * Latencias por tool y paso: p50/p95/p99 para encontrar los cuellos de botella
 *
 * Dolor que resuelve: El agente tarda pero nadie sabe dónde: sin latencias por paso, la optimización es adivinanza.
 * Categoría: Observabilidad | Generado por mcp-suite | id: latency-tracker
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
// ——— persistencia local: ~/.mcp-suite/latency-tracker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "latency-tracker");
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
const server = new McpServer({ name: "latency-tracker", version: "1.0.0" });
server.tool("start", "Inicia un timer para una operación. Devuelve el timer_id.", {
    operacion: z.string().describe("Nombre de la operación"),
}, async (args) => {
    const { operacion } = args;
    const st = store.load();
    st.timers = st.timers || {};
    const id = "t-" + Math.random().toString(36).slice(2, 9);
    st.timers[id] = { operacion, inicio: Date.now() };
    store.save(st);
    return ok({ timer_id: id, operacion });
});
server.tool("end", "Termina el timer y registra la duración en el historial de la operación.", {
    timer_id: z.string().describe("ID del timer"),
}, async (args) => {
    const { timer_id } = args;
    const st = store.load();
    const t = st.timers?.[timer_id];
    if (!t)
        return fail("timer no existe");
    delete st.timers[timer_id];
    const ms = Date.now() - t.inicio;
    st.latencias = st.latencias || {};
    st.latencias[t.operacion] = (st.latencias[t.operacion] || []).concat(ms).slice(-200);
    store.save(st);
    return ok({ operacion: t.operacion, duracion_ms: ms });
});
server.tool("percentiles", "Percentiles p50/p95/p99 por operación + ranking de operaciones más lentas.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const resultado = [];
    for (const [op, vals] of __ents(st.latencias || {})) {
        const v = vals.slice().sort((a, b) => a - b);
        const pct = (p) => v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
        resultado.push({ operacion: op, n: v.length, p50: pct(50), p95: pct(95), p99: pct(99), media: Math.round(v.reduce((a, b) => a + b, 0) / v.length) });
    }
    resultado.sort((a, b) => b.p95 - a.p95);
    return ok({ operaciones: resultado, mas_lenta_p95: resultado[0]?.operacion || null });
});
server.tool("health_check", "Verifica que el servidor latency-tracker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "latency-tracker", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[latency-tracker] fatal:", e);
    process.exit(1);
});

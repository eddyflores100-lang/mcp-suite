#!/usr/bin/env node
/**
 * MCP Server: Metrics Collector
 * Contadores, medidores e histogramas: las métricas del agente en local
 *
 * Dolor que resuelve: Sin métricas no hay forma de saber qué tools se usan ni cuánto tardan: tuning a ciegas.
 * Categoría: Observabilidad | Generado por mcp-suite | id: metrics-collector
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
// ——— persistencia local: ~/.mcp-suite/metrics-collector/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "metrics-collector");
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
const server = new McpServer({ name: "metrics-collector", version: "1.0.0" });
server.tool("incr", "Incrementa un contador (ej: llamadas a tool X, errores de tipo Y).", {
    metrica: z.string().describe("Nombre del contador"),
    delta: z.number().describe("Incremento").default(1),
    etiquetas: z.any().describe("Etiquetas {tool, servidor...}").optional(),
}, async (args) => {
    const { metrica, delta, etiquetas } = args;
    const st = store.load();
    st.contadores = st.contadores || {};
    st.contadores[metrica] = (st.contadores[metrica] || 0) + (delta ?? 1);
    store.save(st);
    return ok({ metrica, valor: st.contadores[metrica] });
});
server.tool("observe", "Observa un valor (duración ms, tamaño bytes): guarda las últimas mediciones y calcula estadísticas.", {
    metrica: z.string().describe("Nombre"),
    valor: z.number().describe("Valor observado"),
}, async (args) => {
    const { metrica, valor } = args;
    const st = store.load();
    st.mediciones = st.mediciones || {};
    st.mediciones[metrica] = (st.mediciones[metrica] || []).concat(valor).slice(-200);
    store.save(st);
    return ok({ metrica, ultima: valor });
});
server.tool("snapshot", "Snapshot de todas las métricas: contadores y estadísticas de mediciones (media, p50, p95, máx).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const stats = (vals) => {
        if (!vals.length)
            return null;
        const sorted = [...vals].sort((a, b) => a - b);
        const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
        return { n: vals.length, media: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), p50: pct(50), p95: pct(95), max: sorted[sorted.length - 1] };
    };
    return ok({ contadores: st.contadores || {}, mediciones: Object.fromEntries(__ents(st.mediciones || {}).map(([k, v]) => [k, stats(v)])) });
});
server.tool("health_check", "Verifica que el servidor metrics-collector está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "metrics-collector", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[metrics-collector] fatal:", e);
    process.exit(1);
});

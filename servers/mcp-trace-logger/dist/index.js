#!/usr/bin/env node
/**
 * MCP Server: Trace Logger
 * Logs estructurados con niveles y correlación por trace-id
 *
 * Dolor que resuelve: console.log plano sin niveles ni correlación: imposible reconstruir una ejecución fallida.
 * Categoría: Observabilidad | Generado por mcp-suite | id: trace-logger
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
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
// ——— persistencia local: ~/.mcp-suite/trace-logger/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "trace-logger");
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
const server = new McpServer({ name: "trace-logger", version: "1.0.0" });
server.tool("log", "Registra un log estructurado: nivel (debug/info/warn/error), mensaje, trace_id y datos JSON.", {
    nivel: z.enum(["debug", "info", "warn", "error"]).describe("Nivel"),
    mensaje: z.string().describe("Mensaje"),
    trace_id: z.string().describe("ID de correlación").optional(),
    datos: z.any().describe("Datos estructurados").optional(),
}, async (args) => {
    const { nivel, mensaje, trace_id, datos } = args;
    const st = store.load();
    st.logs = st.logs || [];
    const entry = { ts: new Date().toISOString(), nivel, mensaje, trace: trace_id || null, datos: datos ?? null };
    st.logs.push(entry);
    if (st.logs.length > 3000)
        st.logs = st.logs.slice(-3000);
    store.save(st);
    return ok({ registrado: true, total: st.logs.length });
});
server.tool("tail", "Devuelve los últimos N logs, filtrables por nivel y trace_id.", {
    nivel: z.enum(["debug", "info", "warn", "error"]).describe("Filtrar nivel").optional(),
    trace_id: z.string().describe("Filtrar por trace").optional(),
    n: z.number().describe("Cuántos").default(30),
}, async (args) => {
    const { nivel, trace_id, n } = args;
    const st = store.load();
    let logs = st.logs || [];
    if (nivel)
        logs = logs.filter((l) => l.nivel === nivel);
    if (trace_id)
        logs = logs.filter((l) => l.trace === trace_id);
    return ok({ total_logs: logs.length, logs: logs.slice(-(n ?? 30)).reverse() });
});
server.tool("search", "Busca logs por texto en mensaje (con ventana de horas opcional).", {
    texto: z.string().describe("Texto a buscar"),
    horas: z.number().describe("Últimas N horas").optional(),
}, async (args) => {
    const { texto, horas } = args;
    const st = store.load();
    let logs = st.logs || [];
    if (horas) {
        const desde = Date.now() - horas * 3600000;
        logs = logs.filter((l) => new Date(l.ts).getTime() >= desde);
    }
    const t = texto.toLowerCase();
    const found = logs.filter((l) => String(l.mensaje).toLowerCase().includes(t));
    return ok({ encontrados: found.length, logs: found.slice(-50).reverse() });
});
server.tool("new_trace", "Genera un nuevo trace-id para correlacionar una ejecución completa.", {
    etiqueta: z.string().describe("Etiqueta del trace").optional(),
}, async (args) => {
    const { etiqueta } = args;
    const id = randomBytes(8).toString("hex");
    return ok({ trace_id: id, etiqueta: etiqueta || "", ts: new Date().toISOString(), uso: "pasa este trace_id a cada log/log de la ejecución" });
});
server.tool("health_check", "Verifica que el servidor trace-logger está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "trace-logger", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[trace-logger] fatal:", e);
    process.exit(1);
});

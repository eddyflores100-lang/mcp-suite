#!/usr/bin/env node
/**
 * MCP Server: Scratchpad
 * Pizarra temporal por tarea: lo que el agente piensa sin ensuciar el contexto
 *
 * Dolor que resuelve: El agente mezcla razonamiento intermedio con contexto durable: necesita una pizarra de trabajo desechable y aislada por tarea.
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: scratchpad
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
// ——— persistencia local: ~/.mcp-suite/scratchpad/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "scratchpad");
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
const server = new McpServer({ name: "scratchpad", version: "1.0.0" });
server.tool("write", "Escribe en la pizarra de la tarea activa (anexar o reemplazar por etiqueta).", {
    etiqueta: z.string().describe("Etiqueta de la nota (ej: hipotesis-1)"),
    contenido: z.string().describe("Contenido"),
    tarea: z.string().describe("Tarea activa").default("default"),
}, async (args) => {
    const { etiqueta, contenido, tarea } = args;
    const st = store.load();
    const t = tarea || "default";
    st[t] = st[t] || {};
    st[t][etiqueta] = { contenido, ts: new Date().toISOString() };
    store.save(st);
    return ok({ tarea: t, etiqueta, total_notas: Object.keys(st[t]).length });
});
server.tool("read", "Lee la pizarra completa de la tarea (o una etiqueta específica).", {
    tarea: z.string().describe("Tarea").default("default"),
    etiqueta: z.string().describe("Etiqueta específica").optional(),
}, async (args) => {
    const { tarea, etiqueta } = args;
    const st = store.load();
    const t = tarea || "default";
    const notas = st[t] || {};
    if (etiqueta)
        return ok(notas[etiqueta] ? { etiqueta, ...notas[etiqueta] } : { etiqueta, contenido: null });
    return ok({ tarea: t, notas });
});
server.tool("clear", "Limpia la pizarra de una tarea (el razonamiento intermedio no debe persistir).", {
    tarea: z.string().describe("Tarea a limpiar").default("default"),
}, async (args) => {
    const { tarea } = args;
    const st = store.load();
    delete st[tarea || "default"];
    store.save(st);
    return ok({ limpiada: tarea || "default" });
});
server.tool("list_tasks", "Lista las tareas con pizarra activa y cuántas notas tienen cada una.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const tareas = __ents(st).map(([t, v]) => ({ tarea: t, notas: Object.keys(v || {}).length }));
    return ok({ tareas });
});
server.tool("health_check", "Verifica que el servidor scratchpad está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "scratchpad", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[scratchpad] fatal:", e);
    process.exit(1);
});

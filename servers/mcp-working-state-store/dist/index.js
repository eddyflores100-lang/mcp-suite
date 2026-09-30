#!/usr/bin/env node
/**
 * MCP Server: Working State Store
 * Estado de trabajo versionado con historial: checkpoints del agente
 *
 * Dolor que resuelve: El estado intermedio de una tarea se pierde en un crash: sin checkpoints, el agente vuelve a empezar.
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: working-state-store
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
// ——— persistencia local: ~/.mcp-suite/working-state-store/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "working-state-store");
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
const server = new McpServer({ name: "working-state-store", version: "1.0.0" });
server.tool("save_state", "Guarda el estado actual de una tarea como nueva versión (checkpoint numerado).", {
    tarea: z.string().describe("Nombre de la tarea"),
    estado: z.any().describe("Estado (JSON)"),
    nota: z.string().describe("Nota del checkpoint").optional(),
}, async (args) => {
    const { tarea, estado, nota } = args;
    const st = store.load();
    st[tarea] = st[tarea] || { versiones: [] };
    st[tarea].versiones.push({ n: st[tarea].versiones.length + 1, estado, nota: nota || "", ts: new Date().toISOString() });
    if (st[tarea].versiones.length > 50)
        st[tarea].versiones = st[tarea].versiones.slice(-50);
    store.save(st);
    return ok({ tarea, version: st[tarea].versiones.length, total: st[tarea].versiones.length });
});
server.tool("load_state", "Carga la última versión del estado de una tarea (o una versión específica).", {
    tarea: z.string().describe("Tarea"),
    version: z.number().describe("Versión específica").optional(),
}, async (args) => {
    const { tarea, version } = args;
    const st = store.load();
    const t = st[tarea];
    if (!t?.versiones?.length)
        return fail("sin estado guardado para esa tarea");
    const v = version ? t.versiones.find((x) => x.n === version) : t.versiones[t.versiones.length - 1];
    if (!v)
        return fail("versión no existe");
    return ok({ tarea, version: v.n, nota: v.nota, guardada: v.ts, estado: v.estado });
});
server.tool("diff_versions", "Compara dos versiones del estado de una tarea: claves añadidas, eliminadas y cambiadas.", {
    tarea: z.string().describe("Tarea"),
    v1: z.number().describe("Versión base"),
    v2: z.number().describe("Versión a comparar"),
}, async (args) => {
    const { tarea, v1, v2 } = args;
    const st = store.load();
    const t = st[tarea];
    if (!t?.versiones?.length)
        return fail("sin versiones");
    const a = t.versiones.find((x) => x.n === v1)?.estado || {};
    const b = t.versiones.find((x) => x.n === v2)?.estado || {};
    const ka = new Set(Object.keys(a));
    const kb = new Set(Object.keys(b));
    const añadidas = [...kb].filter((k) => !ka.has(k));
    const eliminadas = [...ka].filter((k) => !kb.has(k));
    const cambiadas = [...ka].filter((k) => kb.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    return ok({ tarea, v1, v2, añadidas, eliminadas, cambiadas });
});
server.tool("health_check", "Verifica que el servidor working-state-store está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "working-state-store", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[working-state-store] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Session Recall
 * Contexto de sesión: guarda al cerrar, restaura al abrir
 *
 * Dolor que resuelve: Cada sesión nueva pierde el hilo: el agente necesita guardar un resumen de contexto al cerrar y restaurarlo al abrir.
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: session-recall
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
// ——— persistencia local: ~/.mcp-suite/session-recall/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "session-recall");
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
const server = new McpServer({ name: "session-recall", version: "1.0.0" });
server.tool("save_context", "Guarda el contexto de cierre de sesión: objetivo actual, estado, próximos pasos y claves de memoria a restaurar.", {
    objetivo: z.string().describe("Objetivo de la sesión"),
    estado_actual: z.string().describe("Dónde quedaste"),
    proximos_pasos: z.array(z.any()).describe("Próximos pasos"),
    claves: z.array(z.any()).describe("Claves de memoria relevantes").optional(),
}, async (args) => {
    const { objetivo, estado_actual, proximos_pasos, claves } = args;
    const st = store.load();
    st.sesiones = st.sesiones || [];
    st.sesiones.push({ cerrada: new Date().toISOString(), objetivo, estado_actual, proximos_pasos: Array.isArray(proximos_pasos) ? proximos_pasos : [], claves: Array.isArray(claves) ? claves : [] });
    store.save(st);
    return ok({ sesiones_guardadas: st.sesiones.length });
});
server.tool("restore_last", "Restaura el contexto de la última sesión guardada: objetivo, estado y próximos pasos listos para continuar.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    if (!st.sesiones?.length)
        return fail("sin sesiones guardadas");
    const s = st.sesiones[st.sesiones.length - 1];
    return ok({ ...s, hace: Math.round((Date.now() - new Date(s.cerrada).getTime()) / 60000) + " minutos", claves_a_recover: s.claves });
});
server.tool("list_sessions", "Lista las sesiones guardadas (objetivo y fecha) para elegir cuál restaurar.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    return ok({ sesiones: (st.sesiones || []).map((s, i) => ({ i, cerrada: s.cerrada, objetivo: s.objetivo })) });
});
server.tool("health_check", "Verifica que el servidor session-recall está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "session-recall", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[session-recall] fatal:", e);
    process.exit(1);
});

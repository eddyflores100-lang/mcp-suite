#!/usr/bin/env node
/**
 * MCP Server: Idempotency Guard
 * Claves de idempotencia: la misma operación nunca se ejecuta dos veces
 *
 * Dolor que resuelve: Los reintentos duplican efectos (cobros, emails, registros): falta control de idempotencia estilo header Idempotency-Key.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: idempotency-guard
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
// ——— persistencia local: ~/.mcp-suite/idempotency-guard/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "idempotency-guard");
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
const server = new McpServer({ name: "idempotency-guard", version: "1.0.0" });
server.tool("check_or_set", "Antes de ejecutar: verifica si la clave ya se usó (devuelve el resultado previo) o la registra como usada.", {
    clave: z.string().describe("Clave de idempotencia única de la operación"),
    resultado: z.string().describe("Resultado a memoizar (opcional, para devolver en duplicados)").optional(),
}, async (args) => {
    const { clave, resultado } = args;
    const st = store.load();
    st.usadas = st.usadas || {};
    if (st.usadas[clave])
        return ok({ ya_ejecutada: true, resultado_previo: st.usadas[clave].resultado || null, ejecutada: st.usadas[clave].ts });
    st.usadas[clave] = { ts: new Date().toISOString(), resultado: resultado || null };
    store.save(st);
    return ok({ ya_ejecutada: false, accion: "procede a ejecutar" });
});
server.tool("stats", "Cuántas claves registradas y cuántas colisiones (duplicados evitados) hasta ahora.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    return ok({ claves_registradas: Object.keys(st.usadas || {}).length });
});
server.tool("health_check", "Verifica que el servidor idempotency-guard está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "idempotency-guard", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[idempotency-guard] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Agent Memory
 * Memoria KV persistente entre sesiones con TTL y namespaces
 *
 * Dolor que resuelve: Los agentes amnésicos olvidan todo al cerrar la sesión: cada conversación empieza de cero.
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: agent-memory
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
// ——— persistencia local: ~/.mcp-suite/agent-memory/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "agent-memory");
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
const server = new McpServer({ name: "agent-memory", version: "1.0.0" });
server.tool("remember", "Guarda un valor bajo una clave (con namespace y TTL opcional). Persiste entre sesiones.", {
    clave: z.string().describe("Clave única"),
    valor: z.string().describe("Valor a recordar"),
    namespace: z.string().describe("Namespace (ej: proyecto-x)").default("default"),
    ttl_segundos: z.number().describe("TTL: expira tras N segundos").optional(),
}, async (args) => {
    const { clave, valor, namespace, ttl_segundos } = args;
    const st = store.load();
    const ns = namespace || "default";
    st[ns] = st[ns] || {};
    st[ns][clave] = { v: valor, ts: new Date().toISOString(), exp: ttl_segundos ? new Date(Date.now() + ttl_segundos * 1000).toISOString() : null };
    store.save(st);
    return ok({ guardado: true, clave, namespace: ns, expira: st[ns][clave].exp });
});
server.tool("recall", "Recupera el valor de una clave (respetando TTL: devuelve null si expiró).", {
    clave: z.string().describe("Clave a recuperar"),
    namespace: z.string().describe("Namespace").default("default"),
}, async (args) => {
    const { clave, namespace } = args;
    const st = store.load();
    const ns = namespace || "default";
    const item = st[ns]?.[clave];
    if (!item)
        return ok({ clave, valor: null, razon: "no existe" });
    if (item.exp && new Date(item.exp) < new Date()) {
        delete st[ns][clave];
        store.save(st);
        return ok({ clave, valor: null, razon: "expirada" });
    }
    return ok({ clave, valor: item.v, guardada: item.ts });
});
server.tool("list_keys", "Lista las claves guardadas en un namespace (con timestamps y expiración).", {
    namespace: z.string().describe("Namespace").default("default"),
    prefijo: z.string().describe("Filtrar por prefijo").optional(),
}, async (args) => {
    const { namespace, prefijo } = args;
    const st = store.load();
    const ns = namespace || "default";
    let claves = __ents(st[ns] || {});
    if (prefijo)
        claves = claves.filter(([k]) => k.startsWith(prefijo));
    return ok({ namespace: ns, total: claves.length, claves: claves.map(([k, v]) => ({ clave: k, guardada: v.ts, expira: v.exp })) });
});
server.tool("forget", "Elimina una clave (o todo el namespace con confirmar=true).", {
    clave: z.string().describe("Clave a olvidar").optional(),
    namespace: z.string().describe("Namespace").default("default"),
    confirmar: z.boolean().describe("Borrar namespace completo").default(false),
}, async (args) => {
    const { clave, namespace, confirmar } = args;
    const st = store.load();
    const ns = namespace || "default";
    if (confirmar && !clave) {
        delete st[ns];
        store.save(st);
        return ok({ olvidado: "namespace " + ns });
    }
    if (!clave)
        return fail("necesitas clave o confirmar=true");
    delete (st[ns] || {})[clave];
    store.save(st);
    return ok({ olvidado: clave });
});
server.tool("health_check", "Verifica que el servidor agent-memory está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "agent-memory", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[agent-memory] fatal:", e);
    process.exit(1);
});

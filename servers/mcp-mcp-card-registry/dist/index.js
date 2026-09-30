#!/usr/bin/env node
/**
 * MCP Server: MCP Card Registry
 * Genera y valida MCP server cards (mcp.json / .well-known/mcp.json) para discovery estándar
 *
 * Dolor que resuelve: Cada servidor MCP se describe distinto: la MCP Card (mcp.json) estandariza el discovery pero nadie la genera/valida.
 * Categoría: MarketNow Ops | Generado por mcp-suite | id: mcp-card-registry
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
// ——— persistencia local: ~/.mcp-suite/mcp-card-registry/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "mcp-card-registry");
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
const server = new McpServer({ name: "mcp-card-registry", version: "1.0.0" });
server.tool("generate_card", "Genera una MCP Card para tu servidor: nombre, transporte, tools expuestas, versión y requirements.", {
    nombre: z.string().describe("Nombre del servidor MCP"),
    version: z.string().describe("Versión").default("1.0.0"),
    descripcion: z.string().describe("Descripción").optional(),
    tools: z.array(z.any()).describe("Nombres de tools expuestas"),
    transporte: z.enum(["stdio", "sse", "streamable-http"]).describe("Transporte").default("stdio"),
}, async (args) => {
    const { nombre, version, descripcion, tools, transporte } = args;
    const card = {
        schemaVersion: "1.0",
        name: nombre, version: version || "1.0.0", description: descripcion || "",
        transport: { type: transporte || "stdio" },
        tools: (Array.isArray(tools) ? tools : []).map((t) => ({ name: String(t) })),
        capabilities: { tools: true, resources: false, prompts: false },
        generated: new Date().toISOString(),
    };
    return ok({ card, publicar_en: transporte === "stdio" ? "mcp.json del repo" : ".well-known/mcp.json del dominio" });
});
server.tool("validate_card", "Valida una MCP Card: schema, transporte bien definido, tools con nombre y versiones.", {
    card: z.any().describe("MCP Card a validar"),
}, async (args) => {
    const { card } = args;
    const c = card || {};
    const problemas = [];
    if (!c.name)
        problemas.push("falta name");
    if (!c.transport?.type)
        problemas.push("falta transport.type");
    if (!["stdio", "sse", "streamable-http", "http"].includes(c.transport?.type))
        problemas.push("transport desconocido: " + c.transport?.type);
    if (!Array.isArray(c.tools))
        problemas.push("tools debe ser array");
    if (Array.isArray(c.tools))
        c.tools.forEach((t, i) => { if (!t?.name)
            problemas.push("tool " + i + " sin name"); });
    if (!c.version)
        problemas.push("falta version");
    return ok({ valida: problemas.length === 0, problemas });
});
server.tool("register_locally", "Registra una MCP Card en tu registro local de confianza para consulta futura de otros agentes.", {
    card: z.any().describe("Card a registrar"),
}, async (args) => {
    const { card } = args;
    const st = store.load();
    st.registry = st.registry || [];
    st.registry.push({ registrado: new Date().toISOString(), card });
    store.save(st);
    return ok({ registradas: st.registry.length });
});
server.tool("health_check", "Verifica que el servidor mcp-card-registry está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "mcp-card-registry", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[mcp-card-registry] fatal:", e);
    process.exit(1);
});

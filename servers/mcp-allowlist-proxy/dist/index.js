#!/usr/bin/env node
/**
 * MCP Server: Allowlist Proxy Guard
 * Valida URLs contra allowlist y bloquea SSRF antes de cualquier fetch
 *
 * Dolor que resuelve: Un fetch a http://169.254.169.254/ o a internals exfiltra datos de la nube: SSRF es el riesgo #1 de tools con red.
 * Categoría: Seguridad | Generado por mcp-suite | id: allowlist-proxy
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
// ——— persistencia local: ~/.mcp-suite/allowlist-proxy/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "allowlist-proxy");
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
const server = new McpServer({ name: "allowlist-proxy", version: "1.0.0" });
server.tool("check_url", "Valida una URL: esquema permitido, dominio en allowlist, bloqueo de IPs internas/reservadas (SSRF guard) y puertos peligrosos.", {
    url: z.string().describe("URL a validar"),
}, async (args) => {
    const { url } = args;
    const st = store.load();
    const allowlist = st.allowlist || ["marketnow.site", "example.com", "github.com", "npmjs.org", "registry.npmjs.org", "api.github.com"];
    let u;
    try {
        u = new URL(url);
    }
    catch {
        return fail("URL inválida");
    }
    const problemas = [];
    if (!["http:", "https:"].includes(u.protocol))
        problemas.push("esquema no permitido: " + u.protocol);
    const host = u.hostname.toLowerCase();
    const ipMatch = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
        const [a, b] = [Number(ipMatch[1]), Number(ipMatch[2])];
        if (a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || a >= 224)
            problemas.push("IP interna/reservada (SSRF): " + host);
    }
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal"))
        problemas.push("host interno bloqueado");
    const puertos_peligrosos = ["22", "25", "110", "143", "3306", "5432", "6379", "27017", "9200"];
    if (puertos_peligrosos.includes(u.port))
        problemas.push("puerto sospechoso de servicio interno: " + u.port);
    if (/@/.test(u.href) && !u.username)
        problemas.push("posible URL con credenciales embebidas");
    const en_allowlist = allowlist.some((d) => host === d || host.endsWith("." + d));
    return ok({ url, host, permitida: problemas.length === 0 && en_allowlist, problemas, en_allowlist, allowlist_activa: allowlist });
});
server.tool("set_allowlist", "Define la allowlist de dominios permitidos (reemplaza la actual).", {
    dominios: z.array(z.any()).describe("Lista de dominios permitidos"),
}, async (args) => {
    const { dominios } = args;
    const st = store.load();
    st.allowlist = (Array.isArray(dominios) ? dominios : []).map((d) => String(d).toLowerCase().trim()).filter(Boolean);
    store.save(st);
    return ok({ allowlist: st.allowlist, total: st.allowlist.length });
});
server.tool("health_check", "Verifica que el servidor allowlist-proxy está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "allowlist-proxy", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[allowlist-proxy] fatal:", e);
    process.exit(1);
});

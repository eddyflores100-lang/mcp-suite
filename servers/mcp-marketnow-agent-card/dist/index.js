#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Agent Card
 * Lee la tarjeta machine-readable de marketnow.site y descubre sus capabilities MCP/A2A
 *
 * Dolor que resuelve: Los agentes no saben qué servicios ofrece un sitio ni cómo interactuar con él: falta descubrimiento estandarizado de capabilities.
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-agent-card
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
// ——— fetch inteligente: timeout + reintentos ———
async function fetchSmart(url, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 20000;
    let lastError = null;
    for (let attempt = 0; attempt <= (opts.retries ?? 2); attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                method: opts.method || "GET",
                headers: { "user-agent": "mcp-suite/marketnow-agent-card", ...(opts.headers || {}) },
                body: opts.body,
                signal: ctrl.signal,
            });
            const text = await res.text();
            let json = null;
            try {
                json = JSON.parse(text);
            }
            catch { /* no JSON */ }
            return { status: res.status, text, json };
        }
        catch (e) {
            lastError = e;
            if (attempt < (opts.retries ?? 2))
                await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
        finally {
            clearTimeout(timer);
        }
    }
    throw new Error("fetch falló tras reintentos: " + (lastError?.message || url));
}
const server = new McpServer({ name: "marketnow-agent-card", version: "1.0.0" });
server.tool("get_agent_card", "Descarga en vivo la tarjeta de agente de marketnow.site (GET /api/agent.json): nombre, descripción, versión, URL y capabilities soportadas.", {
// sin parámetros
}, async (args) => {
    const r = await fetchSmart("https://marketnow.site/api/agent.json");
    if (!r.json)
        return fail("respuesta no-JSON (HTTP " + r.status + ")");
    const a = r.json.agent || {};
    return ok({ name: a.name, description: a.description, url: a.url, version: a.version, schema: r.json.schemaVersion, fetched_at: new Date().toISOString() });
});
server.tool("list_remote_mcp_tools", "Lista las herramientas MCP que expone MarketNow remotamente (search_skills, get_skill, get_categories, health) según su agent card, con descripción de cada una.", {
// sin parámetros
}, async (args) => {
    const r = await fetchSmart("https://marketnow.site/api/agent.json");
    if (!r.json)
        return fail("respuesta no-JSON");
    const tools = r.json?.capabilities?.protocols?.mcp?.tools || [];
    return ok({ total: tools.length, endpoints: r.json?.capabilities?.protocols?.mcp?.endpoints || {}, tools });
});
server.tool("get_discovery_endpoints", "Devuelve los endpoints de discovery estándar de marketnow.site: .well-known/mcp.json, .well-known/agent.json, sitemap.xml y robots.txt.", {
// sin parámetros
}, async (args) => {
    const r = await fetchSmart("https://marketnow.site/api/agent.json");
    if (!r.json)
        return fail("respuesta no-JSON");
    const d = r.json?.capabilities?.discovery || {};
    return ok({ well_known: d.wellKnown, sitemap: d.sitemap, robots: d.robots, atc: r.json?.capabilities?.atc });
});
server.tool("check_marketplace_health", "Ping de salud del marketplace: verifica que /api/agent.json responde y devuelve estadísticas básicas del catálogo.", {
// sin parámetros
}, async (args) => {
    const started = Date.now();
    const r = await fetchSmart("https://marketnow.site/api/agent.json", { timeoutMs: 12000 });
    const ms = Date.now() - started;
    return ok({ reachable: r.status === 200, http_status: r.status, latency_ms: ms, ok: r.status === 200 && !!r.json });
});
server.tool("health_check", "Verifica que el servidor marketnow-agent-card está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "marketnow-agent-card", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[marketnow-agent-card] fatal:", e);
    process.exit(1);
});

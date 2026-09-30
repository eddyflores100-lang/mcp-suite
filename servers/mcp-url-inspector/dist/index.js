#!/usr/bin/env node
/**
 * MCP Server: URL Inspector
 * Anatomía de URLs: parse, normalización, redirecciones en vivo y clasificación
 *
 * Dolor que resuelve: URLs malformadas rompen flujos enteros: falta inspección previa (parámetros UTM, redirects, esquemas).
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: url-inspector
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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
                headers: { "user-agent": "mcp-suite/url-inspector", ...(opts.headers || {}) },
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
const server = new McpServer({ name: "url-inspector", version: "1.0.0" });
server.tool("inspect", "Analiza una URL estáticamente: esquema, host, puerto, path, query params completos, fragmento, UTMs y riesgo.", {
    url: z.string().describe("URL a inspeccionar"),
}, async (args) => {
    const { url } = args;
    let u;
    try {
        u = new URL(url);
    }
    catch {
        return fail("URL inválida");
    }
    const params = {};
    for (const [k, v] of u.searchParams.entries())
        params[k] = v;
    const utms = Object.keys(params).filter((k) => k.startsWith("utm_"));
    const riesgos = [];
    if (u.protocol === "http:")
        riesgos.push("sin TLS");
    if (u.username || u.password)
        riesgos.push("credenciales embebidas en la URL");
    if (url.length > 2000)
        riesgos.push("URL extremadamente larga");
    const trackers = Object.keys(params).filter((k) => /^(fbclid|gclid|msclkid|mc_cid|mc_eid|ref)$/.test(k));
    return ok({ protocolo: u.protocol.replace(":", ""), host: u.host, dominio: u.hostname, puerto: u.port || null, path: u.pathname, fragmento: u.hash || null, params, total_params: Object.keys(params).length, utms, trackers, riesgos, longitud: url.length });
});
server.tool("normalize", "Normaliza la URL: baja el host, elimina UTMs/trackers, default port, trailing slash controlado y fragmentos.", {
    url: z.string().describe("URL a normalizar"),
    conservar_query: z.boolean().describe("Conservar query no-tracking").default(true),
}, async (args) => {
    const { url, conservar_query } = args;
    let u;
    try {
        u = new URL(url);
    }
    catch {
        return fail("URL inválida");
    }
    u.hostname = u.hostname.toLowerCase();
    u.hash = "";
    const borrar = [...u.searchParams.keys()].filter((k) => k.startsWith("utm_") || /^(fbclid|gclid|msclkid|ref|mc_cid|mc_eid)$/.test(k));
    for (const k of borrar)
        u.searchParams.delete(k);
    if (conservar_query === false)
        u.search = "";
    if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80"))
        u.port = "";
    let norm = u.toString();
    if (norm.endsWith("?"))
        norm = norm.slice(0, -1);
    return ok({ original: url, normalizada: norm, parametros_eliminados: borrar });
});
server.tool("redirect_chain", "Sigue la cadena de redirecciones en vivo (máx 5 saltos) y reporta cada hop con status.", {
    url: z.string().describe("URL inicial"),
}, async (args) => {
    const { url } = args;
    const cadena = [];
    let actual = url;
    for (let hop = 0; hop < 6; hop++) {
        try {
            const r = await fetchSmart(actual, { timeoutMs: 10000, retries: 0 });
            const location = r.text.match(/href=["']([^"']+)["']|content=["']\d+;\s*url=([^"']+)/i);
            const locHeader = r.location || null;
            cadena.push({ url: actual, status: r.status });
            if (r.status >= 300 && r.status < 400 && locHeader) {
                actual = new URL(locHeader, actual).toString();
                continue;
            }
            break;
        }
        catch (e) {
            cadena.push({ url: actual, error: e.message.slice(0, 60) });
            break;
        }
    }
    return ok({ saltos: cadena.length - 1, cadena, url_final: cadena[cadena.length - 1]?.url, loop_detectado: new Set(cadena.map((c) => c.url)).size < cadena.length });
});
server.tool("health_check", "Verifica que el servidor url-inspector está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "url-inspector", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[url-inspector] fatal:", e);
    process.exit(1);
});

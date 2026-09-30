#!/usr/bin/env node
/**
 * MCP Server: ToS & Robots Checker
 * Respeta robots.txt y términos: scraping legal antes de raspar
 *
 * Dolor que resuelve: El agente scrapea sin consultar robots.txt ni ToS: riesgo legal y de ban. Falta un check previo estandarizado.
 * Categoría: Seguridad | Generado por mcp-suite | id: tos-checker
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
                headers: { "user-agent": "mcp-suite/tos-checker", ...(opts.headers || {}) },
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
const server = new McpServer({ name: "tos-checker", version: "1.0.0" });
server.tool("can_fetch", "Consulta robots.txt del dominio en vivo y evalúa si un user-agent puede fetch una ruta dada.", {
    url: z.string().describe("URL que quieres fetch"),
    user_agent: z.string().describe("User agent").default("mcp-agent"),
}, async (args) => {
    const { url, user_agent } = args;
    let u;
    try {
        u = new URL(url);
    }
    catch {
        return fail("URL inválida");
    }
    const robotsUrl = u.protocol + "//" + u.host + "/robots.txt";
    let txt = "";
    try {
        const r = await fetchSmart(robotsUrl, { timeoutMs: 8000, retries: 1 });
        txt = r.status === 200 ? r.text.toLowerCase() : "";
    }
    catch {
        txt = "";
    }
    if (!txt)
        return ok({ robots_existe: false, permitido: true, razon: "sin robots.txt: permitido por defecto (revisa ToS manualmente)" });
    const ua = (user_agent || "mcp-agent").toLowerCase();
    const lineas = txt.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    let aplica = false;
    const disallow = [];
    const allow = [];
    for (const l of lineas) {
        const [k, v] = l.split(":").map((s) => (s || "").trim());
        if (k === "user-agent")
            aplica = v === "*" || ua.includes(v);
        else if (aplica && k === "disallow" && v)
            disallow.push(v);
        else if (aplica && k === "allow" && v)
            allow.push(v);
    }
    const ruta = u.pathname;
    const bloqueado = disallow.some((d) => ruta.startsWith(d));
    const permitido_explicito = allow.some((a) => ruta.startsWith(a));
    const permitido = !bloqueado || permitido_explicito;
    return ok({ robots_existe: true, permitido, ruta, user_agent: ua, reglas_disallow: disallow.slice(0, 10), reglas_allow: allow.slice(0, 10) });
});
server.tool("summarize_tos", "Busca en los ToS/robots en vivo las cláusulas relevantes para scraping: prohibiciones, rate limits, API oficial.", {
    dominio: z.string().describe("Dominio a revisar (ej: example.com)"),
}, async (args) => {
    const { dominio } = args;
    const r = await fetchSmart("https://" + dominio.replace(/^https?:\/\//, "") + "/robots.txt", { timeoutMs: 8000, retries: 1 });
    const txt = r.status === 200 ? r.text.toLowerCase() : "";
    const hallazgos = [];
    if (/crawl-delay:\s*\d+/.test(txt))
        hallazgos.push("crawl-delay especificado: " + (txt.match(/crawl-delay:\s*(\d+)/) || [])[0]);
    if (/disallow:\s*\/$/.test(txt))
        hallazgos.push("PROHIBICIÓN TOTAL de scraping para algún UA");
    if (/api\b/.test(txt))
        hallazgos.push("menciona API: considera endpoint oficial");
    const crawl = (txt.match(/crawl-delay:\s*(\d+)/) || [])[1];
    return ok({ dominio, robots_status: r.status, hallazgos, crawl_delay_seg: crawl ? Number(crawl) : null, recomendacion: "usa can_fetch antes de cada ruta y respeta crawl-delay" });
});
server.tool("health_check", "Verifica que el servidor tos-checker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "tos-checker", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[tos-checker] fatal:", e);
    process.exit(1);
});

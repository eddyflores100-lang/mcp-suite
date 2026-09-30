#!/usr/bin/env node
/**
 * MCP Server: Citation Checker
 * Extrae, formatea y verifica citas y URLs de cualquier texto
 *
 * Dolor que resuelve: Los LLM inventan URLs y citas (alucinación de fuentes): sin verificación, el usuario propaga información falsa.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: citation-checker
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
                headers: { "user-agent": "mcp-suite/citation-checker", ...(opts.headers || {}) },
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
const server = new McpServer({ name: "citation-checker", version: "1.0.0" });
server.tool("extract_citations", "Extrae todas las URLs y referencias de un texto, las deduplica y las clasifica (http, dominio, markdown link, DOI).", {
    texto: z.string().describe("Texto con posibles citas"),
}, async (args) => {
    const { texto } = args;
    const t = String(texto);
    const encontradas = t.match(/https?:\/\/[^\s)\]<>"]+/g) || [];
    const urls = [...new Set(encontradas)].map((u) => u.replace(/[.,;:]+$/, ""));
    const dominios = [...new Set(t.match(/\b[a-z0-9-]+\.(com|org|net|io|dev|es|ec|edu|gov|co|ai)\b/gi) || [])];
    const dois = [...new Set(t.match(/\b10\.\d{4,}\/[^\s]+/g) || [])];
    return ok({ urls, dominios: dominios.map((d) => d.toLowerCase()), doi: dois, total_referencias: urls.length + dominios.length + dois.length });
});
server.tool("check_urls", "Verifica en vivo (HEAD/GET) si las URLs citadas existen realmente. Devuelve status HTTP por URL.", {
    urls: z.array(z.any()).describe("Lista de URLs a verificar"),
}, async (args) => {
    const { urls } = args;
    const lista = (Array.isArray(urls) ? urls : []).slice(0, 10);
    const resultados = [];
    for (const u of lista) {
        try {
            const r = await fetchSmart(u, { timeoutMs: 10000, retries: 1 });
            resultados.push({ url: u, existe: r.status >= 200 && r.status < 400, http: r.status });
        }
        catch (e) {
            resultados.push({ url: u, existe: false, error: (e.message || "").slice(0, 80) });
        }
    }
    return ok({ verificadas: resultados.length, vivas: resultados.filter((r) => r.existe).length, resultados });
});
server.tool("format_citations", "Formatea una lista de referencias en estilo consistente (APA-lite o markdown) a partir de {titulo, url, fecha}.", {
    referencias: z.array(z.any()).describe("Lista de {titulo, url, fecha?}"),
    estilo: z.enum(["apa", "markdown"]).describe("Estilo").default("markdown"),
}, async (args) => {
    const { referencias, estilo } = args;
    const refs = Array.isArray(referencias) ? referencias : [];
    const out = refs.map((r) => {
        if ((estilo || "markdown") === "apa")
            return r.titulo + (r.fecha ? " (" + r.fecha + ")" : " (s.f.)") + ". " + (r.url || "");
        return "- [" + (r.titulo || "sin título") + "](" + (r.url || "") + ")" + (r.fecha ? " — " + r.fecha : "");
    });
    return ok({ referencias_formateadas: out });
});
server.tool("health_check", "Verifica que el servidor citation-checker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "citation-checker", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[citation-checker] fatal:", e);
    process.exit(1);
});

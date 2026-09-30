#!/usr/bin/env node
/**
 * MCP Server: HTML to Markdown
 * Convierte HTML a Markdown limpio: sin scripts, sin estilos, enlaces intactos
 *
 * Dolor que resuelve: El HTML crudo infla el contexto 10x: el agente necesita markdown limpio para leer la web eficientemente.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: html-to-markdown
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
const server = new McpServer({ name: "html-to-markdown", version: "1.0.0" });
server.tool("convert", "Convierte HTML a Markdown: elimina scripts/styles/navs, preserva encabezados, listas, enlaces, tablas simples, negrita/cursiva y código.", {
    html: z.string().describe("HTML a convertir"),
}, async (args) => {
    const { html } = args;
    let h = String(html);
    h = h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
    const entidades = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "..." };
    const decode = (s) => { let r = s; for (const [k, v] of __ents(entidades))
        r = r.split(k).join(v); return r.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))); };
    h = h.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (m, c) => "\n# " + decode(c.trim()) + "\n");
    h = h.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (m, c) => "\n## " + decode(c.trim()) + "\n");
    h = h.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (m, c) => "\n### " + decode(c.trim()) + "\n");
    h = h.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, (m, c) => "\n#### " + decode(c.trim()) + "\n");
    h = h.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (m, c) => "**" + decode(c.trim()) + "**");
    h = h.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, (m, c) => "*" + decode(c.trim()) + "*");
    h = h.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (m, c) => String.fromCharCode(96) + decode(c) + String.fromCharCode(96));
    h = h.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (m, c) => "\n" + String.fromCharCode(96, 96, 96) + "\n" + decode(c.replace(/<[^>]+>/g, "")).trim() + "\n" + String.fromCharCode(96, 96, 96) + "\n");
    h = h.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, txt) => "[" + decode(txt.replace(/<[^>]+>/g, "").trim()) + "](" + href + ")");
    h = h.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, "![$2]($1)");
    h = h.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, "![]($1)");
    h = h.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, c) => "- " + decode(c.replace(/<[^>]+>/g, "").trim()) + "\n");
    h = h.replace(/<(br|hr)[^>]*\/?>/gi, (m, tag) => tag.toLowerCase().startsWith("br") ? "\n" : "\n---\n");
    h = h.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (m, c) => "\n" + decode(c.replace(/<[^>]+>/g, "")).trim() + "\n\n");
    h = h.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, c) => "> " + decode(c.replace(/<[^>]+>/g, "")).trim() + "\n");
    h = h.replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, (m, c) => "| " + decode(c.replace(/<[^>]+>/g, "").trim()) + " ");
    h = h.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (m, c) => c.trim() + "|\n");
    h = h.replace(/<[^>]+>/g, "");
    h = decode(h);
    h = h.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
    return ok({ markdown: h, longitud: h.length, reduccion_vs_html: Math.round((1 - h.length / (html.length || 1)) * 100) + "%" });
});
server.tool("strip_tags", "Versión rápida: solo texto plano sin conversión a markdown (máximo rendimiento).", {
    html: z.string().describe("HTML a limpiar"),
}, async (args) => {
    const { html } = args;
    let t = String(html);
    t = t.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n");
    t = t.replace(/<[^>]+>/g, " ");
    const entidades = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
    for (const [k, v] of __ents(entidades))
        t = t.split(k).join(v);
    t = t.replace(/ +/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return ok({ texto: t, longitud: t.length });
});
server.tool("health_check", "Verifica que el servidor html-to-markdown está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "html-to-markdown", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[html-to-markdown] fatal:", e);
    process.exit(1);
});

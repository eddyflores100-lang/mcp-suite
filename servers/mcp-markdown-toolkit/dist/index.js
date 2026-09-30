#!/usr/bin/env node
/**
 * MCP Server: Markdown Toolkit
 * TOC, encabezados, enlaces y lint de Markdown
 *
 * Dolor que resuelve: Documentos markdown desordenados: sin TOC ni lint, la doc del agente degrada rápido.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: markdown-toolkit
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
const server = new McpServer({ name: "markdown-toolkit", version: "1.0.0" });
server.tool("toc", "Genera la tabla de contenidos de un markdown: encabezados anidados con anchors válidos.", {
    markdown: z.string().describe("Markdown"),
    max_nivel: z.number().describe("Profundidad máxima").default(3),
}, async (args) => {
    const { markdown, max_nivel } = args;
    const lineas = String(markdown).split("\n");
    const toc = [];
    let enBloque = false;
    for (const l of lineas) {
        if (l.trim().startsWith(String.fromCharCode(96, 96, 96)))
            enBloque = !enBloque;
        if (enBloque)
            continue;
        const m = l.match(/^(#{1,6})\s+(.+)$/);
        if (m) {
            const nivel = m[1].length;
            if (nivel <= (max_nivel ?? 3)) {
                const texto = m[2].trim();
                const anchor = texto.toLowerCase().replace(/[^a-záéíóúñü0-9\s-]/g, "").replace(/\s+/g, "-");
                toc.push({ nivel, texto, anchor, linea: "[#" + texto + "](#" + anchor + ")" });
            }
        }
    }
    const indentado = toc.map((t) => "  ".repeat(t.nivel - 1) + "- " + t.linea).join("\n");
    return ok({ encabezados: toc.length, toc: indentado });
});
server.tool("structure", "Analiza la estructura de un markdown: encabezados por nivel, enlaces, imágenes, bloques de código y conteo de palabras por sección.", {
    markdown: z.string().describe("Markdown"),
}, async (args) => {
    const { markdown } = args;
    const md = String(markdown);
    const encabezados = (md.match(/^#{1,6}\s+.+$/gm) || []).length;
    const h1 = (md.match(/^#\s+.+$/gm) || []).length;
    const enlaces = (md.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
    const enlaces_rotos = (md.match(/\]\(\s*\)|\]\(#\)/g) || []).length;
    const imagenes = (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
    const fence = String.fromCharCode(96, 96, 96);
    const bloques = (md.match(new RegExp("^" + fence, "gm")) || []).length / 2;
    const palabras = md.replace(new RegExp(fence + "[\s\S]*?" + fence, "g"), "").split(/\s+/).filter(Boolean).length;
    const problemas = [];
    if (h1 === 0)
        problemas.push("sin H1 principal");
    if (h1 > 1)
        problemas.push(h1 + " H1: debería haber uno");
    if (encabezados === 0 && palabras > 200)
        problemas.push("documento largo sin encabezados");
    if (enlaces_rotos)
        problemas.push(enlaces_rotos + " enlaces vacíos");
    if (!Number.isInteger(bloques))
        problemas.push("bloques de código sin cerrar");
    if (bloques === 0 && palabras > 100)
        problemas.push("sin ejemplos de código");
    return ok({ encabezados, h1, enlaces, imagenes, bloques_codigo: Math.round(bloques), palabras, problemas, estructura_ok: problemas.length === 0 });
});
server.tool("extract_links", "Extrae todos los enlaces {texto, url} de un markdown, detectando duplicados y anchors internos.", {
    markdown: z.string().describe("Markdown"),
}, async (args) => {
    const { markdown } = args;
    const md = String(markdown);
    const re = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
    const enlaces = [];
    let m;
    while ((m = re.exec(md)) !== null)
        enlaces.push({ texto: m[1], url: m[2], interno: m[2].startsWith("#") });
    const urls = enlaces.map((e) => e.url);
    const duplicados = [...new Set(urls.filter((u, i) => urls.indexOf(u) !== i))];
    return ok({ total: enlaces.length, internos: enlaces.filter((e) => e.interno).length, duplicados, enlaces: enlaces.slice(0, 200) });
});
server.tool("health_check", "Verifica que el servidor markdown-toolkit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "markdown-toolkit", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[markdown-toolkit] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Readability Extract
 * Extrae el contenido principal de una página: título, artículo y metadatos
 *
 * Dolor que resuelve: Del HTML de una noticia el 80% es chrome (menus, footers, ads): leer sin extraer el main quema contexto.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: readability-extract
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
const server = new McpServer({ name: "readability-extract", version: "1.0.0" });
server.tool("extract", "Heurística de legibilidad: detecta el bloque con más densidad de texto (article/main/role) y devuelve título + texto del artículo + metadatos.", {
    html: z.string().describe("HTML de la página"),
}, async (args) => {
    const { html } = args;
    const h = String(html);
    const meta = (name) => { const m = h.match(new RegExp('<meta[^>]+(?:name|property)=["\']' + name + '["\'][^>]+content=["\']([^"\']*)', "i")); return m ? m[1] : null; };
    const titulo = (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || meta("og:title") || "";
    const candidatos = [];
    const tags = ["article", "main", "section", "div"];
    for (const tag of tags) {
        const re = new RegExp("<" + tag + "[^>]*>([\s\S]*?)<\/" + tag + ">", "gi");
        let m;
        while ((m = re.exec(h)) !== null) {
            const texto = m[1].replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
            const palabras = texto.split(/\s+/).filter((w) => w.length > 2).length;
            const enlaces = (m[1].match(/<a[\s]/gi) || []).length;
            const densidad = palabras / (1 + enlaces);
            candidatos.push([m[0], palabras + " palabras, densidad " + Math.round(densidad)]);
        }
    }
    candidatos.sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
    const mejor = candidatos[0]?.[0] || h;
    const texto = mejor.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/ +/g, " ").trim();
    return ok({ titulo, descripcion: meta("description") || meta("og:description"), autor: meta("author"), palabras: texto.split(/\s+/).length, bloques_analizados: candidatos.length, texto: texto.slice(0, 30000) });
});
server.tool("excerpt", "Devuelve un excerpt de N palabras del contenido principal + keywords para decidir si leer más.", {
    html: z.string().describe("HTML"),
    palabras: z.number().describe("Palabras del excerpt").default(60),
}, async (args) => {
    const { html, palabras } = args;
    const h = String(html);
    const body = h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = body.split(" ");
    const freq = {};
    for (const w of words) {
        const k = w.toLowerCase().replace(/[^a-záéíóúñü0-9]/g, "");
        if (k.length > 5)
            freq[k] = (freq[k] || 0) + 1;
    }
    const keywords = __ents(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
    return ok({ excerpt: words.slice(0, palabras ?? 60).join(" "), total_palabras: words.length, keywords });
});
server.tool("health_check", "Verifica que el servidor readability-extract está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "readability-extract", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[readability-extract] fatal:", e);
    process.exit(1);
});

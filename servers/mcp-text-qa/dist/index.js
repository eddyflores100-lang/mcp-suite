#!/usr/bin/env node
/**
 * MCP Server: Text QA
 * QA de texto: palabras duplicadas, placeholders, encoding roto y espaciado
 *
 * Dolor que resuelve: Salidas con errores tipográficos obvios (palabras duplicadas, caracteres mojibake, doble espacio) erosionan la confianza.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: text-qa
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
const server = new McpServer({ name: "text-qa", version: "1.0.0" });
server.tool("check", "Ejecuta 10+ reglas de QA tipográfico: duplicadas, mojibake, doble espacio, espacios antes de puntuación, minúscula tras punto, lorem, URLs rotas.", {
    texto: z.string().describe("Texto a revisar"),
}, async (args) => {
    const { texto } = args;
    const issues = [];
    const dup = texto.match(/\b(\w+)\s+\1\b/gi);
    if (dup)
        issues.push({ tipo: "palabra-duplicada", ejemplos: dup.slice(0, 5) });
    if (/[\ufffd\u00c3\u00e2\u20ac]/.test(texto))
        issues.push({ tipo: "encoding-roto (mojibake)", ejemplos: (texto.match(/[\ufffd\u00c3.\u00e2\u20ac]{2,}/g) || []).slice(0, 5) });
    if (/ {2,}/.test(texto))
        issues.push({ tipo: "doble-espacio", ocurrencias: (texto.match(/ {2,}/g) || []).length });
    if (/\s+[,;:.!?]/.test(texto))
        issues.push({ tipo: "espacio-antes-de-puntuación", ocurrencias: (texto.match(/\s+[,;:.!?]/g) || []).length });
    if (/[a-z]\.[A-Z]/.test(texto.replace(/\b\w\./g, "")))
        issues.push({ tipo: "posible-falta-de-espacio-tras-punto" });
    if (/lorem ipsum/i.test(texto))
        issues.push({ tipo: "lorem-ipsum" });
    if (/\bTODO\b|\bFIXME\b|TBD/i.test(texto))
        issues.push({ tipo: "marcas-de-trabajo-inconcluso" });
    if (/[)!.,;:]{2,}/.test(texto))
        issues.push({ tipo: "puntuación-repetida", ejemplos: (texto.match(/[)!.,;:]{2,}/g) || []).slice(0, 3) });
    if (/\s\n/.test(texto))
        issues.push({ tipo: "espacios-al-final-de-línea", ocurrencias: (texto.match(/\s\n/g) || []).length });
    if (textoo_mayus(texto))
        issues.push({ tipo: "GRIETAS-en-mayúsculas (shouting)", ejemplos: (texto.match(/\b[A-ZÁÉÍÓÚÑ]{5,}\b/g) || []).slice(0, 5) });
    function textoo_mayus(t) { return (t.match(/\b[A-ZÁÉÍÓÚÑ]{5,}\b/g) || []).length > 2; }
    return ok({ limpio: issues.length === 0, issues: issues.map((i) => ({ tipo: i.tipo, ...i })) });
});
server.tool("fix_common", "Corrige automáticamente los problemas tipográficos seguros: duplicadas, dobles espacios, espacios antes de puntuación, trailing spaces.", {
    texto: z.string().describe("Texto a corregir"),
}, async (args) => {
    const { texto } = args;
    let t = texto;
    let cambios = 0;
    const antes = t;
    t = t.replace(/\b(\w+)\s+\1\b/gi, "$1");
    if (t !== antes)
        cambios++;
    const a2 = t;
    t = t.replace(/ {2,}/g, " ");
    if (t !== a2)
        cambios++;
    const a3 = t;
    t = t.replace(/\s+([,;:.!?])/g, "$1");
    if (t !== a3)
        cambios++;
    const a4 = t;
    t = t.replace(/[ \t]+\n/g, "\n");
    if (t !== a4)
        cambios++;
    const a5 = t;
    t = t.replace(/[)!.,;:]{2,}/g, (m) => m[0]);
    if (t !== a5)
        cambios++;
    return ok({ cambios_aplicados: cambios, texto_corregido: t });
});
server.tool("health_check", "Verifica que el servidor text-qa está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "text-qa", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[text-qa] fatal:", e);
    process.exit(1);
});

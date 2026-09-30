#!/usr/bin/env node
/**
 * MCP Server: Chunker
 * Trocea texto para RAG: chunks por oraciones/superposiciones con presupuesto de tokens
 *
 * Dolor que resuelve: El RAG casero trocea mal (corta oraciones, tamaños desiguales): la calidad de recuperación se hunde.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: chunker
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
const server = new McpServer({ name: "chunker", version: "1.0.0" });
server.tool("chunk_text", "Trocea texto en chunks de presupuesto de tokens: respeta oraciones, superposición configurable y mínimo por chunk.", {
    texto: z.string().describe("Texto a trocear"),
    max_tokens: z.number().describe("Tokens por chunk").default(400),
    overlap_oraciones: z.number().describe("Oraciones solapadas entre chunks").default(1),
}, async (args) => {
    const { texto, max_tokens, overlap_oraciones } = args;
    const oraciones = String(texto).replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim());
    const presupuesto = max_tokens ?? 400;
    const chunks = [];
    let actual = [];
    let tokensActual = 0;
    for (const o of oraciones) {
        const t = Math.ceil(o.length / 4);
        if (tokensActual + t > presupuesto && actual.length) {
            chunks.push({ chunk: chunks.length + 1, texto: actual.join(" "), tokens: tokensActual, oraciones: actual.length });
            const cola = actual.slice(-(overlap_oraciones ?? 1));
            actual = [...cola];
            tokensActual = Math.ceil(cola.join(" ").length / 4);
        }
        if (t > presupuesto) {
            const palabras = o.split(" ");
            let parte = [];
            for (const w of palabras) {
                if (Math.ceil(parte.join(" ").length / 4) + Math.ceil(w.length / 4) > presupuesto && parte.length) {
                    chunks.push({ chunk: chunks.length + 1, texto: parte.join(" "), tokens: Math.ceil(parte.join(" ").length / 4), oraciones: 1 });
                    parte = [];
                }
                parte.push(w);
            }
            if (parte.length) {
                actual = actual.concat([parte.join(" ")]);
                tokensActual = Math.ceil(actual.join(" ").length / 4);
            }
        }
        else {
            actual.push(o);
            tokensActual += t;
        }
    }
    if (actual.length)
        chunks.push({ chunk: chunks.length + 1, texto: actual.join(" "), tokens: tokensActual, oraciones: actual.length });
    return ok({ total_chunks: chunks.length, tokens_origen: Math.ceil(texto.length / 4), chunks });
});
server.tool("chunk_stats", "Estadísticas de una lista de chunks: tamaños, desviación y cobertura con overlap (para tunear el chunking).", {
    chunks: z.array(z.any()).describe("Lista de chunks (strings u objetos con texto)"),
}, async (args) => {
    const { chunks } = args;
    const tamaños = (Array.isArray(chunks) ? chunks : []).map((c) => typeof c === "string" ? Math.ceil(c.length / 4) : Math.ceil(String(c.texto || c.chunk || "").length / 4));
    if (!tamaños.length)
        return fail("sin chunks");
    const media = tamaños.reduce((a, b) => a + b, 0) / tamaños.length;
    const sd = Math.sqrt(tamaños.reduce((a, t) => a + (t - media) ** 2, 0) / tamaños.length);
    const sorted = [...tamaños].sort((a, b) => a - b);
    return ok({ chunks: tamaños.length, tokens_media: Math.round(media), desviacion: Math.round(sd), min: sorted[0], max: sorted[sorted.length - 1], p50: sorted[Math.floor(sorted.length / 2)], uniformidad: Math.round((1 - sd / (media || 1)) * 100) + "%", recomendacion: sd / (media || 1) > 0.5 ? "tamaños muy dispares: revisa el chunking" : "uniformidad aceptable" });
});
server.tool("health_check", "Verifica que el servidor chunker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "chunker", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[chunker] fatal:", e);
    process.exit(1);
});

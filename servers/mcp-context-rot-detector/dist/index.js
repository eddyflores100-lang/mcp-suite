#!/usr/bin/env node
/**
 * MCP Server: Context Rot Detector
 * Detecta información podrida en el contexto: datos viejos, contradicciones y duplicados
 *
 * Dolor que resuelve: El contexto se pudre: datos desactualizados y contradictorios acumulados degradan la calidad de las respuestas (context rot).
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: context-rot-detector
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
const server = new McpServer({ name: "context-rot-detector", version: "1.0.0" });
server.tool("detect_stale", "Detecta entradas viejas en una lista de items {texto, ts}: flaggea las que superan la frescura máxima por tipo de dato.", {
    items: z.array(z.any()).describe("Items [{texto, ts ISO}]"),
    max_horas: z.number().describe("Frescura máxima en horas").default(72),
}, async (args) => {
    const { items, max_horas } = args;
    const list = Array.isArray(items) ? items : [];
    const limite = Date.now() - (max_horas ?? 72) * 3600000;
    const analisis = list.map((it) => {
        const ts = new Date(it.ts || 0).getTime();
        const edad_h = Math.round((Date.now() - ts) / 3600000);
        return { texto: String(it.texto || "").slice(0, 80), ts: it.ts, edad_horas: Number.isFinite(edad_h) && edad_h >= 0 ? edad_h : null, podrido: ts < limite };
    });
    const podridos = analisis.filter((a) => a.podrido).length;
    return ok({ total: list.length, podridos, frescura_max_horas: max_horas ?? 72, analisis, recomendacion: podridos > list.length / 3 ? "contexto gravemente podrido: reconstruir" : podridos > 0 ? "purgar " + podridos + " entradas viejas" : "fresco" });
});
server.tool("detect_contradictions", "Detecta contradicciones simples entre afirmaciones: números distintos sobre el mismo sujeto o negaciones opuestas.", {
    afirmaciones: z.array(z.any()).describe("Lista de afirmaciones (strings)"),
}, async (args) => {
    const { afirmaciones } = args;
    const af = (Array.isArray(afirmaciones) ? afirmaciones : []).map(String);
    const pares = [];
    for (let i = 0; i < af.length; i++) {
        for (let j = i + 1; j < af.length; j++) {
            const a = af[i].toLowerCase(), b = af[j].toLowerCase();
            const numA = a.match(/\d+(\.\d+)?/g) || [], numB = b.match(/\d+(\.\d+)?/g) || [];
            const mismo_sujeto = a.split(/\s+/).some((w) => w.length > 5 && b.includes(w));
            const num_conflict = mismo_sujeto && numA.length && numB.length && numA.join() !== numB.join();
            const negacion = (a.includes(" no ") && !b.includes(" no ") || b.includes(" no ") && !a.includes(" no ")) && mismo_sujeto;
            if (num_conflict || negacion)
                pares.push({ a: af[i].slice(0, 120), b: af[j].slice(0, 120), tipo: num_conflict ? "cifras-discrepantes" : "negacion-opuesta" });
        }
    }
    return ok({ total_afirmaciones: af.length, contradicciones: pares, limpio: pares.length === 0 });
});
server.tool("dedupe_context", "Elimina entradas duplicadas/casi-duplicadas de una lista de textos (similitud Jaccard sobre palabras).", {
    textos: z.array(z.any()).describe("Lista de textos"),
    umbral: z.number().describe("Similitud umbral (0-1)").default(0.8),
}, async (args) => {
    const { textos, umbral } = args;
    const list = (Array.isArray(textos) ? textos : []).map(String);
    const kept = [];
    const dupes = [];
    const jaccard = (a, b) => {
        const sa = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
        const sb = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
        const inter = [...sa].filter((w) => sb.has(w)).length;
        return inter / (sa.size + sb.size - inter || 1);
    };
    for (const t of list) {
        const dup = kept.some((k) => jaccard(k, t) >= (umbral ?? 0.8));
        if (dup)
            dupes.push(t);
        else
            kept.push(t);
    }
    return ok({ originales: list.length, conservados: kept.length, duplicados: dupes.length, reduccion: Math.round((1 - kept.length / (list.length || 1)) * 100) + "%" });
});
server.tool("health_check", "Verifica que el servidor context-rot-detector está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "context-rot-detector", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[context-rot-detector] fatal:", e);
    process.exit(1);
});

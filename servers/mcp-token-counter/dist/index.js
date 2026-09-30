#!/usr/bin/env node
/**
 * MCP Server: Token Counter
 * Cuenta tokens y palabras antes de enviar: presupuesto bajo control
 *
 * Dolor que resuelve: El agente envía prompts gigantes sin saber cuánto costarán: falta un contador previo (aproximado, sin API).
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: token-counter
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
const server = new McpServer({ name: "token-counter", version: "1.0.0" });
server.tool("count", "Cuenta tokens aproximados de un texto (heurística chars/4 + palabras/0.75, calibrada para español e inglés).", {
    texto: z.string().describe("Texto a medir"),
}, async (args) => {
    const { texto } = args;
    const chars = texto.length;
    const palabras = texto.split(/\s+/).filter(Boolean).length;
    const por_chars = Math.ceil(chars / 4);
    const por_palabras = Math.ceil(palabras / 0.75);
    const estimado = Math.max(por_chars, por_palabras);
    return ok({ caracteres: chars, palabras, tokens_estimados: estimado, rango: [Math.floor(estimado * 0.85), Math.ceil(estimado * 1.15)], metodo: "heurística local (chars/4 + palabras/0.75)" });
});
server.tool("count_messages", "Cuenta tokens de una conversación completa [{rol, contenido}] incluyendo overhead por mensaje.", {
    mensajes: z.array(z.any()).describe("Lista de mensajes {rol, contenido}"),
}, async (args) => {
    const { mensajes } = args;
    const msgs = Array.isArray(mensajes) ? mensajes : [];
    let total = 0;
    const detalle = msgs.map((m) => {
        const t = Math.ceil(String(m.contenido || "").length / 4) + 4;
        total += t;
        return { rol: m.rol, tokens: t };
    });
    return ok({ mensajes: msgs.length, tokens_total: total, detalle });
});
server.tool("fit_check", "Verifica si un prompt entra en la ventana de un modelo dado (gpt4, claude, gemini...) y cuánto queda para la respuesta.", {
    tokens_prompt: z.number().describe("Tokens del prompt"),
    modelo: z.enum(["small-8k", "medium-32k", "large-128k", "xlarge-200k", "giant-1m"]).describe("Clase de modelo").default("large-128k"),
}, async (args) => {
    const { tokens_prompt, modelo } = args;
    const ventanas = { "small-8k": 8192, "medium-32k": 32768, "large-128k": 131072, "xlarge-200k": 204800, "giant-1m": 1048576 };
    const v = ventanas[modelo || "large-128k"];
    const cabe = tokens_prompt < v * 0.8;
    return ok({ modelo, ventana: v, prompt: tokens_prompt, disponible_para_respuesta: v - tokens_prompt, cabe_con_margen_20: cabe, recomendacion: cabe ? "ok" : "comprime con context-compressor o sube de modelo" });
});
server.tool("health_check", "Verifica que el servidor token-counter está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "token-counter", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[token-counter] fatal:", e);
    process.exit(1);
});

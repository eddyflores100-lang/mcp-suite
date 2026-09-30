#!/usr/bin/env node
/**
 * MCP Server: Response Size Guard
 * Guardián del tamaño de respuesta: nada revienta el contexto del cliente (issue #58 de MCP)
 *
 * Dolor que resuelve: Respuestas MCP gigantes desbordan el contexto del cliente: el spec pide truncado inteligente (GitHub modelcontextprotocol#58).
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: response-size-guard
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
const server = new McpServer({ name: "response-size-guard", version: "1.0.0" });
server.tool("measure", "Mide una respuesta MCP {content:[{type,text}]}: tokens estimados, caracteres y si excede límites recomendados.", {
    respuesta: z.any().describe("Respuesta MCP a medir"),
    limite_tokens: z.number().describe("Límite recomendado").default(2000),
}, async (args) => {
    const { respuesta, limite_tokens } = args;
    const r = respuesta || {};
    const textos = (r.content || []).map((c) => String(c.text || "")).join("\n");
    const tokens = Math.ceil(textos.length / 4);
    const items = (r.content || []).length;
    return ok({ caracteres: textos.length, tokens_estimados: tokens, items_content: items, limite: limite_tokens ?? 2000, excede: tokens > (limite_tokens ?? 2000), exceso: Math.max(0, tokens - (limite_tokens ?? 2000)) });
});
server.tool("truncate_safe", "Trunca una respuesta de forma segura: conserva JSON válido (elide arrays), corta texto por oraciones y añade aviso.", {
    data: z.any().describe("Datos a truncar"),
    max_tokens: z.number().describe("Presupuesto de tokens").default(2000),
}, async (args) => {
    const { data, max_tokens } = args;
    function ajustar(nodo, presupuesto) {
        if (typeof nodo === "string") {
            if (Math.ceil(nodo.length / 4) <= presupuesto)
                return nodo;
            const oraciones = nodo.split(/(?<=[.!?])\s+/);
            let out = "";
            for (const o of oraciones) {
                if (Math.ceil((out + o).length / 4) > presupuesto)
                    break;
                out += o + " ";
            }
            if (!out)
                out = nodo.slice(0, presupuesto * 4);
            return out.trim() + " [...truncado]";
        }
        if (Array.isArray(nodo)) {
            const recortadas = [];
            let gasto = 0;
            for (const item of nodo) {
                const s = JSON.stringify(item);
                gasto += Math.ceil(s.length / 4);
                if (gasto > presupuesto * 0.8)
                    break;
                recortadas.push(ajustar(item, presupuesto * 0.3));
            }
            return recortadas.length < nodo.length ? [...recortadas.slice(0, 10), "...(" + (nodo.length - recortadas.length) + " elementos elidos)"] : recortadas.map((x) => ajustar(x, presupuesto * 0.3));
        }
        if (nodo && typeof nodo === "object") {
            const out = {};
            for (const [k, v] of __ents(nodo))
                out[k] = ajustar(v, presupuesto * 0.4);
            return out;
        }
        return nodo;
    }
    const ajustado = ajustar(data, max_tokens ?? 2000);
    return ok({ truncado: JSON.stringify(ajustado) !== JSON.stringify(data), tokens_origen_estimados: Math.ceil(JSON.stringify(data).length / 4), data: ajustado });
});
server.tool("health_check", "Verifica que el servidor response-size-guard está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "response-size-guard", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[response-size-guard] fatal:", e);
    process.exit(1);
});

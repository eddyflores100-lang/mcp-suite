#!/usr/bin/env node
/**
 * MCP Server: Timeout Guard
 * Deadlines y escalada: ninguna llamada sin reloj
 *
 * Dolor que resuelve: Las tools lentas congelan al agente: falta gestión de deadlines, timeouts por clase de operación y escalada.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: timeout-guard
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
const server = new McpServer({ name: "timeout-guard", version: "1.0.0" });
server.tool("suggest_timeout", "Sugiere timeout por clase de operación (lectura local, API rápida, scrapeo, LLM, batch) con justificación.", {
    clase: z.enum(["local-io", "api-rapida", "api-lenta", "scraping", "llm", "batch"]).describe("Clase de operación"),
}, async (args) => {
    const { clase } = args;
    const tabla = {
        "local-io": { ms: 2000, razon: "disco local: si tarda más algo podrido" },
        "api-rapida": { ms: 8000, razon: "API JSON ligera: 8s cubre p99" },
        "api-lenta": { ms: 20000, razon: "procesamiento server-side" },
        "scraping": { ms: 30000, razon: "render + descarga de assets" },
        "llm": { ms: 120000, razon: "generación de tokens larga" },
        "batch": { ms: 300000, razon: "procesamiento masivo" },
    };
    const r = tabla[clase] || tabla["api-rapida"];
    return ok({ clase, timeout_sugerido_ms: r.ms, razon: r.razon });
});
server.tool("deadline_plan", "Dado un presupuesto total de tiempo y una lista de pasos, reparte deadlines proporcionales y detecta pasos imposibles.", {
    presupuesto_ms: z.number().describe("Tiempo total disponible"),
    pasos: z.array(z.any()).describe("Lista de {nombre, peso (relativo)}"),
}, async (args) => {
    const { presupuesto_ms, pasos } = args;
    const list = Array.isArray(pasos) ? pasos : [];
    const total_peso = list.reduce((a, p) => a + (p.peso || 1), 0) || 1;
    const plan = list.map((p) => {
        const ms = Math.round((presupuesto_ms * (p.peso || 1)) / total_peso);
        return { paso: p.nombre, deadline_ms: ms, ajustado: ms < 100 };
    });
    const imposibles = plan.filter((p) => p.ajustado);
    return ok({ presupuesto_ms, plan, advertencia: imposibles.length ? "pasos con deadline < 100ms: redistribuye" : "ok" });
});
server.tool("health_check", "Verifica que el servidor timeout-guard está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "timeout-guard", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[timeout-guard] fatal:", e);
    process.exit(1);
});

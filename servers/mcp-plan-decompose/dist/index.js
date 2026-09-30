#!/usr/bin/env node
/**
 * MCP Server: Plan Decompose
 * Descompone objetivos en planes ejecutables: pasos, dependencias y estimaciones
 *
 * Dolor que resuelve: El agente ataca objetivos gigantes sin descomponer: pasos desordenados, sin dependencias ni criterios de salida.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: plan-decompose
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
const server = new McpServer({ name: "plan-decompose", version: "1.0.0" });
server.tool("decompose", "Descompone un objetivo en pasos estructurados: extrae verbos de acción, ordena por dependencia lógica y añade criterios de terminación.", {
    objetivo: z.string().describe("Objetivo a descomponer"),
    max_pasos: z.number().describe("Máximo pasos").default(8),
}, async (args) => {
    const { objetivo, max_pasos } = args;
    const acciones = ["investigar", "definir", "diseñar", "implementar", "configurar", "probar", "validar", "documentar", "publicar", "medir", "revisar", "integrar", "analizar", "extraer", "limpiar", "comparar", "instalar", "escribir", "crear", "verificar"];
    const obj = objetivo.toLowerCase();
    const detectadas = acciones.filter((a) => obj.includes(a));
    const fases = detectadas.length >= 2 ? detectadas.slice(0, max_pasos ?? 8) : ["analizar", "implementar", "verificar", "documentar"];
    const pasos = fases.map((fase, i) => ({
        n: i + 1,
        accion: fase,
        descripcion: fase.charAt(0).toUpperCase() + fase.slice(1) + " lo necesario para: " + objetivo.slice(0, 80),
        depende_de: i === 0 ? [] : [i],
        criterio_terminacion: "puedes marcarlo done cuando " + fase + " tiene entregable verificable",
        estimacion_minutos: 15 * (i + 1),
    }));
    return ok({ objetivo, total_pasos: pasos.length, pasos, nota: "refina con task-tracker para ejecución real" });
});
server.tool("estimate_complexity", "Estima la complejidad de un objetivo (baja/media/alta) por señales: alcance, dominios involucrados, incertidumbre y dependencias externas.", {
    objetivo: z.string().describe("Objetivo"),
    contexto: z.string().describe("Contexto adicional").optional(),
}, async (args) => {
    const { objetivo, contexto } = args;
    const t = (objetivo + " " + (contexto || "")).toLowerCase();
    let puntos = 0;
    const señales = [];
    if (/\b(todo|todas|completo|integral|end.?to.?end|múltiples|varios|cada)\b/.test(t)) {
        puntos += 2;
        señales.push("alcance amplio");
    }
    if (/\b(integr|api|extern|tercer|webhook|deploy|producción|migrat)\b/.test(t)) {
        puntos += 2;
        señales.push("dependencias externas");
    }
    if (/\b(diseñ|arquitect|decidir|elegir|comparar|estrategia)\b/.test(t)) {
        puntos += 1;
        señales.push("decisiones de diseño");
    }
    if (/\b(seguridad|pago|legal|compliance|cripto)\b/.test(t)) {
        puntos += 2;
        señales.push("dominio sensible");
    }
    if (/\b(mvp|rápido|simple|demo|borrador|solo)\b/.test(t)) {
        puntos -= 2;
        señales.push("alcance reducido");
    }
    if (t.length > 400) {
        puntos += 1;
        señales.push("descripción larga: muchos requisitos implícitos");
    }
    const nivel = puntos <= 1 ? "baja" : puntos <= 3 ? "media" : puntos <= 5 ? "alta" : "muy alta";
    return ok({ puntos, nivel, señales, recomendacion: nivel === "baja" ? "ejecuta directo" : nivel === "media" ? "planifica 3-5 pasos" : "descompón en sub-objetarios y valida supuestos primero" });
});
server.tool("health_check", "Verifica que el servidor plan-decompose está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "plan-decompose", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[plan-decompose] fatal:", e);
    process.exit(1);
});

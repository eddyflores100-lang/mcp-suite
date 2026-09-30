#!/usr/bin/env node
/**
 * MCP Server: Output Grader
 * Autoevalúa salidas del agente: completitud, especificidad y estructura
 *
 * Dolor que resuelve: El agente entrega sin autoevaluar: respuestas vagas, sin cifras y con placeholders pasan como válidas.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: output-grader
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";


// ——— helpers de respuesta ———
function ok(data: any) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg: any) {
  return { content: [{ type: "text" as const, text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true as const };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o: any): any[] { return Object.values(o); }
function __ents(o: any): [string, any][] { return Object.entries(o); }

const server = new McpServer({ name: "output-grader", version: "1.0.0" });

server.tool(
  "grade",
  "Califica una salida (0-100) por heurísticas: completitud (placeholders/lorem), especificidad (números/fechas), estructura (longitud, listas) y acciones ejecutables.",
  {
  salida: z.string().describe("Texto de la salida a evaluar"),
  tipo_esperado: z.enum(["respuesta","analisis","instrucciones","codigo"]).describe("Tipo de salida").default("respuesta"),
  },
  async (args: any) => {
    const { salida, tipo_esperado } = args as any;
    const t = String(salida);
const problemas: string[] = [];
if (/lorem ipsum|placeholder|TBD|XXX|\[insertar|\[ejemplo|<completar>/i.test(t)) problemas.push("contiene placeholders");
const numeros = (t.match(/\d+(\.\d+)?/g) || []).length;
const fechas = (t.match(/\d{4}|\d{1,2}[/-]\d{1,2}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/gi) || []).length;
const listas = (t.match(/^\s*[-*\d]+[.)]?\s+/gm) || []).length;
const verbos_accion = (t.match(/\b(instala|ejecuta|crea|verifica|env[ií]a|configura|revisa|elimina|actualiza|documenta)\b/gi) || []).length;
let score = 50;
if (problemas.length) score -= 30;
if (numeros >= 3) score += 15; else if (numeros === 0) { score -= 10; problemas.push("sin especificidad numérica"); }
if (fechas > 0) score += 5;
if (listas >= 3) score += 10;
if (verbos_accion >= 2 && tipo_esperado === "instrucciones") score += 15;
if (t.length < 100) { score -= 15; problemas.push("demasiado corto para el tipo esperado"); }
if (t.length > 12000) { score -= 5; problemas.push("riesgo de exceso de contexto"); }
score = Math.max(0, Math.min(100, score));
return ok({ score, nivel: score >= 80 ? "apto" : score >= 60 ? "mejorable" : "rechazar", problemas, metricas: { numeros, fechas, items_de_lista: listas, verbos_de_accion: verbos_accion, caracteres: t.length } });
  }
);

server.tool(
  "improve_hints",
  "Dada una salida, devuelve instrucciones concretas para mejorarla (feedback accionable).",
  {
  salida: z.string().describe("Salida original"),
  },
  async (args: any) => {
    const { salida } = args as any;
    const t = String(salida);
const hints: string[] = [];
if (/lorem ipsum|placeholder|TBD|XXX/i.test(t)) hints.push("elimina placeholders y completa con datos reales");
if (!(t.match(/\d+(\.\d+)?/g) || []).length) hints.push("añade cifras concretas (montos, cantidades, versiones)");
if (t.length < 150) hints.push("desarrolla más: contexto, criterios y consecuencias");
if (!/^\s*[-*\d]+[.)]?\s+/m.test(t) && t.length > 400) hints.push("estructura en listas/secciones para escaneabilidad");
if (!/\b(instala|ejecuta|crea|verifica|env[ií]a|configura)\b/i.test(t)) hints.push("incluye acciones ejecutables concretas");
if (!hints.length) hints.push("la salida es sólida: considera verificar hechos con fact-consistency");
return ok({ hints });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor output-grader está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "output-grader", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[output-grader] fatal:", e);
  process.exit(1);
});

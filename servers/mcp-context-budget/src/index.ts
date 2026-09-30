#!/usr/bin/env node
/**
 * MCP Server: Context Budget
 * Presupuesto de tokens por sección: qué entra al prompt y qué se queda fuera
 *
 * Dolor que resuelve: Sin presupuesto, el agente mete todo al prompt hasta chocar con el límite (issue #58 del spec MCP: responses too big).
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: context-budget
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

const server = new McpServer({ name: "context-budget", version: "1.0.0" });

server.tool(
  "check_fit",
  "Calcula si una lista de secciones {nombre, texto} cabe en el presupuesto de tokens del modelo (con margen para respuesta).",
  {
  secciones: z.array(z.any()).describe("Lista de {nombre, texto}"),
  presupuesto_tokens: z.number().describe("Límite del modelo").default(128000),
  margen_respuesta: z.number().describe("Tokens reservados para la respuesta").default(4000),
  },
  async (args: any) => {
    const { secciones, presupuesto_tokens, margen_respuesta } = args as any;
    const items = Array.isArray(secciones) ? secciones : [];
const disp = presupuesto_tokens - margen_respuesta;
let acumulado = 0;
const analisis = items.map((s: any) => {
  const tokens = Math.ceil(String(s.texto || "").length / 4);
  acumulado += tokens;
  return { nombre: s.nombre, tokens, acumulado, cabe: acumulado <= disp };
});
return ok({ disponible: disp, total_secciones: acumulado, excede: acumulado > disp, sobra: disp - acumulado, analisis, recomendacion: acumulado > disp ? "recorta secciones de menor prioridad o usa context-compressor" : "todo cabe" });
  }
);

server.tool(
  "plan_sections",
  "Dado un presupuesto y secciones priorizadas, decide cuáles entran completas, cuáles recortadas y cuáles fuera.",
  {
  secciones: z.array(z.any()).describe("Lista de {nombre, texto, prioridad 1-5}"),
  presupuesto_tokens: z.number().describe("Presupuesto").default(32000),
  },
  async (args: any) => {
    const { secciones, presupuesto_tokens } = args as any;
    const items = (Array.isArray(secciones) ? secciones : []).map((s: any) => ({ ...s, tokens: Math.ceil(String(s.texto || "").length / 4) }));
items.sort((a: any, b: any) => (b.prioridad || 3) - (a.prioridad || 3));
let restante = presupuesto_tokens ?? 32000;
const plan: any[] = [];
for (const s of items) {
  if (s.tokens <= restante) { plan.push({ nombre: s.nombre, modo: "completo", tokens: s.tokens }); restante -= s.tokens; }
  else if (restante > 500) { plan.push({ nombre: s.nombre, modo: "recortado", tokens_originales: s.tokens, tokens: restante }); restante = 0; }
  else plan.push({ nombre: s.nombre, modo: "fuera", tokens: s.tokens });
}
return ok({ presupuesto: presupuesto_tokens, plan });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor context-budget está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "context-budget", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[context-budget] fatal:", e);
  process.exit(1);
});

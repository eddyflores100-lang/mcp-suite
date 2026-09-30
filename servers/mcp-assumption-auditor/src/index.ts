#!/usr/bin/env node
/**
 * MCP Server: Assumption Auditor
 * Audita supuestos del agente: explícitos, críticos y cómo validarlos
 *
 * Dolor que resuelve: Los supuestos ocultos rompen planes enteros: nadie los enumera ni valida antes de construir encima.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: assumption-auditor
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

const server = new McpServer({ name: "assumption-auditor", version: "1.0.0" });

server.tool(
  "audit_plan",
  "Extrae supuestos implícitos de un plan/objetivo (señales lingüísticas: presuposiciones, dependencias, certezas) y los clasifica por criticidad.",
  {
  plan: z.string().describe("El plan u objetivo en texto"),
  },
  async (args: any) => {
    const { plan } = args as any;
    const t = plan;
const patrones: Array<[string, string, number]> = [
  ["\b(si|cuando|una vez que|después de)\b[^.]{5,80}", "condicional-dependiente", 4],
  ["\b(asumiendo|suponiendo|dando por hecho|se asume)\b", "supuesto-explicito", 3],
  ["\b(todo el mundo|el usuario|el equipo|la api|el sistema)\b[^.]{0,60}\b(está|están|tiene|tienen|quiere|quieren)\b", "generalizacion-sobre-otros", 3],
  ["\b(ya|siempre|nunca|obviamente|de sobra)\b", "certeza-no-verificada", 2],
  ["\b(sin|no hay|nadie)\b[^.]{0,50}\b(problema|cambio|conflicto|fallo)\b", "ausencia- asumida", 4],
  ["\b(api|endpoint|base de datos|librería|versión)\b[^.]{0,60}\b(funciona|soporta|permite)\b", "dependencia-técnica", 5],
];
const supuestos: any[] = [];
for (const [pat, tipo, criticidad] of patrones) {
  const matches = t.match(new RegExp(pat, "gi")) || [];
  for (const m of matches.slice(0, 5)) supuestos.push({ supuesto: m.trim().slice(0, 120), tipo, criticidad, validacion_sugerida: tipo === "dependencia-técnica" ? "probar el endpoint/librería AHORA con un smoke test" : "preguntar al stakeholder o buscar evidencia" });
}
return ok({ total: supuestos.length, criticos: supuestos.filter((s) => s.criticidad >= 4).length, supuestos: supuestos.sort((a: any, b: any) => b.criticidad - a.criticidad), advertencia: supuestos.length === 0 ? "sin supuestos detectados por heurística: revisa manualmente" : "valida los críticos ANTES de ejecutar el plan" });
  }
);

server.tool(
  "validate_assumption",
  "Guía la validación de un supuesto específico: qué evidencia lo confirmaría/refutaría y qué hacer en cada caso.",
  {
  supuesto: z.string().describe("El supuesto a validar"),
  criticidad: z.enum(["baja","media","alta"]).describe("Qué pasa si es falso").default("media"),
  },
  async (args: any) => {
    const { supuesto, criticidad } = args as any;
    return ok({ supuesto, plan_de_validacion: [
  "1. Define qué evidencia lo confirmaría (dato, doc, test, testimonio)",
  "2. Define qué evidencia lo refutaría",
  "3. Busca la más barata de obtener primero",
  "4. Asigna un deadline de validación",
], si_es_falso: criticidad === "alta" ? "detén el plan y rediseña: la base se cae" : "ajusta el plan: contención o alternativa", costo_de_no_validar: criticidad === "alta" ? "cascada de retrabajo" : "ajuste local" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor assumption-auditor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "assumption-auditor", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[assumption-auditor] fatal:", e);
  process.exit(1);
});

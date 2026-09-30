#!/usr/bin/env node
/**
 * MCP Server: Decision Matrix
 * Decisiones ponderadas: opciones × criterios con análisis de sensibilidad
 *
 * Dolor que resuelve: El agente decide por intuición: sin matriz ponderada, las decisiones no son reproducibles ni explicables.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: decision-matrix
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

const server = new McpServer({ name: "decision-matrix", version: "1.0.0" });

server.tool(
  "decide",
  "Evalúa opciones contra criterios ponderados: puntúa cada opción, calcula total ponderado y recomienda la ganadora.",
  {
  opciones: z.array(z.any()).describe("Nombres de opciones"),
  criterios: z.array(z.any()).describe("Lista {nombre, peso}"),
  puntajes: z.any().describe("Matriz {opcion: {criterio: 0-10}}"),
  },
  async (args: any) => {
    const { opciones, criterios, puntajes } = args as any;
    const opts = Array.isArray(opciones) ? opciones : [];
const crits = (Array.isArray(criterios) ? criterios : []).map((c: any) => typeof c === "string" ? { nombre: c, peso: 1 } : c);
const pesos = crits.reduce((a: number, c: any) => a + (c.peso ?? 1), 0) || 1;
const resultados = opts.map((o: string) => {
  let total = 0; const detalle: any = {};
  for (const c of crits) {
    const v = Math.max(0, Math.min(10, Number(puntajes?.[o]?.[c.nombre] ?? 5)));
    detalle[c.nombre] = v;
    total += v * (c.peso ?? 1);
  }
  return { opcion: o, puntaje_ponderado: Math.round((total / pesos) * 100) / 100, detalle };
}).sort((a: any, b: any) => b.puntaje_ponderado - a.puntaje_ponderado);
return ok({ ganadora: resultados[0]?.opcion, ranking: resultados, criterios: crits, empate: resultados.length > 1 && resultados[0].puntaje_ponderado === resultados[1].puntaje_ponderado });
  }
);

server.tool(
  "sensitivity",
  "Análisis de sensibilidad: ¿cambia la decisión si un criterio cambia de peso? Encuentra los pesos que voltean la decisión.",
  {
  opciones: z.array(z.any()).describe("Nombres de opciones"),
  criterios: z.array(z.any()).describe("Lista {nombre, peso}"),
  puntajes: z.any().describe("Matriz de puntajes"),
  },
  async (args: any) => {
    const { opciones, criterios, puntajes } = args as any;
    const opts = Array.isArray(opciones) ? opciones : [];
const crits = (Array.isArray(criterios) ? criterios : []).map((c: any) => typeof c === "string" ? { nombre: c, peso: 1 } : c);
function totalDe(opcion: string, pesos: any): number {
  let t = 0;
  for (const c of crits) t += Math.max(0, Math.min(10, Number(puntajes?.[opcion]?.[c.nombre] ?? 5))) * pesos[c.nombre];
  return t;
}
const ganadora = opts.reduce((best: any, o: string) => { const t = totalDe(o, Object.fromEntries(crits.map((c: any) => [c.nombre, c.peso ?? 1]))); return !best || t > best.t ? { o, t } : best; }, null);
const sensibilidades: any[] = [];
for (const c of crits) {
  for (const factor of [0, 0.5, 2, 5]) {
    const pesos: any = Object.fromEntries(crits.map((x: any) => [x.nombre, x.peso ?? 1]));
    pesos[c.nombre] = (c.peso ?? 1) * factor;
    const nueva = opts.reduce((best: any, o: string) => { const t = totalDe(o, pesos); return !best || t > best.t ? { o, t } : best; }, null);
    if (nueva.o !== ganadora.o) sensibilidades.push({ criterio: c.nombre, factor_peso: factor, nueva_ganadora: nueva.o, razon: "si " + c.nombre + " pesa x" + factor + ", gana " + nueva.o });
  }
}
return ok({ ganadora_original: ganadora?.o, volatil: sensibilidades.length > 0, sensibilidades: sensibilidades.slice(0, 8), nota: sensibilidades.length ? "decisión sensible: documenta la justificación de pesos" : "decisión robusta a cambios de peso" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor decision-matrix está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "decision-matrix", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[decision-matrix] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Attention Focus
 * Prioriza qué merece atención: ranking de secciones del contexto por relevancia
 *
 * Dolor que resuelve: Todo el contexto pesa igual y nada destaca: el agente diluye la atención en irrelevantes.
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: attention-focus
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

const server = new McpServer({ name: "attention-focus", version: "1.0.0" });

server.tool(
  "prioritize",
  "Rankea secciones {nombre, texto} por relevancia contra una consulta: coincidencias de términos, posición y densidad.",
  {
  secciones: z.array(z.any()).describe("Lista de {nombre, texto}"),
  consulta: z.string().describe("A qué hay que prestar atención"),
  },
  async (args: any) => {
    const { secciones, consulta } = args as any;
    const items = Array.isArray(secciones) ? secciones : [];
const qwords = consulta.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
const rankeo = items.map((s: any, i: number) => {
  const texto = String(s.texto || "").toLowerCase();
  const hits = qwords.filter((w) => texto.includes(w)).length;
  const densidad = texto.length ? hits / (texto.length / 500) : 0;
  return { nombre: s.nombre, indice: i, hits, score: Math.round((hits * 2 + densidad) * 100) / 100 };
}).sort((a: any, b: any) => b.score - a.score);
return ok({ consulta, ranking: rankeo, top: rankeo[0]?.nombre || null });
  }
);

server.tool(
  "focus_window",
  "Construye la ventana de foco: las K secciones más relevantes concatenadas, listas para usar como contexto reducido.",
  {
  secciones: z.array(z.any()).describe("Lista de {nombre, texto}"),
  consulta: z.string().describe("Consulta"),
  k: z.number().describe("Cuántas secciones").default(3),
  },
  async (args: any) => {
    const { secciones, consulta, k } = args as any;
    const items = Array.isArray(secciones) ? secciones : [];
const qwords = consulta.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
const top = items.map((s: any) => {
  const texto = String(s.texto || "").toLowerCase();
  const hits = qwords.filter((w) => texto.includes(w)).length;
  return { s, hits };
}).sort((a, b) => b.hits - a.hits).slice(0, k ?? 3);
const ventana = top.filter((t) => t.hits > 0).map((t) => "### " + t.s.nombre + "\n" + t.s.texto).join("\n\n");
return ok({ secciones_usadas: top.length, tokens_estimados: Math.ceil(ventana.length / 4), ventana });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor attention-focus está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "attention-focus", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[attention-focus] fatal:", e);
  process.exit(1);
});

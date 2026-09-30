#!/usr/bin/env node
/**
 * MCP Server: Milestone Checker
 * Hitos con checkpoints de calidad: mide progreso real contra el plan
 *
 * Dolor que resuelve: El '90% listo' del agente es mentira estadística: sin hitos verificables no hay progreso medible.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: milestone-checker
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

// ——— persistencia local: ~/.mcp-suite/milestone-checker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "milestone-checker");
const STORE_FILE = join(STORE_DIR, "state.json");
const store = {
  load(): any {
    try { return existsSync(STORE_FILE) ? JSON.parse(readFileSync(STORE_FILE, "utf8")) : {}; }
    catch { return {}; }
  },
  save(data: any) {
    mkdirSync(STORE_DIR, { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
    return data;
  },
};

const server = new McpServer({ name: "milestone-checker", version: "1.0.0" });

server.tool(
  "define_milestones",
  "Define los hitos de un proyecto: nombre, criterio verificable y peso relativo.",
  {
  proyecto: z.string().describe("Proyecto"),
  hitos: z.array(z.any()).describe("Lista de {nombre, criterio, peso}"),
  },
  async (args: any) => {
    const { proyecto, hitos } = args as any;
    const st = store.load();
st.proyectos = st.proyectos || {};
const p = st.proyectos[proyecto] = st.proyectos[proyecto] || {};
p.hitos = (Array.isArray(hitos) ? hitos : []).map((h: any, i: number) => ({ n: i + 1, nombre: h.nombre, criterio: h.criterio || "", peso: h.peso ?? 1, cumplido: false }));
store.save(st);
return ok({ proyecto, hitos: p.hitos.length, peso_total: p.hitos.reduce((a: number, h: any) => a + h.peso, 0) });
  }
);

server.tool(
  "evaluate",
  "Marca un hito como cumplido (o lo revierte) evaluando su criterio.",
  {
  proyecto: z.string().describe("Proyecto"),
  hito: z.number().describe("Número de hito"),
  cumplido: z.boolean().describe("¿Cumplido?").default(true),
  evidencia: z.string().describe("Evidencia del cumplimiento").optional(),
  },
  async (args: any) => {
    const { proyecto, hito, cumplido, evidencia } = args as any;
    const st = store.load();
const p = st.proyectos?.[proyecto];
if (!p) return fail("proyecto no existe");
const h = p.hitos.find((x) => x.n === hito);
if (!h) return fail("hito no existe");
h.cumplido = cumplido ?? true;
h.evidencia = evidencia || "";
h.evaluado = new Date().toISOString();
store.save(st);
const logrados = p.hitos.filter((x) => x.cumplido);
return ok({ hito, cumplido: h.cumplido, progreso: Math.round((logrados.reduce((a: number, x: any) => a + x.peso, 0) / p.hitos.reduce((a: number, x: any) => a + x.peso, 0)) * 100) + "%" });
  }
);

server.tool(
  "progress",
  "Reporte de progreso del proyecto: hitos cumplidos/pendientes, próximos y estancados.",
  {
  proyecto: z.string().describe("Proyecto"),
  },
  async (args: any) => {
    const { proyecto } = args as any;
    const st = store.load();
const p = st.proyectos?.[proyecto];
if (!p) return fail("proyecto no existe");
const pendientes = p.hitos.filter((h: any) => !h.cumplido);
return ok({ hitos: p.hitos.length, cumplidos: p.hitos.length - pendientes.length, pendientes: pendientes.map((h: any) => h.n + ". " + h.nombre), proximo: pendientes[0] ? pendientes[0].nombre : "COMPLETADO", progreso: Math.round(((p.hitos.length - pendientes.length) / p.hitos.length) * 100) + "%" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor milestone-checker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "milestone-checker", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[milestone-checker] fatal:", e);
  process.exit(1);
});

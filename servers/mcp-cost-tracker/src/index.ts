#!/usr/bin/env node
/**
 * MCP Server: Cost Tracker
 * Sigue el gasto por llamada y modelo: presupuestos con alertas
 *
 * Dolor que resuelve: El coste de tokens es invisible hasta la factura: sin tracking por tarea no se puede optimizar nada.
 * Categoría: Observabilidad | Generado por mcp-suite | id: cost-tracker
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

// ——— persistencia local: ~/.mcp-suite/cost-tracker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "cost-tracker");
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

const server = new McpServer({ name: "cost-tracker", version: "1.0.0" });

server.tool(
  "record",
  "Registra un gasto: modelo, tokens entrada/salida y coste calculado con tabla de precios editable.",
  {
  tarea: z.string().describe("Tarea/proyecto a imputar"),
  modelo: z.string().describe("Modelo usado (ej: gpt-4o, claude-sonnet)"),
  tokens_entrada: z.number().describe("Tokens de entrada").default(0),
  tokens_salida: z.number().describe("Tokens de salida").default(0),
  },
  async (args: any) => {
    const { tarea, modelo, tokens_entrada, tokens_salida } = args as any;
    const st = store.load();
const precios: any = { "gpt-4o": [0.0025, 0.01], "gpt-4o-mini": [0.00015, 0.0006], "claude-sonnet": [0.003, 0.015], "claude-haiku": [0.0008, 0.004], "gemini-flash": [0.0001, 0.0004], "local": [0, 0] };
st.precios_custom = st.precios_custom || {};
const tabla = { ...precios, ...st.precios_custom };
const [pe, ps] = tabla[modelo] || [0.003, 0.015];
const coste = (tokens_entrada ?? 0) / 1000 * pe + (tokens_salida ?? 0) / 1000 * ps;
st.gastos = st.gastos || [];
st.gastos.push({ ts: new Date().toISOString(), tarea, modelo, tokens_entrada: tokens_entrada ?? 0, tokens_salida: tokens_salida ?? 0, coste: Math.round(coste * 1e6) / 1e6 });
store.save(st);
return ok({ coste_llamada: Math.round(coste * 1e6) / 1e6, moneda: "USD (aprox)" });
  }
);

server.tool(
  "report",
  "Reporte de gastos: total, por tarea, por modelo y alerta si supera el presupuesto configurado.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const gastos: any[] = st.gastos || [];
const por_tarea: any = {}; const por_modelo: any = {};
let total = 0;
for (const g of gastos) { por_tarea[g.tarea] = (por_tarea[g.tarea] || 0) + g.coste; por_modelo[g.modelo] = (por_modelo[g.modelo] || 0) + g.coste; total += g.coste; }
const presupuesto = st.presupuesto ?? null;
return ok({ total_usd: Math.round(total * 10000) / 10000, llamadas: gastos.length, por_tarea, por_modelo, presupuesto, sobre_presupuesto: presupuesto ? total > presupuesto : false, tokens_totales: gastos.reduce((a, g) => a + g.tokens_entrada + g.tokens_salida, 0) });
  }
);

server.tool(
  "set_budget",
  "Define el presupuesto máximo en USD y precios custom por modelo.",
  {
  presupuesto_usd: z.number().describe("Presupuesto máximo"),
  precios_custom: z.any().describe("{modelo: [precio_entrada, precio_salida] por 1k tokens}").optional(),
  },
  async (args: any) => {
    const { presupuesto_usd, precios_custom } = args as any;
    const st = store.load();
st.presupuesto = presupuesto_usd;
if (precios_custom && typeof precios_custom === "object") { st.precios_custom = { ...(st.precios_custom || {}), ...precios_custom }; }
store.save(st);
return ok({ presupuesto: st.presupuesto, precios_custom: st.precios_custom });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor cost-tracker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "cost-tracker", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[cost-tracker] fatal:", e);
  process.exit(1);
});

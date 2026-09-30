#!/usr/bin/env node
/**
 * MCP Server: Cost Attribution
 * Atribuye cada dólar a cliente/proyecto/agente: el gasto deja de ser un agujero negro global
 *
 * Dolor que resuelve: El costo de agentes se contabiliza como una sola línea global: ningún cliente/proyecto sabe cuánto consume realmente, así que nadie optimiza y el margen se evapora sin responsable.
 * Categoría: Economía del Agente | Generado por mcp-suite | id: cost-attribution
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

// ——— persistencia local: ~/.mcp-suite/cost-attribution/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "cost-attribution");
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

const server = new McpServer({ name: "cost-attribution", version: "1.0.0" });

server.tool(
  "tag_spend",
  "Registra un gasto atribuido: cliente, proyecto, agente, concepto e importe.",
  {
  cliente: z.string().describe("Cliente o 'interno'"),
  proyecto: z.string().describe("Proyecto"),
  agente: z.string().describe("Agente que gastó"),
  concepto: z.string().describe("Concepto (llm, tool, api)"),
  usd: z.number().describe("Importe"),
  entregable: z.string().describe("Entregable al que contribuye").optional(),
  },
  async (args: any) => {
    const { cliente, proyecto, agente, concepto, usd, entregable } = args as any;
    const st = store.load();
st.gastos = st.gastos || [];
st.gastos.push({ cliente, proyecto, agente, concepto, usd, entregable: entregable || null, ts: new Date().toISOString() });
store.save(st);
return ok({ registrado: true, usd, cliente });
  }
);

server.tool(
  "attribution_report",
  "Reparto del gasto por cliente, proyecto y agente con top consumidores.",
  {
  desde: z.string().describe("Fecha ISO de inicio (opcional)").optional(),
  },
  async (args: any) => {
    const { desde } = args as any;
    const st = store.load();
let gs = st.gastos || [];
if (desde) { const c = new Date(desde).getTime(); if (!isNaN(c)) gs = gs.filter(g => new Date(g.ts).getTime() >= c); }
if (!gs.length) return ok({ gastos: 0, sugerencia: "registra gastos con tag_spend" });
const por = (campo) => {
  const acc = {};
  for (const g of gs) acc[g[campo]] = Number(((acc[g[campo]] || 0) + g.usd).toFixed(4));
  return __ents(acc).map(([k, v]) => ({ [campo]: k, usd: Number(v.toFixed(2)) })).sort((a, b) => b.usd - a.usd);
};
const total = gs.reduce((s, g) => s + g.usd, 0);
return ok({
  total_usd: Number(total.toFixed(2)),
  por_cliente: por("cliente"),
  por_proyecto: por("proyecto"),
  por_agente: por("agente"),
  por_concepto: por("concepto"),
  cliente_mas_caro: por("cliente")[0],
});
  }
);

server.tool(
  "margin_check",
  "Compara costo atribuido contra ingresos por cliente: ¿a quién le estás perdiendo dinero?",
  {
  ingresos: z.any().describe("Mapa {cliente: ingreso_usd}"),
  },
  async (args: any) => {
    const { ingresos } = args as any;
    const st = store.load();
const gs = st.gastos || [];
const ing = ingresos || {};
if (typeof ing !== "object") return fail("ingresos debe ser un mapa {cliente: usd}");
const costos = {};
for (const g of gs) costos[g.cliente] = Number(((costos[g.cliente] || 0) + g.usd).toFixed(4));
const clientes = [...new Set([...Object.keys(ing), ...Object.keys(costos)])];
const filas = clientes.map(c => {
  const i = Number(ing[c]) || 0;
  const costo = costos[c] || 0;
  return { cliente: c, ingreso: i, costo: Number(costo.toFixed(2)), margen: Number((i - costo).toFixed(2)), margen_pct: i ? Number(((i - costo) / i * 100).toFixed(1)) : null };
}).sort((a, b) => (a.margen ?? -Infinity) - (b.margen ?? -Infinity));
return ok({
  clientes: filas.length,
  filas,
  en_perdida: filas.filter(f => f.margen < 0).map(f => f.cliente),
  consejo: filas.some(f => f.margen < 0) ? "hay clientes con costo > ingreso: sube precio, recorta alcance o migra a modelos más baratos (model-router-econ)" : "todos contribuyen margen positivo",
});
  }
);

server.tool(
  "cost_per_deliverable",
  "Costo total por entregable (suma de gastos etiquetados) para precio y estimación futura.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const gs = (st.gastos || []).filter(g => g.entregable);
if (!gs.length) return ok({ entregables: 0, sugerencia: "etiqueta gastos con 'entregable' para esta vista" });
const acc = {};
for (const g of gs) acc[g.entregable] = Number(((acc[g.entregable] || 0) + g.usd).toFixed(4));
const filas = __ents(acc).map(([e, v]) => ({ entregable: e, costo_usd: Number(v.toFixed(2)) })).sort((a, b) => b.costo_usd - a.costo_usd);
const media = filas.reduce((s, f) => s + f.costo_usd, 0) / filas.length;
return ok({
  entregables: filas.length,
  costo_medio: Number(media.toFixed(2)),
  filas: filas.slice(0, 15),
  para_pricing: "cobra >= 3x el costo de entregable para cubrir overhead y margen",
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor cost-attribution está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "cost-attribution", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[cost-attribution] fatal:", e);
  process.exit(1);
});

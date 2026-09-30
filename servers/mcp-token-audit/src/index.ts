#!/usr/bin/env node
/**
 * MCP Server: Token Audit
 * Auditoría de a dónde van los tokens: qué consumió el contexto, la retrieval y las tools
 *
 * Dolor que resuelve: El 60-70% de los tokens se gastan en cosas que no aportan: historial rancio, retrieval excesiva, salidas de tools gigantes. Sin auditoría por partida, no hay forma de recortar con criterio.
 * Categoría: Economía del Agente | Generado por mcp-suite | id: token-audit
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

// ——— persistencia local: ~/.mcp-suite/token-audit/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "token-audit");
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

const server = new McpServer({ name: "token-audit", version: "1.0.0" });

server.tool(
  "log_usage",
  "Registra el consumo de tokens de una interacción, desglosado por partida.",
  {
  interaccion: z.string().describe("ID o descripción de la interacción"),
  system: z.number().describe("Tokens de system prompt").default(0),
  historial: z.number().describe("Tokens de historial/conversación").default(0),
  retrieval: z.number().describe("Tokens de contexto recuperado").default(0),
  tools_entrada: z.number().describe("Tokens de resultados de tools hacia el modelo").default(0),
  output: z.number().describe("Tokens generados").default(0),
  overhead: z.number().describe("Otros (formato, fences...)").default(0),
  },
  async (args: any) => {
    const { interaccion, system, historial, retrieval, tools_entrada, output, overhead } = args as any;
    const st = store.load();
st.log = st.log || [];
const partidas = { system: system || 0, historial: historial || 0, retrieval: retrieval || 0, tools_entrada: tools_entrada || 0, output: output || 0, overhead: overhead || 0 };
const total = __vals(partidas).reduce((a, b) => a + b, 0);
if (total === 0) return fail("todas las partidas en cero: nada que auditar");
st.log.push({ interaccion, partidas, total, ts: new Date().toISOString() });
if (st.log.length > 2000) st.log = st.log.slice(-1500);
store.save(st);
return ok({ interaccion, total, reparto_pct: Object.fromEntries(__ents(partidas).map(([k, v]) => [k, Number((v / total * 100).toFixed(1))])) });
  }
);

server.tool(
  "audit_report",
  "Reporte de reparto agregado: % medio por partida y tendencias (¿el historial crece sin control?).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const log = st.log || [];
if (!log.length) return ok({ interacciones: 0, sugerencia: "registra usos con log_usage" });
const sumas = { system: 0, historial: 0, retrieval: 0, tools_entrada: 0, output: 0, overhead: 0 };
const total = log.reduce((s, e) => s + e.total, 0);
for (const e of log) for (const [k, v] of __ents(e.partidas)) sumas[k] += v;
const mitad = Math.floor(log.length / 2);
const mediaPrimera = log.slice(0, mitad).reduce((s, e) => s + e.partidas.historial, 0) / Math.max(mitad, 1);
const mediaSegunda = log.slice(mitad).reduce((s, e) => s + e.partidas.historial, 0) / Math.max(log.length - mitad, 1);
return ok({
  interacciones: log.length,
  tokens_totales: total,
  reparto_pct: Object.fromEntries(__ents(sumas).map(([k, v]) => [k, Number((v / total * 100).toFixed(1))])),
  tokens_medios_por_interaccion: Math.round(total / log.length),
  crecimiento_historial: Number((((mediaSegunda - mediaPrimera) / Math.max(mediaPrimera, 1)) * 100).toFixed(1)) + "%",
  recortables: [
    ...(sumas.historial / total > 0.35 ? ["historial > 35%: comprime/resume turnos viejos (context-compressor)"] : []),
    ...(sumas.retrieval / total > 0.30 ? ["retrieval > 30%: sube el umbral de relevancia o chunk más fino"] : []),
    ...(sumas.tools_entrada / total > 0.30 ? ["resultados de tools > 30%: recorta salidas de tools (response-size-guard)"] : []),
    ...(sumas.system / total > 0.25 ? ["system prompt > 25%: es estático, revisa si todo es necesario"] : []),
  ],
  ahorro_estimado: "recortando las partidas marcadas a niveles sanos ahorras ~" + Math.round(Math.max(0, sumas.historial - total * 0.25) + Math.max(0, sumas.retrieval - total * 0.2) + Math.max(0, sumas.tools_entrada - total * 0.2)) + " tokens (" + Math.round((Math.max(0, sumas.historial - total * 0.25) + Math.max(0, sumas.retrieval - total * 0.2) + Math.max(0, sumas.tools_entrada - total * 0.2)) / total * 100) + "%)",
});
  }
);

server.tool(
  "outlier_interactions",
  "Detecta interacciones anómalamente caras (muchos más tokens que la media) para autopsiarlas.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const log = st.log || [];
if (log.length < 5) return fail("necesitas >=5 interacciones");
const totales = log.map(e => e.total).sort((a, b) => a - b);
const mediana = totales[Math.floor(totales.length / 2)];
const umbral = mediana * 2.5;
const anomalias = log.filter(e => e.total > umbral);
return ok({
  mediana_tokens: mediana,
  umbral_anomalia: Math.round(umbral),
  anomalias: anomalias.length,
  detalle: anomalias.slice(-8).map(e => ({ interaccion: e.interaccion, total: e.total, peor_partida: __ents(e.partidas).sort((a, b) => b[1] - a[1])[0].join(": ") })),
  consejo: anomalias.length > log.length * 0.1 ? "más del 10% de interacciones son outliers: hay un patrón, no mala suerte" : "outliers puntuales",
});
  }
);

server.tool(
  "simulate_cut",
  "Simula el ahorro de recortar una partida a un % objetivo antes de aplicarlo.",
  {
  partida: z.enum(["system","historial","retrieval","tools_entrada","overhead"]).describe("Partida a recortar"),
  objetivo_pct: z.number().describe("% del total al que quieres llevarla"),
  },
  async (args: any) => {
    const { partida, objetivo_pct } = args as any;
    const st = store.load();
const log = st.log || [];
if (!log.length) return fail("sin datos registrados");
if (objetivo_pct < 0 || objetivo_pct > 100) return fail("objetivo_pct 0-100");
const total = log.reduce((s, e) => s + e.total, 0);
const actual = log.reduce((s, e) => s + (e.partidas[partida] || 0), 0);
const actualPct = actual / total * 100;
if (actualPct <= objetivo_pct) return ok({ partida, pct_actual: Number(actualPct.toFixed(1)), mensaje: "ya está en o bajo el objetivo: nada que recortar" });
const objetivoAbs = total * objetivo_pct / 100;
return ok({
  partida, pct_actual: Number(actualPct.toFixed(1)), pct_objetivo: objetivo_pct,
  tokens_a_ahorrar: Math.round(actual - objetivoAbs),
  ahorro_pct_del_total: Number(((actual - objetivoAbs) / total * 100).toFixed(1)),
  como: {
    historial: "resume turnos viejos y conserva solo decisiones y hechos",
    retrieval: "sube umbral de similitud / limita top-k / chunks más pequeños",
    tools_entrada: "pide salidas resumidas o estructuradas a las tools",
    system: "elimina instrucciones redundantes o muévelas a tool descriptions",
    overhead: "reduce fences, relleno y formatos repetitivos",
  }[partida],
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor token-audit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "token-audit", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[token-audit] fatal:", e);
  process.exit(1);
});

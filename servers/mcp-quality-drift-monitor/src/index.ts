#!/usr/bin/env node
/**
 * MCP Server: Quality Drift Monitor
 * Vigila la tendencia de calidad del agente en el tiempo: detecta empeoramiento gradual antes del cliente
 *
 * Dolor que resuelve: La calidad del agente no cae de golpe: baja 2% cada semana (cambio de datos, deriva de contexto) y nadie lo nota hasta que el cliente grita. Falta un monitor de tendencia con alertas.
 * Categoría: Evaluación Continua | Generado por mcp-suite | id: quality-drift-monitor
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

// ——— persistencia local: ~/.mcp-suite/quality-drift-monitor/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "quality-drift-monitor");
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

const server = new McpServer({ name: "quality-drift-monitor", version: "1.0.0" });

server.tool(
  "record_score",
  "Registra un punto de calidad: score 0-100 con etiqueta y contexto opcional.",
  {
  score: z.number().describe("Puntuación 0-100"),
  etiqueta: z.string().describe("Etiqueta/dimensión (ej: respuestas, extraccion)").default("general"),
  contexto: z.string().describe("Contexto del punto (qué tarea/caso)").optional(),
  },
  async (args: any) => {
    const { score, etiqueta, contexto } = args as any;
    if (score < 0 || score > 100) return fail("score debe estar 0-100");
const st = store.load();
st.series = st.series || {};
st.series[etiqueta] = st.series[etiqueta] || [];
st.series[etiqueta].push({ score, contexto: contexto || null, ts: new Date().toISOString() });
store.save(st);
return ok({ etiqueta, puntos: st.series[etiqueta].length });
  }
);

server.tool(
  "trend",
  "Tendencia de una etiqueta: pendiente por semana, media móvil 7 y comparación primer/último tercio.",
  {
  etiqueta: z.string().describe("Etiqueta a analizar").default("general"),
  },
  async (args: any) => {
    const { etiqueta } = args as any;
    const st = store.load();
const pts = (st.series || {})[etiqueta] || [];
if (pts.length < 5) return ok({ etiqueta, puntos: pts.length, tendencia: "insuficiente (mínimo 5 puntos)" });
const xs = pts.map(p => new Date(p.ts).getTime());
const ys = pts.map(p => p.score);
const n = pts.length;
const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
let num = 0, den = 0;
for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
const pendienteMs = den ? num / den : 0;
const semanaMs = 7 * 86400000;
const pendienteSemanal = Number((pendienteMs * semanaMs).toFixed(2));
const mm7 = ys.slice(-7);
const mediaMovil = Number((mm7.reduce((a, b) => a + b, 0) / mm7.length).toFixed(1));
const t1 = Math.floor(n / 3), t3 = n - t1;
const mediaPrimerTercio = ys.slice(0, t1).reduce((a, b) => a + b, 0) / t1;
const mediaUltimoTercio = ys.slice(t3).reduce((a, b) => a + b, 0) / (n - t3);
return ok({
  etiqueta, puntos: n,
  pendiente_por_semana: pendienteSemanal,
  media_movil_7: mediaMovil,
  comparacion_tercios: { primer: Number(mediaPrimerTercio.toFixed(1)), ultimo: Number(mediaUltimoTercio.toFixed(1)), delta: Number((mediaUltimoTercio - mediaPrimerTercio).toFixed(1)) },
  veredicto: pendienteSemanal < -1 ? "DERRUMBE: calidad cayendo " + pendienteSemanal + " pts/semana: investiga YA (datos, prompt, contexto)" : pendienteSemanal < -0.3 ? "erosión leve: vigila" : pendienteSemanal > 0.5 ? "mejorando" : "estable",
});
  }
);

server.tool(
  "drift_alerts",
  "Revisa todas las etiquetas y devuelve alertas de drift (umbrales configurables).",
  {
  umbral_pendiente: z.number().describe("Pendiente semanal que dispara alerta (negativa)").default(-1),
  min_puntos: z.number().describe("Puntos mínimos para evaluar").default(5),
  },
  async (args: any) => {
    const { umbral_pendiente, min_puntos } = args as any;
    const st = store.load();
const series = st.series || {};
const alertas = [];
for (const [etq, pts] of __ents(series)) {
  if (pts.length < min_puntos) continue;
  const xs = pts.map(p => new Date(p.ts).getTime());
  const ys = pts.map(p => p.score);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const pendiente = den ? (num / den) * 7 * 86400000 : 0;
  if (pendiente < umbral_pendiente) alertas.push({ etiqueta: etq, pendiente_semanal: Number(pendiente.toFixed(2)), puntos: n, score_reciente: ys[n - 1] });
}
return ok({
  etiquetas_monitoreadas: Object.keys(series).length,
  alertas: alertas.length,
  detalle: alertas.sort((a, b) => a.pendiente_semanal - b.pendiente_semanal),
  accion: alertas.length ? "para cada alerta: revisa qué cambió (prompt/modelo/datos) cerca del inicio del declive" : "sin drift activo",
});
  }
);

server.tool(
  "compare_period",
  "Compara dos periodos de una etiqueta (antes vs después de una fecha) con significancia aproximada.",
  {
  etiqueta: z.string().describe("Etiqueta").default("general"),
  fecha_corte: z.string().describe("Fecha ISO de corte"),
  },
  async (args: any) => {
    const { etiqueta, fecha_corte } = args as any;
    const st = store.load();
const pts = (st.series || {})[etiqueta] || [];
const corte = new Date(fecha_corte).getTime();
if (isNaN(corte)) return fail("fecha_corte inválida");
const antes = pts.filter(p => new Date(p.ts).getTime() < corte);
const despues = pts.filter(p => new Date(p.ts).getTime() >= corte);
if (antes.length < 3 || despues.length < 3) return fail("necesitas >=3 puntos por periodo (antes: " + antes.length + ", después: " + despues.length + ")");
const media = (arr) => arr.reduce((s, p) => s + p.score, 0) / arr.length;
const varr = (arr, m) => arr.reduce((s, p) => s + (p.score - m) ** 2, 0) / (arr.length - 1 || 1);
const mA = media(antes), mD = media(despues);
const sA = Math.sqrt(varr(antes, mA)), sD = Math.sqrt(varr(despues, mD));
const t = (mD - mA) / Math.sqrt(sA / antes.length + sD / despues.length);
return ok({
  etiqueta, corte: fecha_corte,
  antes: { n: antes.length, media: Number(mA.toFixed(1)), sd: Number(sA.toFixed(1)) },
  despues: { n: despues.length, media: Number(mD.toFixed(1)), sd: Number(sD.toFixed(1)) },
  delta: Number((mD - mA).toFixed(1)),
  t_aprox: Number(t.toFixed(2)),
  lectura: Math.abs(t) > 2 ? "cambio SIGNIFICATIVO tras el corte" : Math.abs(t) > 1 ? "cambio sugestivo, no concluyente" : "sin cambio detectable",
});
  }
);

server.tool(
  "series_report",
  "Reporte de todas las series: puntos, media actual y mini-sparkline ASCII por etiqueta.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const series = st.series || {};
const salida = {};
for (const [etq, pts] of __ents(series)) {
  const ys = pts.map(p => p.score);
  const bloques = 24;
  const chars = "▁▂▃▄▅▆▇█";
  let spark = "";
  if (ys.length > 1) {
    const paso = ys.length / bloques;
    for (let i = 0; i < bloques; i++) {
      const v = ys[Math.min(ys.length - 1, Math.floor(i * paso))];
      spark += chars[Math.min(7, Math.floor(v / 100 * 8))];
    }
  }
  salida[etq] = { puntos: ys.length, media: Number((ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(1)), sparkline: spark };
}
return ok({ etiquetas: Object.keys(series).length, series: salida });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor quality-drift-monitor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "quality-drift-monitor", tools: 6, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[quality-drift-monitor] fatal:", e);
  process.exit(1);
});

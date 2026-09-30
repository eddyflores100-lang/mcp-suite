#!/usr/bin/env node
/**
 * MCP Server: Drift Detector
 * Detecta cuándo el trabajo del agente se desvió del objetivo original (score de deriva por decisión)
 *
 * Dolor que resuelve: El drift es incremental e invisible: cada decisión parece razonable localmente, pero a las 40 decisiones el agente trabaja en algo distinto al encargo original y nadie supo cuándo torció.
 * Categoría: Objetivos y Largo Plazo | Generado por mcp-suite | id: drift-detector
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

// ——— persistencia local: ~/.mcp-suite/drift-detector/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "drift-detector");
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

const server = new McpServer({ name: "drift-detector", version: "1.0.0" });

server.tool(
  "set_reference",
  "Fija la referencia contra la que se mide toda deriva (encargo original, literal).",
  {
  encargo: z.string().describe("Texto literal del encargo original"),
  restricciones: z.array(z.any()).describe("Límites originales").default([]),
  },
  async (args: any) => {
    const { encargo, restricciones } = args as any;
    const st = store.load();
st.referencia = { encargo, restricciones: restricciones || [], fijada: new Date().toISOString(), decisiones: [] };
store.save(st);
return ok({ referencia_fijada: true, encargo: encargo.slice(0, 100), restricciones: (restricciones || []).length });
  }
);

server.tool(
  "log_decision",
  "Registra una decisión del agente con justificación; devuelve la deriva individual frente al encargo.",
  {
  decision: z.string().describe("Qué se decidió hacer"),
  justificacion: z.string().describe("Por qué (debería citar el encargo)"),
  etiqueta: z.string().describe("Etiqueta de fase (ej: research, build)").optional(),
  },
  async (args: any) => {
    const { decision, justificacion, etiqueta } = args as any;
    const st = store.load();
if (!st.referencia) return fail("fija la referencia con set_reference primero");
const stop = (s) => new Set(String(s).toLowerCase().split(/\W+/).filter(w => w.length > 3));
const refTokens = stop(st.referencia.encargo + " " + st.referencia.restricciones.join(" "));
const decTokens = [...stop(decision + " " + justificacion)];
const eco = decTokens.filter(w => refTokens.has(w)).length / Math.max(decTokens.length, 1);
const deriva = Number((1 - eco).toFixed(2));
st.referencia.decisiones.push({ n: st.referencia.decisiones.length + 1, decision, justificacion, etiqueta: etiqueta || null, deriva, ts: new Date().toISOString() });
store.save(st);
return ok({
  decision_n: st.referencia.decisiones.length, deriva_individual: deriva,
  estado: deriva > 0.75 ? "ROJA: esta decisión ya no habla del encargo" : deriva > 0.5 ? "AMARILLA: justifica la conexión" : "verde",
});
  }
);

server.tool(
  "drift_report",
  "Reporte de deriva acumulada: tendencia por ventana de 5 decisiones, punto de inflexión y fase donde torció.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
if (!st.referencia?.decisiones?.length) return fail("sin decisiones registradas");
const ds = st.referencia.decisiones.map(d => d.deriva);
const media = ds.reduce((a, b) => a + b, 0) / ds.length;
const ventanas = [];
for (let i = 0; i + 5 <= ds.length; i += 5) ventanas.push({ desde: i + 1, hasta: i + 5, deriva_media: Number((ds.slice(i, i + 5).reduce((a, b) => a + b, 0) / 5).toFixed(2)) });
let inflexion = null;
for (let i = 1; i < ds.length; i++) if (ds[i] - ds[i - 1] > 0.25 && ds[i] > 0.6) { inflexion = { decision_n: i + 1, salto: Number((ds[i] - ds[i - 1]).toFixed(2)), decision: st.referencia.decisiones[i].decision }; break; }
const ultimas5 = ds.slice(-5);
const tendencia = ultimas5.length ? (ultimas5[ultimas5.length - 1] - ultimas5[0]) / Math.max(ultimas5.length - 1, 1) : 0;
return ok({
  decisiones: ds.length, deriva_media: Number(media.toFixed(2)), deriva_actual: ds[ds.length - 1],
  tendencia_reciente: Number(tendencia.toFixed(3)),
  ventanas, punto_inflexion: inflexion,
  veredicto: media > 0.6 ? "DERIVA GRAVE: vuelve al encargo literal (" + st.referencia.encargo.slice(0, 80) + "...)" : media > 0.45 ? "deriva moderada: re-ancla justificando cada decisión con el encargo" : "trayectoria fiel",
});
  }
);

server.tool(
  "re_anchor",
  "Re-ancla al agente: devuelve el encargo literal + las últimas decisiones desviadas + plantilla de corrección.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
if (!st.referencia) return fail("sin referencia");
const ds = st.referencia.decisiones;
const desviadas = [...ds].reverse().filter(d => d.deriva > 0.6).slice(0, 5).reverse();
return ok({
  encargo_original: st.referencia.encargo,
  restricciones: st.referencia.restricciones,
  decisiones_desviadas_recientes: desviadas.map(d => ({ n: d.n, decision: d.decision, deriva: d.deriva })),
  plantilla_correccion: "Para cada decisión desviada decide: (a) descártala, (b) conéctala explícitamente al encargo, o (c) propone enmienda formal al humano. Después registra las correcciones con log_decision.",
  criterio: "una decisión sin conexión lexical NI lógica al encargo es deuda de deriva",
});
  }
);

server.tool(
  "drift_stats",
  "Estadísticas históricas de deriva por fase/etiqueta: dónde tiende a torcer este agente.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const ds = st.referencia?.decisiones || [];
if (!ds.length) return ok({ decisiones: 0 });
const porEtiqueta = {};
for (const d of ds) {
  const k = d.etiqueta || "sin-etiqueta";
  porEtiqueta[k] = porEtiqueta[k] || { n: 0, suma: 0 };
  porEtiqueta[k].n++; porEtiqueta[k].suma += d.deriva;
}
return ok({
  decisiones: ds.length,
  deriva_por_fase: Object.fromEntries(__ents(porEtiqueta).map(([k, v]) => [k, { decisiones: v.n, deriva_media: Number((v.suma / v.n).toFixed(2)) }])),
  fase_mas_propensa: __ents(porEtiqueta).map(([k, v]: [string, any]) => ({ k, r: v.suma / v.n })).sort((a, b) => b.r - a.r)[0].k,
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor drift-detector está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "drift-detector", tools: 6, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[drift-detector] fatal:", e);
  process.exit(1);
});

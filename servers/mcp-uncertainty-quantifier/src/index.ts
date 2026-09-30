#!/usr/bin/env node
/**
 * MCP Server: Uncertainty Quantifier
 * Cuantifica la confianza del agente: estimaciones con rangos y calibración Brier
 *
 * Dolor que resuelve: El agente expresa certeza binaria (sí/no) en vez de probabilidades: sin calibración, la confianza no significa nada.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: uncertainty-quantifier
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

// ——— persistencia local: ~/.mcp-suite/uncertainty-quantifier/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "uncertainty-quantifier");
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

const server = new McpServer({ name: "uncertainty-quantifier", version: "1.0.0" });

server.tool(
  "estimate_confidence",
  "Convierte una creencia verbal (seguro/probable/quizás) en probabilidad con rango, y valida coherencia.",
  {
  afirmacion: z.string().describe("La afirmación a cuantificar"),
  nivel_verbal: z.enum(["seguro","muy-probable","probable","posible","improbable","casi-imposible"]).describe("Nivel verbal de confianza"),
  evidencia_items: z.number().describe("Cuántas evidencias independientes tienes").default(0),
  },
  async (args: any) => {
    const { afirmacion, nivel_verbal, evidencia_items } = args as any;
    const tabla: any = { "seguro": [0.95, 0.99], "muy-probable": [0.8, 0.9], "probable": [0.6, 0.75], "posible": [0.4, 0.6], "improbable": [0.1, 0.25], "casi-imposible": [0.01, 0.05] };
const [lo, hi] = tabla[nivel_verbal] || tabla.posible;
const evid = evidencia_items ?? 0;
let ajuste = 1;
if (evid === 0) ajuste = 0.7; else if (evid <= 2) ajuste = 0.85;
const punto = Math.max(0.01, Math.min(0.99, ((lo + hi) / 2) * ajuste));
return ok({ afirmacion: afirmacion.slice(0, 100), nivel_verbal, probabilidad_puntual: Math.round(punto * 100) + "%", rango: [Math.round(lo * ajuste * 100) + "%", Math.round(hi * ajuste * 100) + "%"], penalizacion_evidencia: evid === 0 ? "sin evidencia: confianza reducida 30%" : evid <= 2 ? "poca evidencia: reducida 15%" : "sin penalización", accion: punto < 0.6 ? "reúne más evidencia antes de actuar" : "suficiente para proceder con monitoreo" });
  }
);

server.tool(
  "calibrate",
  "Calibra tu confianza histórica: registra predicciones con probabilidad y outcomes; calcula score de Brier (menor = mejor).",
  {
  prediccion: z.string().describe("La predicción").optional(),
  probabilidad: z.number().describe("Probabilidad estimada 0-1").optional(),
  ocurrio: z.boolean().describe("¿Ocurrió? (para resolver una predicción previa)").optional(),
  },
  async (args: any) => {
    const { prediccion, probabilidad, ocurrio } = args as any;
    const st = store.load();
st.predicciones = st.predicciones || [];
if (prediccion && probabilidad !== undefined) {
  st.predicciones.push({ texto: prediccion, p: probabilidad, resuelta: null, ts: new Date().toISOString() });
  store.save(st);
  return ok({ registrada: true, pendientes: st.predicciones.filter((x) => x.resuelta === null).length });
}
if (ocurrio !== undefined) {
  const pend = st.predicciones.find((x) => x.resuelta === null);
  if (!pend) return fail("sin predicciones pendientes");
  pend.resuelta = ocurrio;
  store.save(st);
}
const resueltas = st.predicciones.filter((x) => x.resuelta !== null);
if (!resueltas.length) return fail("sin predicciones resueltas para calibrar");
const brier = resueltas.reduce((a: number, p: any) => a + (p.p - (p.resuelta ? 1 : 0)) ** 2, 0) / resueltas.length;
return ok({ resueltas: resueltas.length, brier_score: Math.round(brier * 1000) / 1000, interpretacion: brier < 0.1 ? "calibración excelente" : brier < 0.25 ? "calibración decente" : brier < 0.33 ? "mejor que azar apenas" : "peor que azar: revisa tus sesgos", pendientes: st.predicciones.filter((x) => x.resuelta === null).map((x) => x.texto.slice(0, 80)) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor uncertainty-quantifier está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "uncertainty-quantifier", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[uncertainty-quantifier] fatal:", e);
  process.exit(1);
});

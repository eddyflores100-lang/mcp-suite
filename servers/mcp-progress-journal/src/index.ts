#!/usr/bin/env node
/**
 * MCP Server: Progress Journal
 * Diario de progreso con narrativa continua: qué se hizo, qué se intentó y falló, y dónde quedó
 *
 * Dolor que resuelve: Tras horas de trabajo el agente no puede responder '¿qué has hecho?': los intentos fallidos no se registran y el contexto se comprime perdiendo el rastro de lo ya intentado.
 * Categoría: Objetivos y Largo Plazo | Generado por mcp-suite | id: progress-journal
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

// ——— persistencia local: ~/.mcp-suite/progress-journal/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "progress-journal");
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

const server = new McpServer({ name: "progress-journal", version: "1.0.0" });

server.tool(
  "add_entry",
  "Añade una entrada al diario: tipo (progreso, experimento, decision, bloqueo, hallazgo) y narrativa.",
  {
  tipo: z.enum(["progreso","experimento","decision","bloqueo","hallazgo"]).describe("Tipo de entrada"),
  titulo: z.string().describe("Título corto"),
  detalle: z.string().describe("Narrativa completa: qué, cómo, resultado"),
  etiquetas: z.array(z.any()).describe("Etiquetas").default([]),
  exito: z.boolean().describe("Solo experimentos: ¿funcionó?").optional(),
  },
  async (args: any) => {
    const { tipo, titulo, detalle, etiquetas, exito } = args as any;
    const st = store.load();
st.entradas = st.entradas || [];
st.entradas.push({ n: st.entradas.length + 1, tipo, titulo, detalle, etiquetas: etiquetas || [], exito: exito ?? null, ts: new Date().toISOString() });
store.save(st);
return ok({ entrada_n: st.entradas.length, tipo });
  }
);

server.tool(
  "recent",
  "Últimas N entradas con filtro por tipo; incluye el resumen ejecutivo del estado.",
  {
  n: z.number().describe("Cuántas entradas").default(10),
  tipo: z.string().describe("Filtrar por tipo").optional(),
  },
  async (args: any) => {
    const { n, tipo } = args as any;
    const st = store.load();
let es = st.entradas || [];
if (tipo) es = es.filter(e => e.tipo === tipo);
const ultimas = es.slice(-Math.max(1, Math.min(n, 50)));
const hoy = (new Date()).toISOString().slice(0, 10);
const deHoy = (st.entradas || []).filter(e => e.ts.slice(0, 10) === hoy);
return ok({
  total: (st.entradas || []).length, hoy: deHoy.length,
  resumen_ejecutivo: {
    progreso_total: (st.entradas || []).filter(e => e.tipo === "progreso").length,
    experimentos_fallidos: (st.entradas || []).filter(e => e.tipo === "experimento" && e.exito === false).length,
    decisiones: (st.entradas || []).filter(e => e.tipo === "decision").length,
    bloqueos_abiertos: (st.entradas || []).filter(e => e.tipo === "bloqueo").length,
  },
  entradas: ultimas.reverse().map(e => ({ n: e.n, ts: e.ts, tipo: e.tipo, titulo: e.titulo, exito: e.exito })),
});
  }
);

server.tool(
  "stall_detector",
  "Detecta estancamiento: mismo tipo de bloqueo repetido o días sin entradas de progreso.",
  {
  dias_umbral: z.number().describe("Días sin progreso para alertar").default(2),
  },
  async (args: any) => {
    const { dias_umbral } = args as any;
    const st = store.load();
const es = st.entradas || [];
if (!es.length) return ok({ entradas: 0 });
const bloqueos = es.filter(e => e.tipo === "bloqueo");
const titulos = {};
for (const b of bloqueos) {
  const k = b.titulo.toLowerCase().split(/\W+/).filter(w => w.length > 3).sort().join("_");
  titulos[k] = titulos[k] || [];
  titulos[k].push(b);
}
const repetidos = __ents(titulos).filter(([, v]) => v.length >= 2).map(([k, v]) => ({ patron: v[0].titulo, veces: v.length, primera: v[0].ts, ultima: v[v.length - 1].ts }));
const ultimoProgreso = [...es].reverse().find(e => e.tipo === "progreso");
const diasSinProgreso = ultimoProgreso ? Number(((Date.now() - new Date(ultimoProgreso.ts).getTime()) / 86400000).toFixed(1)) : null;
return ok({
  bloqueos_repetidos: repetidos,
  dias_sin_progreso: diasSinProgreso,
  estancado: repetidos.length > 0 || (diasSinProgreso !== null && diasSinProgreso > dias_umbral),
  consejo: repetidos.length ? "mismo bloqueo " + repetidos[0].veces + " veces: cambia de ESTRATEGIA, no de intento" : (diasSinProgreso > dias_umbral ? "sin progreso real en " + diasSinProgreso + " días: replantea" : "avanzando"),
});
  }
);

server.tool(
  "narrative",
  "Genera la narrativa continua del trabajo (para handoffs o reportes): cronología comprimida agrupada por día.",
  {
  desde_entrada: z.number().describe("Número de entrada inicial").default(1),
  },
  async (args: any) => {
    const { desde_entrada } = args as any;
    const st = store.load();
const es = (st.entradas || []).filter(e => e.n >= desde_entrada);
if (!es.length) return fail("no hay entradas desde la " + desde_entrada);
const porDia = {};
for (const e of es) {
  const d = e.ts.slice(0, 10);
  porDia[d] = porDia[d] || [];
  porDia[d].push(e);
}
const narrativa = __ents(porDia).map(([d, items]) => ({
  dia: d,
  lineas: items.map(e => "- [" + e.tipo + (e.exito !== null ? ":" + (e.exito ? "ok" : "fallo") : "") + "] " + e.titulo + ": " + e.detalle.slice(0, 160)),
}));
return ok({ desde: desde_entrada, hasta: es[es.length - 1].n, dias: narrativa.length, narrativa });
  }
);

server.tool(
  "experiments_recap",
  "Balance de experimentos: qué se probó, qué funcionó y tasa de acierto global.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const exps = (st.entradas || []).filter(e => e.tipo === "experimento");
if (!exps.length) return ok({ experimentos: 0 });
const okExps = exps.filter(e => e.exito === true);
const fallos = exps.filter(e => e.exito === false);
return ok({
  experimentos: exps.length,
  aciertos: okExps.length, fallos: fallos.length,
  tasa_acierto: Number((okExps.length / exps.length).toFixed(2)),
  que_funciono: okExps.map(e => e.titulo),
  que_fallo: fallos.map(e => ({ titulo: e.titulo, leccion: e.detalle.slice(0, 140) })),
  consejo: fallos.length > 2 * okExps.length ? "tasa de acierto baja: reformula las hipótesis antes del siguiente intento" : "ritmo experimental sano",
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor progress-journal está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "progress-journal", tools: 6, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[progress-journal] fatal:", e);
  process.exit(1);
});

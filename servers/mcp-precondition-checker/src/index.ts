#!/usr/bin/env node
/**
 * MCP Server: Precondition Checker
 * Puerta de arranque: todas las precondiciones del plan verificadas con evidencia antes de gastar un solo token
 *
 * Dolor que resuelve: El agente arranca una tarea de 40 pasos y en el 35 descubre que le faltaba una credencial que se pide en el paso 1: media hora y un montón de tokens tirados a la basura por no chequear antes.
 * Categoría: Pre-Vuelo | Generado por mcp-suite | id: precondition-checker
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

// ——— persistencia local: ~/.mcp-suite/precondition-checker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "precondition-checker");
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

const server = new McpServer({ name: "precondition-checker", version: "1.0.0" });

server.tool(
  "define_checks",
  "Declara las precondiciones de una tarea: qué verificar y cómo se comprueba.",
  {
  tarea: z.string().describe("Tarea/plan que quieres ejecutar"),
  checks: z.array(z.any()).describe("Checks {nombre, tipo: estado|permiso|dato|conexion|tiempo, como_verificar}"),
  },
  async (args: any) => {
    const { tarea, checks } = args as any;
    const st = store.load();
st.tareas = st.tareas || {};
const limpios = (checks || []).map((c, i) => ({ nombre: String(c.nombre || ("check_" + (i + 1))), tipo: String(c.tipo || "estado"), como_verificar: String(c.como_verificar || "verificar manualmente"), estado: "pendiente" }));
if (!limpios.length) return fail("sin checks declarados");
st.tareas[tarea] = { tarea, checks: limpios, creado: new Date().toISOString(), gates: 0 };
store.save(st);
return ok({ tarea, checks: limpios.length, por_tipo: limpios.reduce((acc, c) => { acc[c.tipo] = (acc[c.tipo] || 0) + 1; return acc; }, {}), siguiente: "ejecuta check_all con las observaciones reales" });
  }
);

server.tool(
  "check_all",
  "Evalúa cada check con tu observación real y emite el veredicto de arranque (GO/NO-GO/GO-CON-RIESGO).",
  {
  tarea: z.string().describe("Tarea a evaluar"),
  resultados: z.array(z.any()).describe("Resultados {nombre, observado, cumple: true|false|desconocido}"),
  },
  async (args: any) => {
    const { tarea, resultados } = args as any;
    const st = store.load();
const t = (st.tareas || {})[tarea];
if (!t) return fail("tarea no definida: " + tarea + " (usa define_checks primero)");
t.gates = (t.gates || 0) + 1;
const obsMap = new Map<any, any>((resultados || []).map(r => [String(r.nombre), r]));
const evaluados = t.checks.map(c => {
  const r = obsMap.get(c.nombre);
  if (!r) return { ...c, estado: "sin_evaluar", evidencia: null };
  const cumple = r.cumple === true ? "pasa" : r.cumple === false ? "falla" : "desconocido";
  return { ...c, estado: cumple, evidencia: String(r.observado || "").slice(0, 120), verificado_ts: new Date().toISOString() };
});
const fallan = evaluados.filter(e => e.estado === "falla");
const desconocidos = evaluados.filter(e => e.estado === "desconocido" || e.estado === "sin_evaluar");
const bloqueantes = fallan.filter(e => e.tipo === "permiso" || e.tipo === "conexion" || e.tipo === "estado");
const veredicto = bloqueantes.length ? "NO-GO: hay checks bloqueantes en rojo. Arrancar garantiza fallo a mitad de camino" : fallan.length === 0 && desconocidos.length === 0 ? "GO: todas las precondiciones verificadas" : desconocidos.length > evaluados.length / 3 ? "NO-GO-INFO: más de un tercio sin evaluar: verifica antes de arrancar" : "GO-CON-RIESGO: hay fallas no bloqueantes (" + fallan.length + ") y desconocidos (" + desconocidos.length + "): el plan puede avanzar con contingencias";
t.checks = evaluados;
t.ultimo_gate = { veredicto, ts: new Date().toISOString(), fallan: fallan.length, desconocidos: desconocidos.length };
store.save(st);
return ok({ tarea, gate_numero: t.gates, resumen: { total: evaluados.length, pasan: evaluados.filter(e => e.estado === "pasa").length, fallan: fallan.length, desconocidos: desconocidos.length }, checks: evaluados, veredicto });
  }
);

server.tool(
  "gate_report",
  "Último gate de una tarea: estado consolidado y qué camino tomar.",
  {
  tarea: z.string().describe("Tarea"),
  },
  async (args: any) => {
    const { tarea } = args as any;
    const st = store.load();
const t = (st.tareas || {})[tarea];
if (!t) return fail("tarea no definida");
const g = t.ultimo_gate;
if (!g) return ok({ tarea, gates: 0, mensaje: "nunca se ha corrido el gate: corre check_all" });
return ok({ tarea, gates_corridos: t.gates, ultimo_veredicto: g.veredicto, cuando: g.ts, pendientes_arreglar: t.checks.filter(c => c.estado === "falla").map(c => c.nombre), camino: g.veredicto.startsWith("NO-GO") ? "corrige los checks en rojo y re-corre el gate: no arrancques" : g.veredicto === "GO-CON-RIESGO" ? "arranca con plan de contingencia documentado para los checks amarillos" : "arranca" });
  }
);

server.tool(
  "fail_stats",
  "Estadística de qué precondiciones fallan más: dónde poner automatización.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const tareas = __vals(st.tareas || {});
const todas = [];
tareas.forEach(t => (t.checks || []).forEach(c => todas.push({ tarea: t.tarea, nombre: c.nombre, tipo: c.tipo, estado: c.estado })));
if (!todas.length) return ok({ checks: 0, mensaje: "sin datos aún" });
const porNombre = {};
todas.forEach(c => { porNombre[c.nombre] = porNombre[c.nombre] || { nombre: c.nombre, tipo: c.tipo, fallas: 0, total: 0 }; porNombre[c.nombre].total++; if (c.estado === "falla") porNombre[c.nombre].fallas++; });
const ranking = __vals(porNombre).map(x => ({ ...x, tasa_fallo: Number((x.fallas / x.total * 100).toFixed(0)) + "%" })).sort((a, b) => b.fallas - a.fallas);
const peor = ranking[0];
return ok({ checks_evaluados: todas.length, top_fallidos: ranking.slice(0, 5), recomendacion: peor && peor.tasa_fallo === "100%" ? "el check '" + peor.nombre + "' falla SIEMPRE: automatízalo o elimínalo de la definición" : "monitoriza los checks con mayor tasa de fallo" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor precondition-checker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "precondition-checker", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[precondition-checker] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Goal Contract
 * Objetivos con criterios de éxito inmutables: el north star que no se reescribe en mitad de la misión
 *
 * Dolor que resuelve: En misiones largas el agente reescribe mentalmente el objetivo cada día ('goal drift'): termina resolviendo un problema distinto y nadie lo nota porque el objetivo original ya nadie lo recuerda.
 * Categoría: Objetivos y Largo Plazo | Generado por mcp-suite | id: goal-contract
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

// ——— persistencia local: ~/.mcp-suite/goal-contract/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "goal-contract");
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

const server = new McpServer({ name: "goal-contract", version: "1.0.0" });

server.tool(
  "declare_goal",
  "Declara el contrato de objetivo: enunciado, criterios de éxito verificables y restricciones. Inmutable tras la creación.",
  {
  enunciado: z.string().describe("El objetivo en una frase verificable"),
  criterios_exito: z.array(z.any()).describe("Condiciones objetivas de éxito"),
  restricciones: z.array(z.any()).describe("Lo que NO se debe hacer").default([]),
  horizonte_dias: z.number().describe("Plazo esperado en días").optional(),
  },
  async (args: any) => {
    const { enunciado, criterios_exito, restricciones, horizonte_dias } = args as any;
    if (!Array.isArray(criterios_exito) || criterios_exito.length < 1) return fail("un objetivo sin criterios verificables deriva garantizado");
const st = store.load();
if (st.activo) return fail("ya hay un objetivo activo (" + st.activo.id + "). Ciérralo con close_goal o améndalo con amend_goal (visible), no lo reescribas");
const id = "goal_" + Date.now().toString(36);
st.activo = {
  id, enunciado, criterios_exito: criterios_exito.map((c, i) => ({ n: i + 1, criterio: String(c), cumplido: false, evidencia: null })),
  restricciones: (restricciones || []).map(String),
  horizonte: horizonte_dias ? new Date(Date.now() + horizonte_dias * 86400000).toISOString() : null,
  creado: new Date().toISOString(),
  enmiendas: [], mediciones: [],
};
store.save(st);
return ok({ objetivo_id: id, enunciado, criterios: st.activo.criterios_exito.length, restriccion: (restricciones || []).length, aviso: "esto es un contrato: los criterios NO se reescriben, solo se miden" });
  }
);

server.tool(
  "get_goal",
  "Recupera el objetivo activo completo: criterios, cumplimiento y enmiendas acumuladas.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
if (!st.activo) return fail("no hay objetivo activo: decláralo con declare_goal");
const a = st.activo;
return ok({
  ...a,
  dias_transcurridos: Number(((Date.now() - new Date(a.creado).getTime()) / 86400000).toFixed(1)),
  horizonte_restante_dias: a.horizonte ? Number(((new Date(a.horizonte).getTime() - Date.now()) / 86400000).toFixed(1)) : null,
  progreso_criterios: a.criterios_exito.filter(c => c.cumplido).length + "/" + a.criterios_exito.length,
});
  }
);

server.tool(
  "measure",
  "Registra una medición de un criterio (cumplido o no, con evidencia) sin alterar el contrato.",
  {
  n: z.number().describe("Número del criterio a medir"),
  cumplido: z.boolean().describe("¿Se cumple?"),
  evidencia: z.string().describe("Evidencia o cómo se verificó").optional(),
  },
  async (args: any) => {
    const { n, cumplido, evidencia } = args as any;
    const st = store.load();
if (!st.activo) return fail("no hay objetivo activo");
const c = st.activo.criterios_exito.find(x => x.n === n);
if (!c) return fail("criterio " + n + " inexistente (hay " + st.activo.criterios_exito.length + ")");
c.cumplido = cumplido;
c.evidencia = evidencia || null;
c.medido = new Date().toISOString();
st.activo.mediciones.push({ criterio: n, cumplido, ts: c.medido });
store.save(st);
const cumplidos = st.activo.criterios_exito.filter(x => x.cumplido).length;
return ok({ criterio: n, cumplido, progreso: cumplidos + "/" + st.activo.criterios_exito.length, completado: cumplidos === st.activo.criterios_exito.length });
  }
);

server.tool(
  "amend_goal",
  "Enmienda VISIBLE del objetivo (nuevos criterios o restricciones) con motivo y fecha: nunca reescritura silenciosa.",
  {
  criterios_extra: z.array(z.any()).describe("Criterios nuevos").optional(),
  restricciones_extra: z.array(z.any()).describe("Restricciones nuevas").optional(),
  motivo: z.string().describe("Por qué se enmienda el objetivo"),
  },
  async (args: any) => {
    const { criterios_extra, restricciones_extra, motivo } = args as any;
    const st = store.load();
if (!st.activo) return fail("no hay objetivo activo");
if (!motivo) return fail("toda enmienda necesita motivo auditable");
const a = st.activo;
const antes = { criterios: a.criterios_exito.length, restricciones: a.restricciones.length };
let n = a.criterios_exito.length;
for (const c of (criterios_extra || [])) { n++; a.criterios_exito.push({ n, criterio: String(c), cumplido: false, evidencia: null }); }
a.restricciones.push(...(restricciones_extra || []).map(String));
a.enmiendas.push({ motivo, antes, despues: { criterios: a.criterios_exito.length, restricciones: a.restricciones.length }, ts: new Date().toISOString() });
store.save(st);
return ok({ enmienda_n: a.enmiendas.length, criterios_totales: a.criterios_exito.length, advertencia: a.enmiendas.length > 3 ? "demasiadas enmiendas: ¿el objetivo original era el correcto o hay drift declarado?" : "enmienda registrada" });
  }
);

server.tool(
  "check_alignment",
  "Verifica que una acción o sub-objetivo propuesto sigue alineado con el contrato activo (anti-drift).",
  {
  propuesta: z.string().describe("Acción o sub-objetivo a evaluar"),
  },
  async (args: any) => {
    const { propuesta } = args as any;
    const st = store.load();
if (!st.activo) return fail("no hay objetivo activo");
const a = st.activo;
const stop = (s) => new Set(String(s).toLowerCase().split(/\W+/).filter(w => w.length > 3));
const objTokens = stop(a.enunciado + " " + a.criterios_exito.map(c => c.criterio).join(" "));
const propTokens = [...stop(propuesta)];
const eco = propTokens.filter(w => objTokens.has(w)).length / Math.max(propTokens.length, 1);
const chocaRestriccion = a.restricciones.filter(r => {
  const rt = [...stop(r)];
  return rt.length > 0 && rt.every(w => propTokens.includes(w));
});
const veredicto = eco >= 0.4 && !chocaRestriccion.length ? "alineado" : eco < 0.2 ? "desalineado: esta acción NO sirve al objetivo declarado" : chocaRestriccion.length ? "VIOLA restricción: " + chocaRestriccion[0] : "parcialmente alineado: justifica la conexión o descártala";
return ok({ alineamiento: Number(eco.toFixed(2)), veredicto, restriccion_violada: chocaRestriccion[0] || null, criterios_pendientes: a.criterios_exito.filter(c => !c.cumplido).length });
  }
);

server.tool(
  "close_goal",
  "Cierra el objetivo con veredicto (logrado, parcial, abandonado) y balance de enmiendas/mediciones.",
  {
  veredicto: z.enum(["logrado","parcial","abandonado","reemplazado"]).describe("Resultado final"),
  notas: z.string().describe("Cierre narrativo").optional(),
  },
  async (args: any) => {
    const { veredicto, notas } = args as any;
    const st = store.load();
if (!st.activo) return fail("no hay objetivo activo");
const a = st.activo;
a.cierre = { veredicto, notas: notas || null, criterios_cumplidos: a.criterios_exito.filter(c => c.cumplido).length, total: a.criterios_exito.length, enmiendas: a.enmiendas.length, cerrado: new Date().toISOString() };
st.historial = st.historial || [];
st.historial.push(a);
st.activo = null;
store.save(st);
return ok({ cerrado: true, veredicto, criterios: a.cierre.criterios_cumplidos + "/" + a.cierre.total, duracion_dias: Number(((new Date(a.cierre.cerrado).getTime() - new Date(a.creado).getTime()) / 86400000).toFixed(1)), enmiendas: a.enmiendas.length });
  }
);

server.tool(
  "goal_history",
  "Historial de objetivos cerrados: duración, tasa de logro y patrón de abandono.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const h = st.historial || [];
if (!h.length) return ok({ objetivos_cerrados: 0 });
const logrados = h.filter(g => g.cierre.veredicto === "logrado").length;
return ok({
  objetivos_cerrados: h.length,
  tasa_logro: Number((logrados / h.length).toFixed(2)),
  abandonados: h.filter(g => g.cierre.veredicto === "abandonado").length,
  enmiendas_medias: Number((h.reduce((s, g) => s + g.enmiendas.length, 0) / h.length).toFixed(1)),
  resumen: h.map(g => ({ id: g.id, enunciado: g.enunciado.slice(0, 70), veredicto: g.cierre.veredicto, criterios: g.cierre.criterios_cumplidos + "/" + g.cierre.total, dias: Number(((new Date(g.cierre.cerrado).getTime() - new Date(g.creado).getTime()) / 86400000).toFixed(1)) })),
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor goal-contract está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "goal-contract", tools: 8, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[goal-contract] fatal:", e);
  process.exit(1);
});

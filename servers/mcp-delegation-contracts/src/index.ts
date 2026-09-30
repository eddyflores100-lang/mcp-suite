#!/usr/bin/env node
/**
 * MCP Server: Delegation Contracts
 * Contratos verificables de delegación entre agentes: objetivo, criterios, presupuesto y veredicto
 *
 * Dolor que resuelve: La delegación entre agentes es un 'ahí te va esto' sin criterios verificables: el sub-agente devuelve lo que interpreta, el delegador no puede aceptar/rechazar con evidencia y no hay historial de rework.
 * Categoría: Multi-Agente y Coordinación | Generado por mcp-suite | id: delegation-contracts
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

// ——— persistencia local: ~/.mcp-suite/delegation-contracts/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "delegation-contracts");
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

const server = new McpServer({ name: "delegation-contracts", version: "1.0.0" });

server.tool(
  "create_contract",
  "Crea un contrato de delegación: objetivo medible, criterios de aceptación, presupuesto de tokens, deadline y penalización por rework.",
  {
  delegador: z.string().describe("Agent_id que delega"),
  delegado: z.string().describe("Agent_id que ejecuta"),
  objetivo: z.string().describe("Objetivo del encargo, verificable"),
  criterios_aceptacion: z.array(z.any()).describe("Lista de criterios verificables de aceptación"),
  presupuesto_tokens: z.number().describe("Presupuesto máximo de tokens").optional(),
  deadline_horas: z.number().describe("Plazo en horas desde ahora").optional(),
  contexto: z.string().describe("Contexto esencial para el delegado").optional(),
  },
  async (args: any) => {
    const { delegador, delegado, objetivo, criterios_aceptacion, presupuesto_tokens, deadline_horas, contexto } = args as any;
    if (!Array.isArray(criterios_aceptacion) || criterios_aceptacion.length === 0) return fail("sin criterios de aceptación no hay contrato verificable (spec ambiguity)");
const st = store.load();
st.contratos = st.contratos || [];
const id = "ctr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
st.contratos.push({
  id, delegador, delegado, objetivo, contexto: contexto || null,
  criterios: criterios_aceptacion.map((c, i) => ({ n: i + 1, criterio: String(c), cumplido: null })),
  presupuesto_tokens: presupuesto_tokens || null,
  tokens_usados: 0,
  deadline: deadline_horas ? new Date(Date.now() + deadline_horas * 3600000).toISOString() : null,
  estado: "abierto",
  entregas: [], revisiones: [],
  creado: new Date().toISOString(),
});
store.save(st);
return ok({ contrato_id: id, estado: "abierto", criterios: criterios_aceptacion.length, deadline: st.contratos.at(-1).deadline, aviso: "el delegado debe llamar submit_deliverable con evidencia por criterio" });
  }
);

server.tool(
  "get_contract",
  "Contrato completo con entregas, revisiones y evaluación de vencimiento.",
  {
  contrato_id: z.string().describe("ID del contrato"),
  },
  async (args: any) => {
    const { contrato_id } = args as any;
    const st = store.load();
const c = (st.contratos || []).find(x => x.id === contrato_id);
if (!c) return fail("contrato no encontrado: " + contrato_id);
const vencido = c.deadline && new Date(c.deadline) < new Date() && c.estado === "abierto";
return ok({ ...c, vencido: !!vencido, dias_desde_creacion: Number(((Date.now() - new Date(c.creado).getTime()) / 86400000).toFixed(2)) });
  }
);

server.tool(
  "list_contracts",
  "Lista contratos con filtro por estado, delegado o delegador.",
  {
  estado: z.string().describe("abierto, entregado, aprobado, rechazado, rework, escalado, vencido").optional(),
  delegado: z.string().describe("Filtrar por agente ejecutor").optional(),
  delegador: z.string().describe("Filtrar por agente delegante").optional(),
  },
  async (args: any) => {
    const { estado, delegado, delegador } = args as any;
    const st = store.load();
let lista = st.contratos || [];
if (estado) lista = lista.filter(c => c.estado === estado);
if (delegado) lista = lista.filter(c => c.delegado === delegado);
if (delegador) lista = lista.filter(c => c.delegador === delegador);
return ok({
  total: lista.length,
  contratos: lista.map(c => ({ id: c.id, objetivo: c.objetivo.slice(0, 90), delegador: c.delegador, delegado: c.delegado, estado: c.estado, entregas: c.entregas.length, vencido: !!(c.deadline && new Date(c.deadline) < new Date() && c.estado === "abierto") })),
});
  }
);

server.tool(
  "submit_deliverable",
  "El delegado entrega: resumen del resultado, evidencia por criterio y tokens consumidos.",
  {
  contrato_id: z.string().describe("ID del contrato"),
  resumen: z.string().describe("Resumen del trabajo realizado"),
  evidencias: z.array(z.any()).describe("Evidencias alineadas a los criterios (texto)"),
  tokens_usados: z.number().describe("Tokens consumidos").optional(),
  },
  async (args: any) => {
    const { contrato_id, resumen, evidencias, tokens_usados } = args as any;
    const st = store.load();
const c = (st.contratos || []).find(x => x.id === contrato_id);
if (!c) return fail("contrato no encontrado");
if (c.estado === "aprobado") return fail("contrato ya aprobado: abre uno nuevo con create_contract");
c.entregas.push({ resumen, evidencias: evidencias || [], tokens_usados: tokens_usados || null, ts: new Date().toISOString() });
if (tokens_usados) c.tokens_usados = (c.tokens_usados || 0) + tokens_usados;
c.estado = "entregado";
store.save(st);
const cobertura = (evidencias || []).length / Math.max(c.criterios.length, 1);
return ok({
  entrega_registrada: true, n_entrega: c.entregas.length,
  criterios: c.criterios.length, evidencias_recibidas: (evidencias || []).length,
  cobertura_criterios: Number(cobertura.toFixed(2)),
  sobre_presupuesto: c.presupuesto_tokens ? c.tokens_usados > c.presupuesto_tokens : false,
  aviso: cobertura < 1 ? "faltan evidencias para algunos criterios: el review probablemente exija rework" : "cobertura completa de criterios",
});
  }
);

server.tool(
  "review",
  "El delegador revisa la última entrega: marca cada criterio cumplido/no e imprime veredicto (aprobado, rework o rechazado).",
  {
  contrato_id: z.string().describe("ID del contrato"),
  criterios_cumplidos: z.array(z.any()).describe("Números de criterios cumplidos (ej: [1,2,4])"),
  veredicto: z.enum(["aprobado","rework","rechazado"]).describe("Veredicto final"),
  notas: z.string().describe("Notas del revisor").optional(),
  },
  async (args: any) => {
    const { contrato_id, criterios_cumplidos, veredicto, notas } = args as any;
    const st = store.load();
const c = (st.contratos || []).find(x => x.id === contrato_id);
if (!c) return fail("contrato no encontrado");
if (!c.entregas.length) return fail("no hay entregas que revisar");
const cumplidos = new Set((criterios_cumplidos || []).map(Number));
for (const cr of c.criterios) cr.cumplido = cumplidos.has(cr.n);
c.revisiones.push({ veredicto, notas: notas || null, cumplidos: [...cumplidos], ts: new Date().toISOString() });
c.estado = veredicto === "aprobado" ? "aprobado" : veredicto;
store.save(st);
const pct = Math.round((cumplidos.size / c.criterios.length) * 100);
return ok({
  veredicto, criterios_cumplidos: cumplidos.size + "/" + c.criterios.length, porcentaje: pct,
  reworks: c.revisiones.filter(r => r.veredicto === "rework").length,
  criterios_fallidos: c.criterios.filter(cr => !cr.cumplido).map(cr => cr.n),
  tokens_usados: c.tokens_usados, presupuesto: c.presupuesto_tokens,
});
  }
);

server.tool(
  "escalate_contract",
  "Escala un contrato atascado (rework repetido, deadline vencido, presupuesto excedido) al supervisor con contexto.",
  {
  contrato_id: z.string().describe("ID del contrato"),
  razon: z.string().describe("Motivo del escalamiento"),
  hacia: z.string().describe("Agent_id o 'humano' del destinatario").default("humano"),
  },
  async (args: any) => {
    const { contrato_id, razon, hacia } = args as any;
    const st = store.load();
const c = (st.contratos || []).find(x => x.id === contrato_id);
if (!c) return fail("contrato no encontrado");
const reworks = c.revisiones.filter(r => r.veredicto === "rework").length;
const vencido = c.deadline && new Date(c.deadline) < new Date();
if (!razon && !vencido && reworks < 2) return fail("escalar sin motivo debilitado: indica razon");
c.estado = "escalado";
c.escalado = { hacia, razon, reworks, vencido: !!vencido, ts: new Date().toISOString() };
store.save(st);
return ok({
  escalado_a: hacia, contrato: c.id,
  contexto_para_supervisor: {
    objetivo: c.objetivo, delegado: c.delegado, entregas: c.entregas.length, reworks,
    vencido: !!vencido, tokens: c.tokens_usados, presupuesto: c.presupuesto_tokens,
    criterios_abiertos: c.criterios.filter(cr => !cr.cumplido).map(cr => cr.criterio),
  },
});
  }
);

server.tool(
  "contract_stats",
  "Estadísticas de delegación: tasa de aprobación, rework medio, escalaciones y desviación de presupuesto.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const cs = st.contratos || [];
if (!cs.length) return ok({ total: 0, sugerencia: "crea contratos con create_contract" });
const por = (e) => cs.filter(c => c.estado === e).length;
const aprobados = por("aprobado");
const reworkTotal = cs.reduce((s, c) => s + c.revisiones.filter(r => r.veredicto === "rework").length, 0);
const cerrados = cs.filter(c => ["aprobado", "rechazado"].includes(c.estado)).length;
const conPresu = cs.filter(c => c.presupuesto_tokens);
return ok({
  total: cs.length,
  estados: { abierto: por("abierto"), entregado: por("entregado"), aprobado: aprobados, rework: por("rework"), rechazado: por("rechazado"), escalado: por("escalado") },
  tasa_aprobacion: cerrados ? Number((aprobados / cerrados).toFixed(2)) : null,
  rework_medio_por_contrato: Number((reworkTotal / cs.length).toFixed(2)),
  escalaciones: por("escalado"),
  desviacion_presupuesto_pct: conPresu.length ? Number((conPresu.reduce((s, c) => s + (c.tokens_usados - c.presupuesto_tokens) / c.presupuesto_tokens, 0) / conPresu.length * 100).toFixed(1)) : null,
  peor_delegado: (() => { const g = {}; for (const c of cs) { if (c.estado === "rework" || c.estado === "escalado") g[c.delegado] = (g[c.delegado] || 0) + 1; } const e = __ents(g).sort((a, b) => b[1] - a[1])[0]; return e ? { delegado: e[0], incidencias: e[1] } : null; })(),
});
  }
);

server.tool(
  "amend_contract",
  "Enmienda un contrato abierto: ajusta criterios, presupuesto o deadline dejando auditoría del cambio.",
  {
  contrato_id: z.string().describe("ID del contrato"),
  criterios_extra: z.array(z.any()).describe("Criterios nuevos a añadir").optional(),
  presupuesto_tokens: z.number().describe("Nuevo presupuesto").optional(),
  deadline_horas: z.number().describe("Nuevo plazo en horas desde ahora").optional(),
  motivo: z.string().describe("Motivo de la enmienda"),
  },
  async (args: any) => {
    const { contrato_id, criterios_extra, presupuesto_tokens, deadline_horas, motivo } = args as any;
    const st = store.load();
const c = (st.contratos || []).find(x => x.id === contrato_id);
if (!c) return fail("contrato no encontrado");
if (["aprobado", "rechazado"].includes(c.estado)) return fail("contrato cerrado: no se enmienda, se crea otro");
const antes = { criterios: c.criterios.length, presupuesto: c.presupuesto_tokens, deadline: c.deadline };
let n = c.criterios.length;
for (const cr of (criterios_extra || [])) { n++; c.criterios.push({ n, criterio: String(cr), cumplido: null }); }
if (presupuesto_tokens !== undefined) c.presupuesto_tokens = presupuesto_tokens;
if (deadline_horas !== undefined) c.deadline = new Date(Date.now() + deadline_horas * 3600000).toISOString();
c.enmiendas = c.enmiendas || [];
c.enmiendas.push({ motivo, antes, despues: { criterios: c.criterios.length, presupuesto: c.presupuesto_tokens, deadline: c.deadline }, ts: new Date().toISOString() });
store.save(st);
return ok({ contrato: c.id, enmienda_n: c.enmiendas.length, criterios_totales: c.criterios.length, historial: c.enmiendas.length });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor delegation-contracts está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "delegation-contracts", tools: 9, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[delegation-contracts] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Agent Org Chart
 * Registro vivo del equipo de agentes: roles, capacidades, autonomía y estado
 *
 * Dolor que resuelve: Cuando varios agentes colaboran, nadie sabe quién es quién: se duplican roles, se delega a quien no tiene la capacidad y no hay jerarquía de escalamiento.
 * Categoría: Multi-Agente y Coordinación | Generado por mcp-suite | id: agent-org-chart
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

// ——— persistencia local: ~/.mcp-suite/agent-org-chart/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "agent-org-chart");
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

const server = new McpServer({ name: "agent-org-chart", version: "1.0.0" });

server.tool(
  "register_agent",
  "Registra o actualiza un agente en el equipo: rol, capacidades, nivel de autonomía (0=ninguna,1=sugerir,2=ejecutar con aprobación,3=autónomo) y supervisor.",
  {
  agent_id: z.string().describe("Identificador único del agente"),
  nombre: z.string().describe("Nombre legible"),
  rol: z.string().describe("Rol en el equipo (ej: researcher, coder, reviewer)"),
  capacidades: z.array(z.any()).describe("Lista de capacidades declaradas").default([]),
  nivel_autonomia: z.number().describe("0-3: 0 ninguna, 1 sugerir, 2 ejecutar con aprobación, 3 autónomo").default(2),
  supervisor: z.string().describe("Agent_id del supervisor (null = raíz)").optional(),
  },
  async (args: any) => {
    const { agent_id, nombre, rol, capacidades, nivel_autonomia, supervisor } = args as any;
    const st = store.load();
st.agents = st.agents || {};
if (nivel_autonomia !== undefined && (nivel_autonomia < 0 || nivel_autonomia > 3)) return fail("nivel_autonomia debe ser 0-3");
const previo = st.agents[agent_id];
st.agents[agent_id] = {
  agent_id, nombre, rol,
  capacidades: Array.isArray(capacidades) ? capacidades : [],
  nivel_autonomia: nivel_autonomia ?? 2,
  supervisor: supervisor ?? null,
  estado: previo?.estado || "activo",
  registrado: previo?.registrado || new Date().toISOString(),
  actualizado: new Date().toISOString(),
};
store.save(st);
return ok({ agente: st.agents[agent_id], actualizado: !!previo, total_equipo: Object.keys(st.agents).length });
  }
);

server.tool(
  "get_agent",
  "Devuelve la ficha completa de un agente: capacidades, autonomía, cadena de supervisión y carga actual.",
  {
  agent_id: z.string().describe("ID del agente"),
  },
  async (args: any) => {
    const { agent_id } = args as any;
    const st = store.load();
const a = (st.agents || {})[agent_id];
if (!a) return fail("agente no registrado: " + agent_id);
const cadena = [];
let cur = a.supervisor;
let saltos = 0;
while (cur && saltos < 10) {
  const s = st.agents[cur];
  if (!s) break;
  cadena.push({ agent_id: cur, nombre: s.nombre, rol: s.rol });
  cur = s.supervisor; saltos++;
}
const subordinados = __vals(st.agents).filter(x => x.supervisor === agent_id).map(x => x.agent_id);
return ok({ ...a, cadena_supervision: cadena, subordinados, nivel_jerarquico: cadena.length });
  }
);

server.tool(
  "list_agents",
  "Roster del equipo con filtros por rol, estado y autonomía; incluye contadores resumen.",
  {
  rol: z.string().describe("Filtrar por rol exacto").optional(),
  estado: z.string().describe("Filtrar por estado (activo, pausado, retirado)").optional(),
  min_autonomia: z.number().describe("Autonomía mínima 0-3").optional(),
  },
  async (args: any) => {
    const { rol, estado, min_autonomia } = args as any;
    const st = store.load();
let lista = __vals(st.agents || {});
if (rol) lista = lista.filter(a => a.rol === rol);
if (estado) lista = lista.filter(a => (a.estado || "activo") === estado);
if (min_autonomia !== undefined) lista = lista.filter(a => (a.nivel_autonomia ?? 2) >= min_autonomia);
const por_rol = {};
for (const a of __vals(st.agents || {})) por_rol[a.rol] = (por_rol[a.rol] || 0) + 1;
return ok({
  total: lista.length,
  por_rol,
  agentes: lista.map(a => ({ agent_id: a.agent_id, nombre: a.nombre, rol: a.rol, autonomia: a.nivel_autonomia, estado: a.estado || "activo", capacidades: a.capacidades.length })),
});
  }
);

server.tool(
  "find_by_capability",
  "Busca agentes capaces de X: matching por capacidad exacta y capacidades relacionadas (similitud de tokens).",
  {
  capacidad: z.string().describe("Capacidad buscada (ej: pdf, sql, navegador)"),
  solo_activos: z.boolean().describe("Excluir agentes pausados/retirados").default(true),
  },
  async (args: any) => {
    const { capacidad, solo_activos } = args as any;
    const st = store.load();
const norm = (s) => String(s).toLowerCase().trim();
const objetivo = norm(capacidad).split(/[\s_-]+/);
const resultados = [];
for (const a of __vals(st.agents || {})) {
  if (solo_activos && (a.estado || "activo") !== "activo") continue;
  let mejor = 0, matched = [];
  for (const c of a.capacidades || []) {
    const tokens = norm(c).split(/[\s_-]+/);
    const overlap = tokens.filter(t => objetivo.includes(t)).length;
    const score = overlap / Math.max(objetivo.length, 1);
    if (score > 0) matched.push(c);
    if (score > mejor) mejor = score;
  }
  if (a.capacidades?.some(c => norm(c) === norm(capacidad))) mejor = 1;
  if (mejor > 0) resultados.push({ agent_id: a.agent_id, nombre: a.nombre, rol: a.rol, autonomia: a.nivel_autonomia, score: Number(mejor.toFixed(2)), capacidades_relevantes: matched });
}
resultados.sort((a, b) => b.score - a.score);
if (!resultados.length) return ok({ capacidad, coincidencias: [], sugerencia: "ningún agente declaró esa capacidad: regístralo con register_agent o delega a humano" });
return ok({ capacidad, coincidencias: resultados.slice(0, 10) });
  }
);

server.tool(
  "update_status",
  "Cambia el estado operativo de un agente (activo, pausado, saturado, retirado) con nota opcional.",
  {
  agent_id: z.string().describe("ID del agente"),
  estado: z.enum(["activo","pausado","saturado","retirado"]).describe("Nuevo estado"),
  nota: z.string().describe("Motivo del cambio").optional(),
  },
  async (args: any) => {
    const { agent_id, estado, nota } = args as any;
    const st = store.load();
const a = (st.agents || {})[agent_id];
if (!a) return fail("agente no registrado: " + agent_id);
a.estado = estado;
a.actualizado = new Date().toISOString();
if (nota) { a.historial_estado = a.historial_estado || []; a.historial_estado.push({ estado, nota, ts: a.actualizado }); }
store.save(st);
return ok({ agent_id, estado, nota: nota || null });
  }
);

server.tool(
  "capability_matrix",
  "Matriz capacidades × agentes: detecta capacidades huérfanas (nadie las cubre) y redundancias excesivas.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const agentes = __vals(st.agents || {});
const matriz = {};
for (const a of agentes) for (const c of a.capacidades || []) {
  const k = String(c).toLowerCase().trim();
  matriz[k] = matriz[k] || [];
  matriz[k].push(a.agent_id);
}
const huérfanas = [];
for (const rolHint of ["pdf", "sql", "http", "email", "navegador", "archivos", "codigo", "datos"]) {
  if (!matriz[rolHint]) huérfanas.push(rolHint);
}
const redundantes = __ents(matriz).filter(([, v]) => v.length > 3).map(([k, v]) => ({ capacidad: k, agentes: v.length }));
const monopolios = __ents(matriz).filter(([, v]) => v.length === 1).map(([k, v]) => ({ capacidad: k, unico_agente: v[0] }));
return ok({
  total_agentes: agentes.length,
  total_capacidades: Object.keys(matriz).length,
  matriz,
  capacidades_huerfanas_sugeridas: huérfanas,
  capacidades_redundantes: redundantes,
  puntosunicos_de_fallo: monopolios,
  advertencia: monopolios.length > 0 ? "hay capacidades cubiertas por un solo agente (riesgo SPOF)" : "cobertura sin puntos únicos de fallo",
});
  }
);

server.tool(
  "org_snapshot",
  "Fotografía de salud del equipo: profundidad jerárquica, autonomía media, agentes sin supervisor y balance de carga.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const agentes = __vals(st.agents || {});
if (!agentes.length) return ok({ equipo_vacio: true, sugerencia: "registra agentes con register_agent" });
const niveles = agentes.map(a => {
  let n = 0, cur = a.supervisor;
  while (cur && n < 10) { n++; cur = (st.agents[cur] || {}).supervisor; }
  return n;
});
const autonomias = agentes.map(a => a.nivel_autonomia ?? 2);
const sin_supervisor = agentes.filter(a => !a.supervisor).map(a => a.agent_id);
const estados = {};
for (const a of agentes) estados[a.estado || "activo"] = (estados[a.estado || "activo"] || 0) + 1;
return ok({
  total: agentes.length,
  estados,
  autonomia_media: Number((autonomias.reduce((x, y) => x + y, 0) / agentes.length).toFixed(2)),
  autonomia_max: Math.max(...autonomias),
  profundidad_jerarquica: Math.max(...niveles),
  raices: sin_supervisor,
  advertencias: [
    ...(sin_supervisor.length > 1 ? ["múltiples agentes sin supervisor: cadena de escalamiento ambigua"] : []),
    ...(Math.max(...niveles) > 4 ? ["jerarquía demasiado profunda (>4): los escalados se demoran"] : []),
    ...((st.agents ? __vals(st.agents).filter(a => (a.estado || "activo") === "saturado").length : 0) > 0 ? ["hay agentes saturados: redistribuye con update_status"] : []),
  ],
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor agent-org-chart está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "agent-org-chart", tools: 8, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[agent-org-chart] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Conflict Resolver
 * Detecta y resuelve conflictos entre agentes: ediciones concurrentes, decisiones contradictorias, duplicación
 *
 * Dolor que resuelve: Dos agentes editan el mismo artefacto o toman decisiones contradictorias sobre el mismo asunto: el resultado es corrupción silenciosa del estado o guerra de tirones sin árbitro.
 * Categoría: Multi-Agente y Coordinación | Generado por mcp-suite | id: conflict-resolver
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

// ——— persistencia local: ~/.mcp-suite/conflict-resolver/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "conflict-resolver");
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

const server = new McpServer({ name: "conflict-resolver", version: "1.0.0" });

server.tool(
  "record_decision",
  "Un agente registra una decisión sobre un asunto; se detecta contradicción con decisiones previas de otros agentes.",
  {
  asunto: z.string().describe("Clave del asunto (ej: stack/frontend)"),
  agente: z.string().describe("Agent_id que decide"),
  decision: z.string().describe("Decisión tomada"),
  justificacion: z.string().describe("Por qué").optional(),
  confianza: z.number().describe("0-1").default(0.8),
  },
  async (args: any) => {
    const { asunto, agente, decision, justificacion, confianza } = args as any;
    const st = store.load();
st.decisiones = st.decisiones || {};
const previas = st.decisiones[asunto] || [];
const contradictoria = previas.find(p => p.agente !== agente && p.decision.trim().toLowerCase() !== decision.trim().toLowerCase());
st.decisiones[asunto] = [...previas, { agente, decision, justificacion: justificacion || null, confianza: confianza ?? 0.8, ts: new Date().toISOString() }];
store.save(st);
if (contradictoria) {
  return ok({
    conflicto: true, asunto,
    enfrentadas: [{ agente: contradictoria.agente, decision: contradictoria.decision, ts: contradictoria.ts }, { agente, decision }],
    siguiente_paso: "usa raise_conflict y resuelve con resolve_conflict (merge, voto o escalar)",
  });
}
return ok({ conflicto: false, asunto, decisiones_acumuladas: st.decisiones[asunto].length });
  }
);

server.tool(
  "declare_edit",
  "Declara intención de editar un artefacto (piso, sección o campo) para detectar solapamientos con otros editores.",
  {
  artefacto: z.string().describe("ID/ruta del artefacto"),
  agente: z.string().describe("Agent_id editor"),
  seccion: z.string().describe("Parte que tocará (todo, sección X, campo Y)").default("todo"),
  },
  async (args: any) => {
    const { artefacto, agente, seccion } = args as any;
    const st = store.load();
st.ediciones = st.ediciones || {};
const activas = (st.ediciones[artefacto] || []).filter(e => !e.cerrada && new Date(e.expira) > new Date());
const solape = activas.find(e => e.agente !== agente && (e.seccion === "todo" || seccion === "todo" || e.seccion === seccion));
if (solape) {
  return ok({
    conflicto: true, artefacto, rival: { agente: solape.agente, seccion: solape.seccion, desde: solape.desde },
    estrategias: ["espera a que cierre con close_edit", "reduce tu seccion y coexistid", "raise_conflict para arbitrar"],
  });
}
st.ediciones[artefacto] = [...activas, { agente, seccion, desde: new Date().toISOString(), expira: new Date(Date.now() + 3600000).toISOString(), cerrada: false }];
store.save(st);
return ok({ conflicto: false, artefacto, seccion, editores_activos: st.ediciones[artefacto].length });
  }
);

server.tool(
  "close_edit",
  "Cierra una declaración de edición (terminaste con el artefacto).",
  {
  artefacto: z.string().describe("Artefacto"),
  agente: z.string().describe("Agent_id"),
  },
  async (args: any) => {
    const { artefacto, agente } = args as any;
    const st = store.load();
const lista = (st.ediciones || {})[artefacto];
if (!lista) return fail("sin ediciones declaradas");
const mias = lista.filter(e => e.agente === agente && !e.cerrada);
if (!mias.length) return fail("no tienes ediciones abiertas en " + artefacto);
for (const e of lista) if (e.agente === agente) e.cerrada = true;
store.save(st);
return ok({ cerradas: mias.length, siguen_abiertas: lista.filter(e => !e.cerrada).length });
  }
);

server.tool(
  "raise_conflict",
  "Eleva un conflicto formal (asunto/artefacto, partes, posturas) para que se arbitre.",
  {
  tipo: z.enum(["decision","edicion","duplicacion","prioridad"]).describe("Tipo de conflicto"),
  sujeto: z.string().describe("Asunto o artefacto en conflicto"),
  partes: z.array(z.any()).describe("Agent_ids implicados"),
  detalle: z.string().describe("Descripción del choque").optional(),
  },
  async (args: any) => {
    const { tipo, sujeto, partes, detalle } = args as any;
    const st = store.load();
st.conflictos = st.conflictos || [];
const id = "cf_" + Date.now().toString(36);
st.conflictos.push({ id, tipo, sujeto, partes: partes || [], detalle: detalle || null, estado: "abierto", ts: new Date().toISOString() });
store.save(st);
return ok({ conflicto_id: id, estrategias_sugeridas: { decision: "vote o escalar", edicion: "merge sección a sección", duplicacion: "divide el trabajo con blackboard", prioridad: "human decide" }[tipo] });
  }
);

server.tool(
  "resolve_conflict",
  "Resuelve un conflicto: merge documentado, votación, o escalamiento a humano; queda como precedente auditable.",
  {
  conflicto_id: z.string().describe("ID del conflicto"),
  estrategia: z.enum(["merge","vote","escalado_humano","seniority","coexistencia"]).describe("Cómo se resolvió"),
  resolucion: z.string().describe("Texto de la resolución final"),
  resuelto_por: z.string().describe("Quién arbitra"),
  },
  async (args: any) => {
    const { conflicto_id, estrategia, resolucion, resuelto_por } = args as any;
    const st = store.load();
const c = (st.conflictos || []).find(x => x.id === conflicto_id);
if (!c) return fail("conflicto no encontrado");
c.estado = "resuelto";
c.resolucion = { estrategia, texto: resolucion, por: resuelto_por, ts: new Date().toISOString() };
store.save(st);
return ok({ conflicto: c.id, resuelto: true, precedente: c.sujeto + ": " + resolucion + " (via " + estrategia + ")" });
  }
);

server.tool(
  "duplication_check",
  "Detecta trabajo duplicado: dos agentes haciendo lo mismo (por similitud de descripción de tarea).",
  {
  tareas: z.array(z.any()).describe("Lista de {agente, descripcion} activas para cruzar"),
  },
  async (args: any) => {
    const { tareas } = args as any;
    const items = (tareas || []).filter(t => t && t.descripcion);
if (items.length < 2) return fail("necesitas >=2 tareas {agente, descripcion}");
const norm = (s) => String(s).toLowerCase().replace(/[^\wáéíóúñ\s]/g, "").split(/\s+/).filter(w => w.length > 3);
const pares = [];
for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
    const a = new Set(norm(items[i].descripcion)), b = new Set(norm(items[j].descripcion));
    const inter = [...a].filter(w => b.has(w)).length;
    const jaccard = inter / new Set([...a, ...b]).size;
    if (jaccard >= 0.45) pares.push({ a: items[i], b: items[j], similitud: Number(jaccard.toFixed(2)) });
  }
}
pares.sort((x, y) => y.similitud - x.similitud);
return ok({
  tareas_analizadas: items.length, duplicados_detectados: pares.length,
  pares: pares.slice(0, 10),
  consejo: pares.length ? "cancela una de las dos o divide el alcance (claim en blackboard-shared)" : "sin duplicación",
});
  }
);

server.tool(
  "conflict_stats",
  "Estadísticas de conflictos por tipo, estrategia de resolución y tasa de escalamiento humano.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const cs = st.conflictos || [];
if (!cs.length) return ok({ total: 0 });
const porTipo = {}, porEstr = {};
for (const c of cs) { porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1; if (c.resolucion) porEstr[c.tipo + ":" + c.resolucion.estrategia] = (porEstr[c.tipo + ":" + c.resolucion.estrategia] || 0) + 1; }
const resueltos = cs.filter(c => c.estado === "resuelto").length;
return ok({
  total: cs.length, abiertos: cs.length - resueltos, resueltos,
  por_tipo: porTipo, por_estrategia: porEstr,
  tasa_escalamiento_humano: Number((cs.filter(c => c.resolucion?.estrategia === "escalado_humano").length / cs.length).toFixed(2)),
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor conflict-resolver está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "conflict-resolver", tools: 8, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[conflict-resolver] fatal:", e);
  process.exit(1);
});

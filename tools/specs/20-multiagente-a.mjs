// ═══ CATEGORÍA: Dolores FUTUROS · Multi-Agente y Coordinación (A) ═══
// Evidencia: "Types of Multi-Agent System Failures: 7 Common Failures" (ago-2026):
// costes de coordinación exponenciales, deadlocks, inconsistencia de estado,
// contentión de recursos. "Most multi-agent LLM systems fail from spec ambiguity
// and coordination gaps, not infrastructure" (sep-2025).
export default [
  {
    id: "agent-org-chart",
    title: "Agent Org Chart",
    tagline: "Registro vivo del equipo de agentes: roles, capacidades, autonomía y estado",
    category: "Multi-Agente y Coordinación",
    pain: "Cuando varios agentes colaboran, nadie sabe quién es quién: se duplican roles, se delega a quien no tiene la capacidad y no hay jerarquía de escalamiento.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/agent-org-chart/. Registro de agentes con rol, capacidades declaradas, nivel de autonomía (0-3) y estado operativo. Incluye matriz de capacidades y búsqueda por habilidad.",
    tools: [
      {
        name: "register_agent",
        desc: "Registra o actualiza un agente en el equipo: rol, capacidades, nivel de autonomía (0=ninguna,1=sugerir,2=ejecutar con aprobación,3=autónomo) y supervisor.",
        params: { agent_id: { t: "string", d: "Identificador único del agente" }, nombre: { t: "string", d: "Nombre legible" }, rol: { t: "string", d: "Rol en el equipo (ej: researcher, coder, reviewer)" }, capacidades: { t: "array", d: "Lista de capacidades declaradas", opt: true, def: [] }, nivel_autonomia: { t: "number", d: "0-3: 0 ninguna, 1 sugerir, 2 ejecutar con aprobación, 3 autónomo", opt: true, def: 2 }, supervisor: { t: "string", d: "Agent_id del supervisor (null = raíz)", opt: true } },
        code: `const st = store.load();
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
return ok({ agente: st.agents[agent_id], actualizado: !!previo, total_equipo: Object.keys(st.agents).length });`,
      },
      {
        name: "get_agent",
        desc: "Devuelve la ficha completa de un agente: capacidades, autonomía, cadena de supervisión y carga actual.",
        params: { agent_id: { t: "string", d: "ID del agente" } },
        code: `const st = store.load();
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
const subordinados = Object.values(st.agents).filter(x => x.supervisor === agent_id).map(x => x.agent_id);
return ok({ ...a, cadena_supervision: cadena, subordinados, nivel_jerarquico: cadena.length });`,
      },
      {
        name: "list_agents",
        desc: "Roster del equipo con filtros por rol, estado y autonomía; incluye contadores resumen.",
        params: { rol: { t: "string", d: "Filtrar por rol exacto", opt: true }, estado: { t: "string", d: "Filtrar por estado (activo, pausado, retirado)", opt: true }, min_autonomia: { t: "number", d: "Autonomía mínima 0-3", opt: true } },
        code: `const st = store.load();
let lista = Object.values(st.agents || {});
if (rol) lista = lista.filter(a => a.rol === rol);
if (estado) lista = lista.filter(a => (a.estado || "activo") === estado);
if (min_autonomia !== undefined) lista = lista.filter(a => (a.nivel_autonomia ?? 2) >= min_autonomia);
const por_rol = {};
for (const a of Object.values(st.agents || {})) por_rol[a.rol] = (por_rol[a.rol] || 0) + 1;
return ok({
  total: lista.length,
  por_rol,
  agentes: lista.map(a => ({ agent_id: a.agent_id, nombre: a.nombre, rol: a.rol, autonomia: a.nivel_autonomia, estado: a.estado || "activo", capacidades: a.capacidades.length })),
});`,
      },
      {
        name: "find_by_capability",
        desc: "Busca agentes capaces de X: matching por capacidad exacta y capacidades relacionadas (similitud de tokens).",
        params: { capacidad: { t: "string", d: "Capacidad buscada (ej: pdf, sql, navegador)" }, solo_activos: { t: "boolean", d: "Excluir agentes pausados/retirados", opt: true, def: true } },
        code: `const st = store.load();
const norm = (s) => String(s).toLowerCase().trim();
const objetivo = norm(capacidad).split(/[\\s_-]+/);
const resultados = [];
for (const a of Object.values(st.agents || {})) {
  if (solo_activos && (a.estado || "activo") !== "activo") continue;
  let mejor = 0, matched = [];
  for (const c of a.capacidades || []) {
    const tokens = norm(c).split(/[\\s_-]+/);
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
return ok({ capacidad, coincidencias: resultados.slice(0, 10) });`,
      },
      {
        name: "update_status",
        desc: "Cambia el estado operativo de un agente (activo, pausado, saturado, retirado) con nota opcional.",
        params: { agent_id: { t: "string", d: "ID del agente" }, estado: { t: "enum", d: "Nuevo estado", values: ["activo", "pausado", "saturado", "retirado"] }, nota: { t: "string", d: "Motivo del cambio", opt: true } },
        code: `const st = store.load();
const a = (st.agents || {})[agent_id];
if (!a) return fail("agente no registrado: " + agent_id);
a.estado = estado;
a.actualizado = new Date().toISOString();
if (nota) { a.historial_estado = a.historial_estado || []; a.historial_estado.push({ estado, nota, ts: a.actualizado }); }
store.save(st);
return ok({ agent_id, estado, nota: nota || null });`,
      },
      {
        name: "capability_matrix",
        desc: "Matriz capacidades × agentes: detecta capacidades huérfanas (nadie las cubre) y redundancias excesivas.",
        params: {},
        code: `const st = store.load();
const agentes = Object.values(st.agents || {});
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
const redundantes = Object.entries(matriz).filter(([, v]) => v.length > 3).map(([k, v]) => ({ capacidad: k, agentes: v.length }));
const monopolios = Object.entries(matriz).filter(([, v]) => v.length === 1).map(([k, v]) => ({ capacidad: k, unico_agente: v[0] }));
return ok({
  total_agentes: agentes.length,
  total_capacidades: Object.keys(matriz).length,
  matriz,
  capacidades_huerfanas_sugeridas: huérfanas,
  capacidades_redundantes: redundantes,
  puntosunicos_de_fallo: monopolios,
  advertencia: monopolios.length > 0 ? "hay capacidades cubiertas por un solo agente (riesgo SPOF)" : "cobertura sin puntos únicos de fallo",
});`,
      },
      {
        name: "org_snapshot",
        desc: "Fotografía de salud del equipo: profundidad jerárquica, autonomía media, agentes sin supervisor y balance de carga.",
        params: {},
        code: `const st = store.load();
const agentes = Object.values(st.agents || {});
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
    ...((st.agents ? Object.values(st.agents).filter(a => (a.estado || "activo") === "saturado").length : 0) > 0 ? ["hay agentes saturados: redistribuye con update_status"] : []),
  ],
});`,
      },
    ],
  },
  {
    id: "delegation-contracts",
    title: "Delegation Contracts",
    tagline: "Contratos verificables de delegación entre agentes: objetivo, criterios, presupuesto y veredicto",
    category: "Multi-Agente y Coordinación",
    pain: "La delegación entre agentes es un 'ahí te va esto' sin criterios verificables: el sub-agente devuelve lo que interpreta, el delegador no puede aceptar/rechazar con evidencia y no hay historial de rework.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/delegation-contracts/. Ciclo: create → submit_deliverable → review (aprobado/rechazado/rework) con presupuesto de tokens y deadline. Estadísticas de éxito y rework.",
    tools: [
      {
        name: "create_contract",
        desc: "Crea un contrato de delegación: objetivo medible, criterios de aceptación, presupuesto de tokens, deadline y penalización por rework.",
        params: { delegador: { t: "string", d: "Agent_id que delega" }, delegado: { t: "string", d: "Agent_id que ejecuta" }, objetivo: { t: "string", d: "Objetivo del encargo, verificable" }, criterios_aceptacion: { t: "array", d: "Lista de criterios verificables de aceptación" }, presupuesto_tokens: { t: "number", d: "Presupuesto máximo de tokens", opt: true }, deadline_horas: { t: "number", d: "Plazo en horas desde ahora", opt: true }, contexto: { t: "string", d: "Contexto esencial para el delegado", opt: true } },
        code: `if (!Array.isArray(criterios_aceptacion) || criterios_aceptacion.length === 0) return fail("sin criterios de aceptación no hay contrato verificable (spec ambiguity)");
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
return ok({ contrato_id: id, estado: "abierto", criterios: criterios_aceptacion.length, deadline: st.contratos.at(-1).deadline, aviso: "el delegado debe llamar submit_deliverable con evidencia por criterio" });`,
      },
      {
        name: "get_contract",
        desc: "Contrato completo con entregas, revisiones y evaluación de vencimiento.",
        params: { contrato_id: { t: "string", d: "ID del contrato" } },
        code: `const st = store.load();
const c = (st.contratos || []).find(x => x.id === contrato_id);
if (!c) return fail("contrato no encontrado: " + contrato_id);
const vencido = c.deadline && new Date(c.deadline) < new Date() && c.estado === "abierto";
return ok({ ...c, vencido: !!vencido, dias_desde_creacion: Number(((Date.now() - new Date(c.creado)) / 86400000).toFixed(2)) });`,
      },
      {
        name: "list_contracts",
        desc: "Lista contratos con filtro por estado, delegado o delegador.",
        params: { estado: { t: "string", d: "abierto, entregado, aprobado, rechazado, rework, escalado, vencido", opt: true }, delegado: { t: "string", d: "Filtrar por agente ejecutor", opt: true }, delegador: { t: "string", d: "Filtrar por agente delegante", opt: true } },
        code: `const st = store.load();
let lista = st.contratos || [];
if (estado) lista = lista.filter(c => c.estado === estado);
if (delegado) lista = lista.filter(c => c.delegado === delegado);
if (delegador) lista = lista.filter(c => c.delegador === delegador);
return ok({
  total: lista.length,
  contratos: lista.map(c => ({ id: c.id, objetivo: c.objetivo.slice(0, 90), delegador: c.delegador, delegado: c.delegado, estado: c.estado, entregas: c.entregas.length, vencido: !!(c.deadline && new Date(c.deadline) < new Date() && c.estado === "abierto") })),
});`,
      },
      {
        name: "submit_deliverable",
        desc: "El delegado entrega: resumen del resultado, evidencia por criterio y tokens consumidos.",
        params: { contrato_id: { t: "string", d: "ID del contrato" }, resumen: { t: "string", d: "Resumen del trabajo realizado" }, evidencias: { t: "array", d: "Evidencias alineadas a los criterios (texto)" }, tokens_usados: { t: "number", d: "Tokens consumidos", opt: true } },
        code: `const st = store.load();
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
});`,
      },
      {
        name: "review",
        desc: "El delegador revisa la última entrega: marca cada criterio cumplido/no e imprime veredicto (aprobado, rework o rechazado).",
        params: { contrato_id: { t: "string", d: "ID del contrato" }, criterios_cumplidos: { t: "array", d: "Números de criterios cumplidos (ej: [1,2,4])" }, veredicto: { t: "enum", d: "Veredicto final", values: ["aprobado", "rework", "rechazado"] }, notas: { t: "string", d: "Notas del revisor", opt: true } },
        code: `const st = store.load();
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
});`,
      },
      {
        name: "escalate_contract",
    desc: "Escala un contrato atascado (rework repetido, deadline vencido, presupuesto excedido) al supervisor con contexto.",
        params: { contrato_id: { t: "string", d: "ID del contrato" }, razon: { t: "string", d: "Motivo del escalamiento" }, hacia: { t: "string", d: "Agent_id o 'humano' del destinatario", opt: true, def: "humano" } },
        code: `const st = store.load();
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
});`,
      },
      {
        name: "contract_stats",
        desc: "Estadísticas de delegación: tasa de aprobación, rework medio, escalaciones y desviación de presupuesto.",
        params: {},
        code: `const st = store.load();
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
  peor_delegado: (() => { const g = {}; for (const c of cs) { if (c.estado === "rework" || c.estado === "escalado") g[c.delegado] = (g[c.delegado] || 0) + 1; } const e = Object.entries(g).sort((a, b) => b[1] - a[1])[0]; return e ? { delegado: e[0], incidencias: e[1] } : null; })(),
});`,
      },
      {
        name: "amend_contract",
        desc: "Enmienda un contrato abierto: ajusta criterios, presupuesto o deadline dejando auditoría del cambio.",
        params: { contrato_id: { t: "string", d: "ID del contrato" }, criterios_extra: { t: "array", d: "Criterios nuevos a añadir", opt: true }, presupuesto_tokens: { t: "number", d: "Nuevo presupuesto", opt: true }, deadline_horas: { t: "number", d: "Nuevo plazo en horas desde ahora", opt: true }, motivo: { t: "string", d: "Motivo de la enmienda" } },
        code: `const st = store.load();
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
return ok({ contrato: c.id, enmienda_n: c.enmiendas.length, criterios_totales: c.criterios.length, historial: c.enmiendas.length });`,
      },
    ],
  },
  {
    id: "handoff-protocol",
    title: "Handoff Protocol",
    tagline: "Transferencias estructuradas entre agentes con checklist de comprensión y score de calidad",
    category: "Multi-Agente y Coordinación",
    pain: "Los handoffs entre agentes pierden estado: el receptor reinventa el contexto, repite trabajo ya hecho y descubre los riesgos tarde. 'Coordination gaps' es causa raíz de fallo multi-agente.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/handoff-protocol/. Handoff = contexto + estado + pendientes + riesgos. El receptor hace acknowledge con preguntas; se mide la calidad (completitud de secciones) y cuántos handoffs quedaron huérfanos.",
    tools: [
      {
        name: "create_handoff",
        desc: "Crea un handoff estructurado: resumen de contexto, estado actual, pendientes priorizados, riesgos conocidos y artefactos clave.",
        params: { de: { t: "string", d: "Agent_id que transfiere" }, para: { t: "string", d: "Agent_id que recibe" }, contexto: { t: "string", d: "Resumen del contexto esencial (objetivo, decisiones tomadas)" }, estado_actual: { t: "string", d: "En qué punto exacto está el trabajo" }, pendientes: { t: "array", d: "Tareas pendientes", opt: true, def: [] }, riesgos: { t: "array", d: "Riesgos conocidos y trampas", opt: true, def: [] }, artefactos: { t: "array", d: "Rutas/IDs de artefactos relevantes", opt: true, def: [] } },
        code: `const st = store.load();
st.handoffs = st.handoffs || [];
const id = "ho_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const h = {
  id, de, para,
  contexto, estado_actual,
  pendientes: (pendientes || []).map((p, i) => ({ n: i + 1, tarea: String(p), hecho: false })),
  riesgos: (riesgos || []).map(String),
  artefactos: (artefactos || []).map(String),
  acknowledge: null, estado: "creado",
  creado: new Date().toISOString(),
};
st.handoffs.push(h);
store.save(st);
const score = [h.contexto.length > 80, h.estado_actual.length > 30, h.pendientes.length > 0, h.riesgos.length > 0, h.artefactos.length > 0].filter(Boolean).length * 20;
return ok({ handoff_id: id, calidad_preliminar: score + "/100", aviso: score < 60 ? "handoff pobre: el receptor deberá interrumpir con preguntas. Amplía contexto/riesgos" : "handoff aceptable" });`,
      },
      {
        name: "get_handoff",
        desc: "Handoff completo con checklist de recepción sugerida.",
        params: { handoff_id: { t: "string", d: "ID del handoff" } },
        code: `const st = store.load();
const h = (st.handoffs || []).find(x => x.id === handoff_id);
if (!h) return fail("handoff no encontrado: " + handoff_id);
return ok({
  ...h,
  checklist_recepcion: [
    "relee el objetivo y decisiones ya tomadas",
    "verifica artefactos antes de tocarlos",
    ...h.pendientes.map(p => "pendiente " + p.n + ": " + p.tarea),
    ...(h.riesgos.length ? ["pregunta por los riesgos si algo no cuadra"] : []),
  ],
});`,
      },
      {
        name: "acknowledge",
        desc: "El receptor confirma recepción, declara qué entendió y qué preguntas tiene; devuelve los gaps detectados.",
        params: { handoff_id: { t: "string", d: "ID del handoff" }, entendido: { t: "string", d: "Qué entendió el receptor (sus palabras)" }, preguntas: { t: "array", d: "Preguntas o ambigüedades detectadas", opt: true, def: [] }, acepta: { t: "boolean", d: "false = rechaza el handoff por incompleto", opt: true, def: true } },
        code: `const st = store.load();
const h = (st.handoffs || []).find(x => x.id === handoff_id);
if (!h) return fail("handoff no encontrado");
if (h.acknowledge) return fail("ya hay acknowledge: " + h.acknowledge.ts);
h.acknowledge = { entendido, preguntas: preguntas || [], acepta, ts: new Date().toISOString() };
h.estado = acepta ? "aceptado" : "rechazado";
store.save(st);
const overlapTokens = entendido.toLowerCase().split(/\\W+/).filter(w => w.length > 4);
const ctxTokens = new Set(h.contexto.toLowerCase().split(/\\W+/).filter(w => w.length > 4));
const eco = overlapTokens.filter(w => ctxTokens.has(w)).length / Math.max(new Set(overlapTokens).size, 1);
return ok({
  acepta, preguntas_abiertas: (preguntas || []).length,
  fidelidad_comprension: Number(eco.toFixed(2)),
  aviso: (preguntas || []).length > 3 ? "muchas preguntas: el handoff original fue débil, considera transferir de nuevo" : eco < 0.15 ? "el receptor no parafrasea nada del contexto: posible malentendido" : "recepción sana",
});`,
      },
      {
        name: "list_handoffs",
        desc: "Lista handoffs por dirección, estado o agente; marca los huérfanos (sin acknowledge).",
        params: { agente: { t: "string", d: "Filtrar de/para este agente", opt: true }, estado: { t: "string", d: "creado, aceptado, rechazado, cerrado", opt: true } },
        code: `const st = store.load();
let hs = st.handoffs || [];
if (agente) hs = hs.filter(h => h.de === agente || h.para === agente);
if (estado) hs = hs.filter(h => h.estado === estado);
return ok({
  total: hs.length,
  sin_acknowledge: hs.filter(h => !h.acknowledge).length,
  handoffs: hs.map(h => ({ id: h.id, de: h.de, para: h.para, estado: h.estado, pendientes: h.pendientes.length, ack: !!h.acknowledge, edad_horas: Number(((Date.now() - new Date(h.creado)) / 3600000).toFixed(1)) })),
});`,
      },
      {
        name: "complete_task",
        desc: "Marca un pendiente del handoff como hecho (quien recibe avanza sin perder rastro).",
        params: { handoff_id: { t: "string", d: "ID del handoff" }, n: { t: "number", d: "Número del pendiente" } },
        code: `const st = store.load();
const h = (st.handoffs || []).find(x => x.id === handoff_id);
if (!h) return fail("handoff no encontrado");
const p = h.pendientes.find(x => x.n === n);
if (!p) return fail("pendiente inexistente: " + n + " (hay " + h.pendientes.length + ")");
p.hecho = true; p.completado = new Date().toISOString();
store.save(st);
const restantes = h.pendientes.filter(x => !x.hecho).length;
if (restantes === 0) h.estado = "cerrado", store.save(st);
return ok({ pendiente: p.tarea, hecho: true, restantes, estado_handoff: h.estado });`,
      },
      {
        name: "handoff_quality",
        desc: "Audita un handoff: completitud de secciones, densidad de contexto, riesgos declarados y resultado del acknowledge.",
        params: { handoff_id: { t: "string", d: "ID del handoff" } },
        code: `const st = store.load();
const h = (st.handoffs || []).find(x => x.id === handoff_id);
if (!h) return fail("handoff no encontrado");
const secciones = {
  contexto: h.contexto.length > 80 ? 20 : h.contexto.length / 4,
  estado: h.estado_actual.length > 30 ? 20 : h.estado_actual.length * 2 / 3,
  pendientes: Math.min(h.pendientes.length * 7, 20),
  riesgos: Math.min(h.riesgos.length * 10, 20),
  artefactos: Math.min(h.artefactos.length * 10, 20),
};
const total = Math.round(Object.values(secciones).reduce((a, b) => a + b, 0));
const penal = h.acknowledge && !h.acknowledge.acepta ? 20 : (h.acknowledge?.preguntas?.length || 0) * 3;
const final = Math.max(0, total - penal);
return ok({
  score: final + "/100",
  desglose: Object.fromEntries(Object.entries(secciones).map(([k, v]) => [k, Math.round(v) + "/20"])),
  penalizacion_por_preguntas: penal,
  veredicto: final >= 80 ? "handoff sólido" : final >= 50 ? "aceptable con huecos" : "handoff deficiente: transfere de nuevo antes de trabajar",
});`,
      },
      {
        name: "handoff_stats",
        desc: "Estadísticas de transferencias: ratio de aceptación, preguntas medias, huérfanos y tiempo hasta acknowledge.",
        params: {},
        code: `const st = store.load();
const hs = st.handoffs || [];
if (!hs.length) return ok({ total: 0 });
const acks = hs.filter(h => h.acknowledge);
return ok({
  total: hs.length,
  aceptados: acks.filter(h => h.acknowledge.acepta).length,
  rechazados: acks.filter(h => !h.acknowledge.acepta).length,
  huerfanos_sin_ack: hs.length - acks.length,
  preguntas_medias: acks.length ? Number((acks.reduce((s, h) => s + h.acknowledge.preguntas.length, 0) / acks.length).toFixed(1)) : null,
  minutos_hasta_ack_medio: acks.length ? Number((acks.reduce((s, h) => s + (new Date(h.acknowledge.ts) - new Date(h.creado)), 0) / acks.length / 60000).toFixed(1)) : null,
});`,
      },
    ],
  },
  {
    id: "blackboard-shared",
    title: "Blackboard Shared",
    tagline: "Pizarra compartida con locks con TTL para coordinar agentes sin duplicar trabajo",
    category: "Multi-Agente y Coordinación",
    pain: "Varios agentes trabajando en paralelo pisan el mismo dato, duplican búsquedas costosas y se pisan entre ellos por ausencia de un espacio de coordinación compartido con exclusión.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/blackboard-shared/. Patrón blackboard: entradas etiquetadas + claim/release con TTL (evita locks muertos si un agente cae). Mide duplicación evitada.",
    tools: [
      {
        name: "post",
        desc: "Publica una entrada en la pizarra bajo una clave con etiquetas y visibilidad. Idempotente por versión.",
        params: { clave: { t: "string", d: "Clave de la entrada (ej: research/competidores)" }, contenido: { t: "any", d: "Contenido (texto o JSON)" }, autor: { t: "string", d: "Agent_id autor" }, etiquetas: { t: "array", d: "Etiquetas para búsqueda", opt: true, def: [] } },
        code: `const st = store.load();
st.entradas = st.entradas || {};
st.eventos = st.eventos || [];
const e = st.entradas[clave];
const nuevo = { clave, contenido, autor, etiquetas: etiquetas || [], version: e ? e.version + 1 : 1, actualizado: new Date().toISOString(), lecturas: e?.lecturas || 0 };
st.entradas[clave] = nuevo;
st.eventos.push({ tipo: "post", clave, autor, version: nuevo.version, ts: nuevo.actualizado });
if (st.eventos.length > 2000) st.eventos = st.eventos.slice(-1000);
store.save(st);
return ok({ clave, version: nuevo.version, aviso: e && e.autor !== autor ? "OJO: sobrescribiste entrada de " + e.autor + " (versión " + (nuevo.version - 1) + ")" : "publicado" });`,
      },
      {
        name: "read",
        desc: "Lee entradas por clave exacta o etiqueta; registra lecturas (quién consumió qué).",
        params: { clave: { t: "string", d: "Clave exacta", opt: true }, etiqueta: { t: "string", d: "Buscar por etiqueta", opt: true }, lector: { t: "string", d: "Agent_id que lee", opt: true, def: "anon" } },
        code: `const st = store.load();
const entradas = Object.values(st.entradas || {});
if (!clave && !etiqueta) return fail("indica clave o etiqueta");
let hits = clave ? entradas.filter(e => e.clave === clave) : entradas.filter(e => (e.etiquetas || []).includes(etiqueta));
if (!hits.length) return ok({ encontrados: 0, sugerencia: "públicalo primero con post (o busca otra etiqueta)" });
for (const e of hits) { e.lecturas = (e.lecturas || 0) + 1; }
st.lecturas = st.lecturas || [];
for (const e of hits) st.lecturas.push({ clave: e.clave, lector, ts: new Date().toISOString() });
store.save(st);
return ok({ encontrados: hits.length, entradas: hits.map(e => ({ clave: e.clave, autor: e.autor, version: e.version, etiquetas: e.etiquetas, lecturas: e.lecturas, contenido: e.contenido })) });`,
      },
      {
        name: "claim",
        desc: "Reclama exclusividad sobre una clave por un agente con TTL (segundos). Devuelve conflicto si ya está reclamada.",
        params: { clave: { t: "string", d: "Clave a reclamar" }, agente: { t: "string", d: "Agent_id que reclama" }, ttl_segundos: { t: "number", d: "Vigencia del reclamo", opt: true, def: 600 } },
        code: `const st = store.load();
st.locks = st.locks || {};
const ahora = Date.now();
for (const [k, l] of Object.entries(st.locks)) if (new Date(l.expira).getTime() < ahora) delete st.locks[k];
const l = st.locks[clave];
if (l && l.agente !== agente && new Date(l.expira).getTime() > ahora) {
  return ok({ reclamado: false, dueño: l.agente, expira: l.expira, segundos_restantes: Math.round((new Date(l.expira).getTime() - ahora) / 1000), consejo: "espera o lee el resultado con read cuando expire" });
}
const renuevo = l && l.agente === agente;
st.locks[clave] = { agente, expira: new Date(ahora + ttl_segundos * 1000).toISOString(), desde: renuevo ? l.desde : new Date().toISOString() };
store.save(st);
return ok({ reclamado: true, clave, agente, expira: st.locks[clave].expira, renovado: renuevo });`,
      },
      {
        name: "release",
        desc: "Libera el reclamo de una clave (solo el dueño o un supervisor con forzar).",
        params: { clave: { t: "string", d: "Clave a liberar" }, agente: { t: "string", d: "Agent_id que libera" }, forzar: { t: "boolean", d: "Forzar aunque no sea dueño (supervisor)", opt: true, def: false } },
        code: `const st = store.load();
const l = (st.locks || {})[clave];
if (!l) return ok({ liberado: false, razon: "no había lock" });
if (l.agente !== agente && !forzar) return fail("la clave la tiene " + l.agente + " hasta " + l.expira + " (usa forzar=true si eres supervisor)");
delete st.locks[clave];
store.save(st);
return ok({ liberado: true, clave, tenia: l.agente, forzado: l.agente !== agente });`,
      },
      {
        name: "append",
        desc: "Añade contenido a una entrada existente de forma atómica (para resultados acumulativos de varios agentes).",
        params: { clave: { t: "string", d: "Clave de la entrada" }, contenido: { t: "any", d: "Contenido a añadir" }, autor: { t: "string", d: "Agent_id que aporta" } },
        code: `const st = store.load();
const e = (st.entradas || {})[clave];
if (!e) return fail("entrada inexistente: publícala primero con post");
e.contenido = Array.isArray(e.contenido) ? [...e.contenido, contenido] : { partes: [e.contenido, contenido] };
e.version++; e.actualizado = new Date().toISOString();
e.contribuyentes = [...new Set([...(e.contribuyentes || []), autor])];
store.save(st);
return ok({ clave, version: e.version, contribuyentes: e.contribuyentes });`,
      },
      {
        name: "list_locks",
        desc: "Locks activos con dueño y expiración; señala los próximos a caducar.",
        params: {},
        code: `const st = store.load();
const ahora = Date.now();
const vivos = Object.entries(st.locks || {}).filter(([, l]) => new Date(l.expira).getTime() > ahora);
return ok({
  activos: vivos.length,
  locks: vivos.map(([clave, l]) => ({ clave, agente: l.agente, segundos_restantes: Math.round((new Date(l.expira).getTime() - ahora) / 1000) })).sort((a, b) => a.segundos_restantes - b.segundos_restantes),
  proximo_a_expirar: vivos.sort((a, b) => new Date(a[1].expira) - new Date(b[1].expira))[0]?.[0] || null,
});`,
      },
      {
        name: "board_stats",
        desc: "Salud de la pizarra: entradas, conflictos de escritura evitados, duplicación de lectura y agentes más activos.",
        params: {},
        code: `const st = store.load();
const entradas = Object.values(st.entradas || {});
const lecturas = st.lecturas || [];
const lecturasPorEntrada = {};
for (const r of lecturas) lecturasPorEntrada[r.clave] = (lecturasPorEntrada[r.clave] || 0) + 1;
const topLeido = Object.entries(lecturasPorEntrada).sort((a, b) => b[1] - a[1]).slice(0, 5);
const autores = {};
for (const e of entradas) autores[e.autor] = (autores[e.autor] || 0) + 1;
const conflictos = (st.eventos || []).filter(ev => ev.tipo === "post" && ev.version > 1).length;
return ok({
  entradas: entradas.length, eventos: (st.eventos || []).length,
  conflictos_escritura_versionados: conflictos,
  entradas_mas_leidas: topLeido.map(([k, v]) => ({ clave: k, lecturas: v })),
  ahorro_estimado: topLeido.reduce((s, [, v]) => s + (v - 1), 0) + " re-lecturas servidas desde pizarra",
  autores_mas_activos: Object.entries(autores).sort((a, b) => b[1] - a[1]).slice(0, 5),
});`,
      },
      {
        name: "purge",
        desc: "Limpia entradas antiguas o locks muertos; devuelve espacio liberado.",
        params: { max_edad_dias: { t: "number", d: "Eliminar entradas más viejas que esto", opt: true, def: 30 }, solo_locks_muertos: { t: "boolean", d: "Solo purgar locks expirados", opt: true, def: false } },
        code: `const st = store.load();
const limite = Date.now() - max_edad_dias * 86400000;
const antes = Object.keys(st.entradas || {}).length + Object.keys(st.locks || {}).length;
const ahora = Date.now();
for (const [k, l] of Object.entries(st.locks || {})) if (new Date(l.expira).getTime() < ahora) delete st.locks[k];
if (!solo_locks_muertos) for (const [k, e] of Object.entries(st.entradas || {})) if (new Date(e.actualizado).getTime() < limite) delete st.entradas[k];
store.save(st);
return ok({ eliminados: antes - (Object.keys(st.entradas || {}).length + Object.keys(st.locks || {}).length), quedan_entradas: Object.keys(st.entradas || {}).length, quedan_locks: Object.keys(st.locks || {}).length });`,
      },
    ],
  },
];

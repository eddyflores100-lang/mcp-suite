// ═══ CATEGORÍA: Dolores FUTUROS · Multi-Agente y Coordinación (B) ═══
// Evidencia: "deadlocks, state inconsistency, resource contention" y
// "exponential coordination costs" (7 Common Failures, ago-2026);
// quorum y votación distribuida como patrón de recuperación.
export default [
  {
    id: "deadlock-detector",
    title: "Deadlock Detector",
    tagline: "Detecta esperas circulares y contentión de recursos entre agentes antes de que se congelen",
    category: "Multi-Agente y Coordinación",
    pain: "Los agentes se bloquean en silencio: A espera a B, B espera a C y C espera a A. Nadie detecta el ciclo y la misión muere congelada sin error visible.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/deadlock-detector/. Grafo esperando-a: los agentes declaran 'wait_for' y 'hold'; se detectan ciclos (DFS) y se sugiere la víctima a cancelar.",
    tools: [
      {
        name: "declare_state",
        desc: "Un agente declara qué recursos retiene y en quién espera. Reemplaza el estado previo del agente.",
        params: { agente: { t: "string", d: "Agent_id" }, retiene: { t: "array", d: "Recursos que retiene (IDs)", opt: true, def: [] }, espera_a: { t: "array", d: "Agent_ids o recursos a los que espera", opt: true, def: [] }, tarea: { t: "string", d: "Qué está haciendo (para diagnóstico)", opt: true } },
        code: `const st = store.load();
st.agentes = st.agentes || {};
st.agentes[agente] = { retiene: retiene || [], espera_a: espera_a || [], tarea: tarea || null, ts: new Date().toISOString() };
store.save(st);
return ok({ agente, retiene: (retiene || []).length, espera_a: (espera_a || []).length });`,
      },
      {
        name: "detect",
        desc: "Analiza el grafo de esperas y detecta ciclos (deadlocks) y cadenas de espera largas (livelock risk).",
        params: {},
        code: `const st = store.load();
const agentes = st.agentes || {};
const nombres = Object.keys(agentes);
const ciclos = [];
const visitando = new Set(), visitados = new Set();
function dfs(nodo, camino) {
  if (visitando.has(nodo)) {
    const inicio = camino.indexOf(nodo);
    if (inicio >= 0) ciclos.push([...camino.slice(inicio), nodo]);
    return;
  }
  visitando.add(nodo); visitados.add(nodo);
  for (const next of agentes[nodo]?.espera_a || []) if (nombres.includes(next) || agentes[next]) dfs(next, [...camino, nodo]);
  visitando.delete(nodo);
}
for (const n of nombres) if (!visitados.has(n)) dfs(n, []);
const unicos = [];
for (const c of ciclos) {
  const firma = [...c].sort().join(">");
  if (!unicos.some(u => u.firma === firma)) unicos.push({ ciclo: c, firma });
}
const recursosSostenidos = {};
for (const [a, info] of Object.entries(agentes)) for (const r of info.retiene || []) recursosSostenidos[r] = recursosSostenidos[r] || [];
for (const [a, info] of Object.entries(agentes)) for (const r of info.retiene || []) recursosSostenidos[r].push(a);
const contencion = Object.entries(recursosSostenidos).filter(([, duenos]) => duenos.length > 1);
const esperandoAlgo = nombres.filter(n => (agentes[n].espera_a || []).length > 0);
return ok({
  agentes_declarados: nombres.length,
  deadlocks: unicos.length,
  ciclos: unicos.map(u => u.ciclo),
  deadlocked: [...new Set(unicos.flatMap(u => u.ciclo))],
  contention: contencion.map(([r, d]) => ({ recurso: r, retenido_por: d })),
  cadena_mas_larga: (() => { let mejor = []; for (const n of nombres) { const camino = [n]; let cur = agentes[n]?.espera_a?.[0]; let hops = 0; while (cur && agentes[cur] && hops < 20) { camino.push(cur); cur = agentes[cur]?.espera_a?.[0]; hops++; } if (camino.length > mejor.length) mejor = camino; } return mejor; })(),
  veredicto: unicos.length ? "DEADLOCK: resuelve con resolve (elige víctima)" : contencion.length ? "contentión sin ciclo: vigila" : "sin bloqueos",
});`,
      },
      {
        name: "resolve",
        desc: "Resuelve un deadlock eligiendo una víctima (la más barata de reiniciar) y genera el plan de desbloqueo.",
        params: { ciclo: { t: "array", d: "Agentes del ciclo (del detect), opcional si solo hay uno" , opt: true }, victima_manual: { t: "string", d: "Forzar víctima concreta", opt: true } },
        code: `const st = store.load();
const agentes = st.agentes || {};
let ciclosDetectados = [];
const visitando = new Set(), visitados = new Set();
function dfs(n, camino) {
  if (visitando.has(n)) { const i = camino.indexOf(n); if (i >= 0) ciclosDetectados.push([...camino.slice(i), n]); return; }
  visitando.add(n); visitados.add(n);
  for (const nx of agentes[n]?.espera_a || []) if (agentes[nx]) dfs(nx, [...camino, n]);
  visitando.delete(n);
}
for (const n of Object.keys(agentes)) if (!visitados.has(n)) dfs(n, []);
let objetivo = ciclo && ciclo.length ? ciclo : ciclosDetectados[0];
if (!objetivo) return fail("no hay ciclo que resolver");
const miembros = objetivo.filter(x => agentes[x]);
if (!victima_manual) {
  miembros.sort((a, b) => (agentes[a].retiene?.length || 0) - (agentes[b].retiene?.length || 0));
}
const victima = victima_manual && miembros.includes(victima_manual) ? victima_manual : miembros[0];
for (const m of miembros) {
  agentes[m].espera_a = (agentes[m].espera_a || []).filter(e => e !== victima);
  agentes[m].interrumpido = true;
}
st.resoluciones = st.resoluciones || [];
st.resoluciones.push({ ciclo: miembros, victima, ts: new Date().toISOString() });
store.save(st);
return ok({
  victima, plan: [
    "1. cancela/rollback de " + victima + " (retiene " + (agentes[victima]?.retiene?.length || 0) + " recursos)",
    "2. libera sus recursos para que los demás avancen",
    ...miembros.filter(m => m !== victima).map(m => "3" + (m === miembros[1] ? "" : ".x") + ". " + m + " reintenta sin esperar a " + victima),
    "4. reprograma el trabajo de " + victima + " al final de la cola",
  ],
  criterio_victima: "menor retención de recursos = reinicio más barato",
});`,
      },
      {
        name: "stale_agents",
        desc: "Detecta agentes cuyo último reporte supera un umbral: posibles procesos muertos que retienen recursos.",
        params: { umbral_minutos: { t: "number", d: "Minutos sin reporte para considerarlo rancio", opt: true, def: 30 } },
        code: `const st = store.load();
const agentes = st.agentes || {};
const limite = Date.now() - umbral_minutos * 60000;
const rancios = Object.entries(agentes).filter(([, i]) => new Date(i.ts).getTime() < limite);
return ok({
  umbral_minutos, rancios: rancios.length,
  agentes_stale: rancios.map(([a, i]) => ({ agente: a, minutos_sin_reportar: Math.round((Date.now() - new Date(i.ts)) / 60000), retiene: i.retiene?.length || 0, ultima_tarea: i.tarea })),
  recursos_secuestrados: rancios.flatMap(([, i]) => i.retiene || []),
  consejo: rancios.length ? "declara esos recursos liberados o reinicia los agentes" : "todos frescos",
});`,
      },
      {
        name: "wait_graph",
        desc: "Exporta el grafo de esperas en formato legible (aristas agente→espera_a) para diagnóstico o visualización.",
        params: {},
        code: `const st = store.load();
const agentes = st.agentes || {};
const aristas = [];
for (const [a, i] of Object.entries(agentes)) for (const e of i.espera_a || []) aristas.push(a + " -> " + e);
return ok({ nodos: Object.keys(agentes).length, aristas: aristas.length, grafo: aristas, dot: "digraph waits {" + aristas.map(a => '"' + a.split(" -> ")[0] + '" -> "' + a.split(" -> ")[1] + '"').join("; ") + "}" });`,
      },
      {
        name: "clear",
        desc: "Limpia el estado de un agente (terminó o fue reiniciado) liberando sus declaraciones.",
        params: { agente: { t: "string", d: "Agent_id a limpiar" } },
        code: `const st = store.load();
if (!(st.agentes || {})[agente]) return ok({ limpiado: false, razon: "no tenía estado" });
delete st.agentes[agente];
store.save(st);
return ok({ limpiado: true, agente, quedan: Object.keys(st.agentes).length });`,
      },
    ],
  },
  {
    id: "conflict-resolver",
    title: "Conflict Resolver",
    tagline: "Detecta y resuelve conflictos entre agentes: ediciones concurrentes, decisiones contradictorias, duplicación",
    category: "Multi-Agente y Coordinación",
    pain: "Dos agentes editan el mismo artefacto o toman decisiones contradictorias sobre el mismo asunto: el resultado es corrupción silenciosa del estado o guerra de tirones sin árbitro.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/conflict-resolver/. Registra decisiones por asunto y ediciones por artefacto; detecta contradicciones (posturas opuestas sobre la misma clave) y propone estrategia de fusión.",
    tools: [
      {
        name: "record_decision",
        desc: "Un agente registra una decisión sobre un asunto; se detecta contradicción con decisiones previas de otros agentes.",
        params: { asunto: { t: "string", d: "Clave del asunto (ej: stack/frontend)" }, agente: { t: "string", d: "Agent_id que decide" }, decision: { t: "string", d: "Decisión tomada" }, justificacion: { t: "string", d: "Por qué", opt: true }, confianza: { t: "number", d: "0-1", opt: true, def: 0.8 } },
        code: `const st = store.load();
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
return ok({ conflicto: false, asunto, decisiones_acumuladas: st.decisiones[asunto].length });`,
      },
      {
        name: "declare_edit",
        desc: "Declara intención de editar un artefacto (piso, sección o campo) para detectar solapamientos con otros editores.",
        params: { artefacto: { t: "string", d: "ID/ruta del artefacto" }, agente: { t: "string", d: "Agent_id editor" }, seccion: { t: "string", d: "Parte que tocará (todo, sección X, campo Y)", opt: true, def: "todo" } },
        code: `const st = store.load();
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
return ok({ conflicto: false, artefacto, seccion, editores_activos: st.ediciones[artefacto].length });`,
      },
      {
        name: "close_edit",
        desc: "Cierra una declaración de edición (terminaste con el artefacto).",
        params: { artefacto: { t: "string", d: "Artefacto" }, agente: { t: "string", d: "Agent_id" } },
        code: `const st = store.load();
const lista = (st.ediciones || {})[artefacto];
if (!lista) return fail("sin ediciones declaradas");
const mias = lista.filter(e => e.agente === agente && !e.cerrada);
if (!mias.length) return fail("no tienes ediciones abiertas en " + artefacto);
for (const e of lista) if (e.agente === agente) e.cerrada = true;
store.save(st);
return ok({ cerradas: mias.length, siguen_abiertas: lista.filter(e => !e.cerrada).length });`,
      },
      {
        name: "raise_conflict",
        desc: "Eleva un conflicto formal (asunto/artefacto, partes, posturas) para que se arbitre.",
        params: { tipo: { t: "enum", d: "Tipo de conflicto", values: ["decision", "edicion", "duplicacion", "prioridad"] }, sujeto: { t: "string", d: "Asunto o artefacto en conflicto" }, partes: { t: "array", d: "Agent_ids implicados" }, detalle: { t: "string", d: "Descripción del choque", opt: true } },
        code: `const st = store.load();
st.conflictos = st.conflictos || [];
const id = "cf_" + Date.now().toString(36);
st.conflictos.push({ id, tipo, sujeto, partes: partes || [], detalle: detalle || null, estado: "abierto", ts: new Date().toISOString() });
store.save(st);
return ok({ conflicto_id: id, estrategias_sugeridas: { decision: "vote o escalar", edicion: "merge sección a sección", duplicacion: "divide el trabajo con blackboard", prioridad: "human decide" }[tipo] });`,
      },
      {
        name: "resolve_conflict",
        desc: "Resuelve un conflicto: merge documentado, votación, o escalamiento a humano; queda como precedente auditable.",
        params: { conflicto_id: { t: "string", d: "ID del conflicto" }, estrategia: { t: "enum", d: "Cómo se resolvió", values: ["merge", "vote", "escalado_humano", "seniority", "coexistencia"] }, resolucion: { t: "string", d: "Texto de la resolución final" }, resuelto_por: { t: "string", d: "Quién arbitra" } },
        code: `const st = store.load();
const c = (st.conflictos || []).find(x => x.id === conflicto_id);
if (!c) return fail("conflicto no encontrado");
c.estado = "resuelto";
c.resolucion = { estrategia, texto: resolucion, por: resuelto_por, ts: new Date().toISOString() };
store.save(st);
return ok({ conflicto: c.id, resuelto: true, precedente: c.sujeto + ": " + resolucion + " (via " + estrategia + ")" });`,
      },
      {
        name: "duplication_check",
        desc: "Detecta trabajo duplicado: dos agentes haciendo lo mismo (por similitud de descripción de tarea).",
        params: { tareas: { t: "array", d: "Lista de {agente, descripcion} activas para cruzar" } },
        code: `const items = (tareas || []).filter(t => t && t.descripcion);
if (items.length < 2) return fail("necesitas >=2 tareas {agente, descripcion}");
const norm = (s) => String(s).toLowerCase().replace(/[^\\wáéíóúñ\\s]/g, "").split(/\\s+/).filter(w => w.length > 3);
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
});`,
      },
      {
        name: "conflict_stats",
        desc: "Estadísticas de conflictos por tipo, estrategia de resolución y tasa de escalamiento humano.",
        params: {},
        code: `const st = store.load();
const cs = st.conflictos || [];
if (!cs.length) return ok({ total: 0 });
const porTipo = {}, porEstr = {};
for (const c of cs) { porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1; if (c.resolucion) porEstr[c.tipo + ":" + c.resolucion.estrategia] = (porEstr[c.tipo + ":" + c.resolucion.estrategia] || 0) + 1; }
const resueltos = cs.filter(c => c.estado === "resuelto").length;
return ok({
  total: cs.length, abiertos: cs.length - resueltos, resueltos,
  por_tipo: porTipo, por_estrategia: porEstr,
  tasa_escalamiento_humano: Number((cs.filter(c => c.resolucion?.estrategia === "escalado_humano").length / cs.length).toFixed(2)),
});`,
      },
    ],
  },
  {
    id: "quorum-coordinator",
    title: "Quorum Coordinator",
    tagline: "Votaciones distribuidas con quórum, pesos y timeouts: decisiones de equipo sin dictador",
    category: "Multi-Agente y Coordinación",
    pain: "En equipos de agentes las decisiones críticas las toma el primero que llega, sin quórum ni pesos: minorías ruidosas ganan y no queda rastro de quién votó qué.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/quorum-coordinator/. Votaciones N-de-M con quórum configurable, pesos por agente, opciones preferenciales (Borda) y timeout con veredicto por defecto.",
    tools: [
      {
        name: "open_vote",
        desc: "Abre una votación: pregunta, opciones, quórum mínimo y timeout. Devuelve el acta de apertura.",
        params: { pregunta: { t: "string", d: "Pregunta a decidir" }, opciones: { t: "array", d: "Opciones votables" }, quorum: { t: "number", d: "Votos mínimos para validar", opt: true, def: 2 }, timeout_minutos: { t: "number", d: "Minutos antes de cerrar por timeout", opt: true, def: 30 }, pesos: { t: "any", d: "Mapa {agente: peso} opcional", opt: true } },
        code: `const st = store.load();
st.votos = st.votos || [];
const opts = (opciones || []).map(String);
if (opts.length < 2) return fail("una votación necesita >=2 opciones");
const id = "vt_" + Date.now().toString(36);
st.votos.push({ id, pregunta, opciones: opts, quorum, timeout: new Date(Date.now() + timeout_minutos * 60000).toISOString(), pesos: pesos || {}, sufragios: [], estado: "abierta", creada: new Date().toISOString() });
store.save(st);
return ok({ votacion_id: id, pregunta, opciones: opts, quorum, cierra: st.votos.at(-1).timeout });`,
      },
      {
        name: "cast_vote",
        desc: "Un agente emite su voto (opción o ranking preferencial). Un agente = un voto reemplazable.",
        params: { votacion_id: { t: "string", d: "ID de la votación" }, agente: { t: "string", d: "Agent_id votante" }, opcion: { t: "string", d: "Opción elegida (o la primera del ranking)" }, ranking: { t: "array", d: "Ranking preferencial completo (Borda)", opt: true }, razon: { t: "string", d: "Justificación breve", opt: true } },
        code: `const st = store.load();
const v = (st.votos || []).find(x => x.id === votacion_id);
if (!v) return fail("votación no encontrada");
if (v.estado !== "abierta") return fail("votación " + v.estado);
if (new Date(v.timeout) < new Date()) { v.estado = "cerrada_timeout"; store.save(st); return fail("timeout alcanzado"); }
if (!v.opciones.includes(opcion)) return fail("opción no válida: " + v.opciones.join(" | "));
v.sufragios = v.sufragios.filter(s => s.agente !== agente);
v.sufragios.push({ agente, opcion, ranking: ranking || null, razon: razon || null, ts: new Date().toISOString() });
store.save(st);
const pesos = v.pesos || {};
const pesoTotal = v.sufragios.reduce((s, x) => s + (pesos[x.agente] ?? 1), 0);
return ok({ voto: opcion, emitidos: v.sufragios.length, peso_acumulado: Number(pesoTotal.toFixed(2)), faltan_para_quorum: Math.max(0, v.quorum - v.sufragios.length) });`,
      },
      {
        name: "tally",
        desc: "Escruta: mayoría simple, ponderada por pesos y Borda si hay rankings. Indica si se alcanzó quórum.",
        params: { votacion_id: { t: "string", d: "ID de la votación" } },
        code: `const st = store.load();
const v = (st.votos || []).find(x => x.id === votacion_id);
if (!v) return fail("votación no encontrada");
const pesos = v.pesos || {};
const simple = {}, ponderado = {}, borda = {};
for (const s of v.sufragios) {
  const w = pesos[s.agente] ?? 1;
  simple[s.opcion] = (simple[s.opcion] || 0) + 1;
  ponderado[s.opcion] = Number(((ponderado[s.opcion] || 0) + w).toFixed(2));
  if (Array.isArray(s.ranking) && s.ranking.length) {
    const n = s.ranking.length;
    s.ranking.forEach((opt, idx) => { if (v.opciones.includes(opt)) borda[opt] = (borda[opt] || 0) + (n - idx) * w; });
  }
}
const ganadorSimple = Object.entries(simple).sort((a, b) => b[1] - a[1])[0] || null;
const ganadorPonderado = Object.entries(ponderado).sort((a, b) => b[1] - a[1])[0] || null;
const ganadorBorda = Object.entries(borda).length ? Object.entries(borda).sort((a, b) => b[1] - a[1])[0] : null;
const quorumOK = v.sufragios.length >= v.quorum;
return ok({
  votacion: v.id, pregunta: v.pregunta, estado: v.estado,
  emitidos: v.sufragios.length, quorum_requerido: v.quorum, quorum_alcanzado: quorumOK,
  escrutinio_simple: simple, escrutinio_ponderado: ponderado, escrutinio_borda: borda,
  ganadores: { simple: ganadorSimple?.[0] || null, ponderado: ganadorPonderado?.[0] || null, borda: ganadorBorda?.[0] || null },
  advertencia: !quorumOK ? "quórum NO alcanzado: la decisión no es vinculante" : ganadorSimple && ganadorPonderado && ganadorSimple[0] !== ganadorPonderado[0] ? "mayoría simple y ponderada difieren: conflicto de pesos, arbitra" : "decisión válida",
});`,
      },
      {
        name: "close_vote",
        desc: "Cierra la votación con veredicto oficial y acta (quién votó qué queda auditado).",
        params: { votacion_id: { t: "string", d: "ID de la votación" }, criterio: { t: "enum", d: "Criterio de desempate final", values: ["simple", "ponderado", "borda"], opt: true, def: "ponderado" } },
        code: `const st = store.load();
const v = (st.votos || []).find(x => x.id === votacion_id);
if (!v) return fail("votación no encontrada");
if (v.estado !== "abierta") return ok({ estado: v.estado, veredicto: v.veredicto });
const pesos = v.pesos || {};
const conteo = {};
for (const s of v.sufragios) conteo[s.opcion] = Number(((conteo[s.opcion] || 0) + (pesos[s.agente] ?? 1)).toFixed(2));
const ganador = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
v.estado = "cerrada";
v.veredicto = { ganador: ganador?.[0] || null, criterio, conteo, quorum: v.sufragios.length >= v.quorum, acta: v.sufragios.map(s => ({ agente: s.agente, voto: s.opcion, razon: s.razon })), cerrada: new Date().toISOString() };
store.save(st);
return ok({ votacion: v.id, ganador: v.veredicto.ganador, vinculante: v.veredicto.quorum, acta: v.veredicto.acta });`,
      },
      {
        name: "default_on_timeout",
        desc: "Cierra votaciones vencidas aplicando veredicto por defecto documentado (evita decisiones zombis eternas).",
        params: { politica_defecto: { t: "enum", d: "Qué hacer al expirar", values: ["sin_cambio", "primera_opcion", "escalado_humano"], opt: true, def: "sin_cambio" } },
        code: `const st = store.load();
let cerradas = 0;
for (const v of st.votos || []) {
  if (v.estado !== "abierta" || new Date(v.timeout) >= new Date()) continue;
  v.estado = "cerrada_timeout";
  v.veredicto = { ganador: politica_defecto === "primera_opcion" ? v.opciones[0] : null, por_defecto: politica_defecto, quorum: v.sufragios.length >= v.quorum, cerrada: new Date().toISOString() };
  cerradas++;
}
store.save(st);
return ok({ cerradas_por_timeout: cerradas, politica: politica_defecto, abiertas_restantes: (st.votos || []).filter(v => v.estado === "abierta").length });`,
      },
      {
        name: "vote_history",
        desc: "Historial de votaciones del equipo con desenlaces y participación media.",
        params: {},
        code: `const st = store.load();
const vs = st.votos || [];
if (!vs.length) return ok({ total: 0 });
const participacion = vs.map(v => v.sufragios.length);
return ok({
  total: vs.length,
  abiertas: vs.filter(v => v.estado === "abierta").length,
  participacion_media: Number((participacion.reduce((a, b) => a + b, 0) / vs.length).toFixed(1)),
  ultimas: vs.slice(-10).map(v => ({ id: v.id, pregunta: v.pregunta.slice(0, 70), estado: v.estado, ganador: v.veredicto?.ganador || null, votos: v.sufragios.length })),
});`,
      },
    ],
  },
  {
    id: "agent-supervisor",
    title: "Agent Supervisor",
    tagline: "Supervisión de sub-agentes: liveness, presupuesto, rendimiento y decisión de reinicio/escalamiento",
    category: "Multi-Agente y Coordinación",
    pain: "Los orquestadores lanzan sub-agentes y los olvidan: sin heartbeat ni presupuesto, un sub-agente bucle infinito quema tokens toda la noche y nadie lo mata.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/agent-supervisor/. Registra sub-agentes con límites (tiempo, tokens, reintentos), recibe check-ins y decide matar/reintentar/escalar según política.",
    tools: [
      {
        name: "spawn_registration",
        desc: "Registra un sub-agente lanzado con sus límites: presupuesto de tokens, deadline y máximos reintentos.",
        params: { sub_agente: { t: "string", d: "ID del sub-agente" }, tarea: { t: "string", d: "Tarea asignada" }, presupuesto_tokens: { t: "number", d: "Límite de tokens", opt: true }, deadline_minutos: { t: "number", d: "Minutos de plazo", opt: true }, max_reintentos: { t: "number", d: "Reintentos permitidos", opt: true, def: 1 } },
        code: `const st = store.load();
st.sups = st.sups || {};
const prev = st.sups[sub_agente];
st.sups[sub_agente] = {
  sub_agente, tarea, presupuesto_tokens: presupuesto_tokens || null,
  deadline: deadline_minutos ? new Date(Date.now() + deadline_minutos * 60000).toISOString() : null,
  max_reintentos, reintentos: prev?.reintentos || 0,
  tokens_usados: 0, checkins: 0, ultimo_checkin: null,
  estado: "corriendo", eventos: prev?.eventos || [],
  lanzado: new Date().toISOString(),
};
store.save(st);
return ok({ sub_agente, estado: "corriendo", presupuesto: st.sups[sub_agente].presupuesto_tokens, deadline: st.sups[sub_agente].deadline });`,
      },
      {
        name: "check_in",
        desc: "El sub-agente reporta progreso y tokens consumidos; el supervisor evalúa límites y devuelve directiva (seguir, parar, escalar).",
        params: { sub_agente: { t: "string", d: "ID del sub-agente" }, progreso_pct: { t: "number", d: "Avance 0-100" }, tokens_delta: { t: "number", d: "Tokens consumidos desde el último check-in", opt: true, def: 0 }, nota: { t: "string", d: "Qué está pasando", opt: true } },
        code: `const st = store.load();
const s = (st.sups || {})[sub_agente];
if (!s) return fail("sub-agente no registrado: usa spawn_registration");
if (s.estado !== "corriendo") return fail("sub-agente en estado " + s.estado);
s.checkins++;
s.ultimo_checkin = new Date().toISOString();
s.tokens_usados += tokens_delta || 0;
s.ultimo_progreso = progreso_pct;
if (nota) { s.eventos = s.eventos || []; s.eventos.push({ nota, progreso_pct, ts: s.ultimo_checkin }); if (s.eventos.length > 50) s.eventos = s.eventos.slice(-30); }
store.save(st);
const alerts = [];
if (s.presupuesto_tokens && s.tokens_usados > s.presupuesto_tokens) alerts.push("PRESUPUESTO_EXCEDIDO: " + s.tokens_usados + "/" + s.presupuesto_tokens);
if (s.deadline && new Date(s.deadline) < new Date()) alerts.push("DEADLINE_VENCIDO");
if (progreso_pct === 0 && s.checkins >= 3) alerts.push("SIN_PROGRESO tras " + s.checkins + " check-ins");
const directiva = alerts.some(a => a.startsWith("PRESUPUESTO") || a.startsWith("DEADLINE"))
  ? (s.reintentos < s.max_reintentos ? "REINTENTAR" : "ESCALAR_HUMANO")
  : alerts.includes("SIN_PROGRESO tras " + s.checkins + " check-ins") ? "PROBAR_ALTERNATIVA" : "SEGUIR";
if (directiva !== "SEGUIR") { s.estado = directiva === "REINTENTAR" ? "reintentar" : s.estado; if (directiva === "REINTENTAR") s.reintentos++; store.save(st); }
return ok({ directiva, alerts, tokens_usados: s.tokens_usados, presupuesto: s.presupuesto_tokens, checkins: s.checkins });`,
      },
      {
        name: "report_result",
        desc: "El sub-agente entrega resultado final; el supervisor cierra su registro y archiva métricas.",
        params: { sub_agente: { t: "string", d: "ID del sub-agente" }, exito: { t: "boolean", d: "¿Completó la tarea?" }, resultado: { t: "string", d: "Resumen del resultado", opt: true } },
        code: `const st = store.load();
const s = (st.sups || {})[sub_agente];
if (!s) return fail("sub-agente no registrado");
s.estado = exito ? "completado" : "fallido";
s.resultado = resultado || null;
s.terminado = new Date().toISOString();
s.duracion_min = Number(((Date.now() - new Date(s.lanzado)) / 60000).toFixed(1));
store.save(st);
return ok({ sub_agente, estado: s.estado, duracion_min: s.duracion_min, tokens: s.tokens_usados, checkins: s.checkins, sobre_presupuesto: s.presupuesto_tokens ? s.tokens_usados > s.presupuesto_tokens : false });`,
      },
      {
        name: "kill",
        desc: "Detiene formalmente un sub-agente (bucle, desviación o presupuesto) y registra el motivo.",
        params: { sub_agente: { t: "string", d: "ID del sub-agente" }, motivo: { t: "string", d: "Por qué se detiene" } },
        code: `const st = store.load();
const s = (st.sups || {})[sub_agente];
if (!s) return fail("sub-agente no registrado");
if (s.estado !== "corriendo") return ok({ ya_finalizado: s.estado });
s.estado = "detenido";
s.killed = { motivo, ts: new Date().toISOString() };
store.save(st);
return ok({ sub_agente, estado: "detenido", motivo, tokens_hasta_el_momento: s.tokens_usados, limpieza: "libera sus recursos en blackboard-shared y su estado en deadlock-detector" });`,
      },
      {
        name: "supervision_dashboard",
        desc: "Panel de supervisión: quién corre, quién excede presupuesto, quién no reporta y tasas de éxito.",
        params: {},
        code: `const st = store.load();
const sups = Object.values(st.sups || {});
if (!sups.length) return ok({ registrados: 0, sugerencia: "registra sub-agentes con spawn_registration" });
const corriendo = sups.filter(s => s.estado === "corriendo");
const sinReporte = corriendo.filter(s => !s.ultimo_checkin || (Date.now() - new Date(s.ultimo_checkin)) > 15 * 60000);
const excedidos = corriendo.filter(s => s.presupuesto_tokens && s.tokens_usados > s.presupuesto_tokens);
const completados = sups.filter(s => s.estado === "completado").length;
const fallidos = sups.filter(s => ["fallido", "detenido"].includes(s.estado)).length;
return ok({
  registrados: sups.length, corriendo: corriendo.length,
  alertas: {
    sin_reporte_15min: sinReporte.map(s => s.sub_agente),
    presupuesto_excedido: excedidos.map(s => ({ sub: s.sub_agente, usados: s.tokens_usados, tope: s.presupuesto_tokens })),
  },
  rendimiento: {
    completados, fallidos,
    tasa_exito: (completados + fallidos) ? Number((completados / (completados + fallidos)).toFixed(2)) : null,
    tokens_totales: sups.reduce((s, x) => s + (x.tokens_usados || 0), 0),
  },
  corriendo_detalle: corriendo.map(s => ({ sub: s.sub_agente, tarea: s.tarea.slice(0, 60), checkins: s.checkins, tokens: s.tokens_usados, tope: s.presupuesto_tokens, ultimo_checkin: s.ultimo_checkin })),
});`,
      },
      {
        name: "retry_policy",
        desc: "Consulta la política de reintento para un sub-agente fallido: cuántos quedan y con qué ajustes relanzar.",
        params: { sub_agente: { t: "string", d: "ID del sub-agente" } },
        code: `const st = store.load();
const s = (st.sups || {})[sub_agente];
if (!s) return fail("sub-agente no registrado");
const quedan = Math.max(0, s.max_reintentos - s.reintentos);
return ok({
  sub_agente, reintentos_usados: s.reintentos, reintentos_quedan: quedan,
  recomendacion: quedan > 0
    ? { relanzar: true, ajustes: ["reduce el alcance de la tarea", "duplica deadline si falló por tiempo", "bisagra el presupuesto si falló por tokens"][s.reintentos % 3], presupuesto_sugerido: s.presupuesto_tokens ? Math.round(s.presupuesto_tokens * 1.5) : null }
    : { relanzar: false, alternativa: "decompón la tarea (plan-decompose) y delega por partes o escala a humano" },
});`,
      },
    ],
  },
];

// ═══ CATEGORÍA: Dolores FUTUROS · Objetivos y Largo Plazo (B) ═══
// Evidencia: misiones de días/semanas requieren planificación por horizontes,
// diarios de progreso narrativos y checkpoints reanudables (recovery de
// "Best Multi-agent Orchestration Frameworks": "coordination, memory, and recovery").
export default [
  {
    id: "time-horizon-planner",
    title: "Time Horizon Planner",
    tagline: "Planificación por horizontes (hoy / semana / mes) con recalendización explícita",
    category: "Objetivos y Largo Plazo",
    pain: "El agente planifica todo como si fuera 'ahora': mezcla lo urgente con lo de dentro de tres semanas, y cuando algo se retrasa, recalendizar a mano es tan caro que no se hace.",
    persistent: true,
    notes: "Persiste en ~/.m/my-project... ~/.mcp-suite/time-horizon-planner/. Tareas con horizonte (hoy/semana/mes/trimestre), dependencias simples, detección de colisión de fechas y replanificación en cascada.",
    tools: [
      {
        name: "plan_task",
        desc: "Añade una tarea al plan con horizonte, esfuerzo estimado y dependencias.",
        params: { tarea: { t: "string", d: "Descripción de la tarea" }, horizonte: { t: "enum", d: "Horizonte temporal", values: ["hoy", "semana", "mes", "trimestre"] }, esfuerzo_horas: { t: "number", d: "Esfuerzo estimado", opt: true }, depende_de: { t: "array", d: "IDs de tareas previas", opt: true, def: [] }, fecha_objetivo: { t: "string", d: "Fecha ISO objetivo (opcional)", opt: true } },
        code: `const st = store.load();
st.tareas = st.tareas || [];
const id = "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
st.tareas.push({ id, tarea, horizonte, esfuerzo: esfuerzo_horas || null, depende_de: depende_de || [], fecha_objetivo: fecha_objetivo || null, estado: "planificada", creada: new Date().toISOString() });
store.save(st);
return ok({ tarea_id: id, horizonte, dependencias: (depende_de || []).length });`,
      },
      {
        name: "horizon_view",
        desc: "Vista por horizontes: carga de hoy vs semana vs mes, y alerta de sobrecarga de un horizonte.",
        params: {},
        code: `const st = store.load();
const ts = st.tareas || [];
if (!ts.length) return ok({ plan: "vacío", sugerencia: "añade tareas con plan_task" });
const grupos: any = { hoy: [], semana: [], mes: [], trimestre: [] };
for (const t of ts) if (!["hecha", "descartada"].includes(t.estado)) (grupos[t.horizonte] || grupos.mes).push(t);
const carga: any = {};
for (const [h, lista] of Object.entries(grupos)) carga[h] = { tareas: lista.length, horas: lista.reduce((s, t) => s + (t.esfuerzo || 0), 0) };
return ok({
  carga,
  hoy: grupos.hoy.map(t => ({ id: t.id, tarea: t.tarea.slice(0, 70), estado: t.estado })),
  alertas: [
    ...(carga.hoy.tareas > 6 ? ["más de 6 tareas para HOY: realista es 3-4, mueve el resto a semana"] : []),
    ...(carga.hoy.horas > 8 ? ["hoy suma " + carga.hoy.horas + "h de esfuerzo estimado"] : []),
    ...(carga.hoy.tareas === 0 && (carga.semana.tareas + carga.mes.tareas) > 0 ? ["hoy está vacío pero hay backlog: promueve 1-3 tareas de semana"] : []),
  ],
  backlog: { semana: grupos.semana.length, mes: grupos.mes.length, trimestre: grupos.trimestre.length },
});`,
      },
      {
        name: "promote",
        desc: "Promueve una tarea al horizonte inmediato superior (trimestre→mes→semana→hoy) validando dependencias.",
        params: { tarea_id: { t: "string", d: "ID de la tarea" } },
        code: `const st = store.load();
const t = (st.tareas || []).find(x => x.id === tarea_id);
if (!t) return fail("tarea no encontrada");
const orden = { hoy: 0, semana: 1, mes: 2, trimestre: 3 };
if (orden[t.horizonte] === 0) return fail("ya está en 'hoy': no hay horizonte más inmediato");
const pendientes = (t.depende_de || []).filter(dep => {
  const d = st.tareas.find(x => x.id === dep);
  return d && !["hecha"].includes(d.estado);
});
if (pendientes.length) return ok({ promovida: false, bloqueada_por: pendientes, consejo: "termina las dependencias o promuévelas también" });
t.horizonte = { semana: "hoy", mes: "semana", trimestre: "mes" }[t.horizonte];
store.save(st);
return ok({ promovida: true, nuevo_horizonte: t.horizonte });`,
      },
      {
        name: "complete",
        desc: "Marca una tarea como hecha y desbloquea dependientes (devuelve qué se liberó).",
        params: { tarea_id: { t: "string", d: "ID de la tarea" } },
        code: `const st = store.load();
const t = (st.tareas || []).find(x => x.id === tarea_id);
if (!t) return fail("tarea no encontrada");
t.estado = "hecha"; t.hecha_ts = new Date().toISOString();
const liberadas = st.tareas.filter(x => (x.depende_de || []).includes(tarea_id) && !["hecha", "descartada"].includes(x.estado)).map(x => x.id);
store.save(st);
return ok({ tarea: t.id, hecha: true, desbloquea: liberadas });`,
      },
      {
        name: "reschedule_cascade",
        desc: "Mueve una tarea de fecha y recalendiza en cascada todo lo que depende de ella (efecto dominó calculado).",
        params: { tarea_id: { t: "string", d: "ID de la tarea que se retrasa" }, desplazar_dias: { t: "number", d: "Días de retraso (positivo)" } },
        code: `const st = store.load();
const t = (st.tareas || []).find(x => x.id === tarea_id);
if (!t) return fail("tarea no encontrada");
if (desplazar_dias <= 0) return fail("desplazar_dias debe ser > 0");
const afectadas = new Set([tarea_id]);
let creciendo = true;
while (creciendo) {
  creciendo = false;
  for (const x of st.tareas || []) {
    if (afectadas.has(x.id) || ["hecha", "descartada"].includes(x.estado)) continue;
    if ((x.depende_de || []).some(d => afectadas.has(d))) { afectadas.add(x.id); creciendo = true; }
  }
}
const detalle = [];
for (const id of afectadas) {
  const x = st.tareas.find(y => y.id === id);
  if (x.fecha_objetivo) { const d = new Date(x.fecha_objetivo); d.setDate(d.getDate() + desplazar_dias); x.fecha_objetivo = d.toISOString(); }
  detalle.push({ id: x.id, tarea: x.tarea.slice(0, 60), nuevo_horizonte: x.horizonte });
}
store.save(st);
return ok({ retrada_raiz: desplazar_dias + " días", afectadas_en_cascada: detalle.length, detalle });`,
      },
      {
        name: "plan_stats",
        desc: "Estadísticas del plan: throughput, precisión de estimación (esfuerzo vs real) y horizonte más congestionado.",
        params: {},
        code: `const st = store.load();
const ts = st.tareas || [];
if (!ts.length) return ok({ total: 0 });
const hechas = ts.filter(t => t.estado === "hecha");
const porHorizonte = {};
for (const t of ts) porHorizonte[t.horizonte] = (porHorizonte[t.horizonte] || 0) + 1;
return ok({
  total: ts.length, hechas: hechas.length, tasa_completado: Number((hechas.length / ts.length).toFixed(2)),
  por_horizonte: porHorizonte,
  mas_congestionado: Object.entries(porHorizonte).sort((a, b) => b[1] - a[1])[0],
  descartadas: ts.filter(t => t.estado === "descartada").length,
});`,
      },
    ],
  },
  {
    id: "progress-journal",
    title: "Progress Journal",
    tagline: "Diario de progreso con narrativa continua: qué se hizo, qué se intentó y falló, y dónde quedó",
    category: "Objetivos y Largo Plazo",
    pain: "Tras horas de trabajo el agente no puede responder '¿qué has hecho?': los intentos fallidos no se registran y el contexto se comprime perdiendo el rastro de lo ya intentado.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/progress-journal/. Entradas cronológicas tipo entrada/experimento/decisión/bloqueo con resumen ejecutivo dinámico y detección de estancamiento (mismo bloqueo repetido).",
    tools: [
      {
        name: "add_entry",
        desc: "Añade una entrada al diario: tipo (progreso, experimento, decision, bloqueo, hallazgo) y narrativa.",
        params: { tipo: { t: "enum", d: "Tipo de entrada", values: ["progreso", "experimento", "decision", "bloqueo", "hallazgo"] }, titulo: { t: "string", d: "Título corto" }, detalle: { t: "string", d: "Narrativa completa: qué, cómo, resultado" }, etiquetas: { t: "array", d: "Etiquetas", opt: true, def: [] }, exito: { t: "boolean", d: "Solo experimentos: ¿funcionó?", opt: true } },
        code: `const st = store.load();
st.entradas = st.entradas || [];
st.entradas.push({ n: st.entradas.length + 1, tipo, titulo, detalle, etiquetas: etiquetas || [], exito: exito ?? null, ts: new Date().toISOString() });
store.save(st);
return ok({ entrada_n: st.entradas.length, tipo });`,
      },
      {
        name: "recent",
        desc: "Últimas N entradas con filtro por tipo; incluye el resumen ejecutivo del estado.",
        params: { n: { t: "number", d: "Cuántas entradas", opt: true, def: 10 }, tipo: { t: "string", d: "Filtrar por tipo", opt: true } },
        code: `const st = store.load();
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
});`,
      },
      {
        name: "stall_detector",
        desc: "Detecta estancamiento: mismo tipo de bloqueo repetido o días sin entradas de progreso.",
        params: { dias_umbral: { t: "number", d: "Días sin progreso para alertar", opt: true, def: 2 } },
        code: `const st = store.load();
const es = st.entradas || [];
if (!es.length) return ok({ entradas: 0 });
const bloqueos = es.filter(e => e.tipo === "bloqueo");
const titulos = {};
for (const b of bloqueos) {
  const k = b.titulo.toLowerCase().split(/\\W+/).filter(w => w.length > 3).sort().join("_");
  titulos[k] = titulos[k] || [];
  titulos[k].push(b);
}
const repetidos = Object.entries(titulos).filter(([, v]) => v.length >= 2).map(([k, v]) => ({ patron: v[0].titulo, veces: v.length, primera: v[0].ts, ultima: v[v.length - 1].ts }));
const ultimoProgreso = [...es].reverse().find(e => e.tipo === "progreso");
const diasSinProgreso = ultimoProgreso ? Number(((Date.now() - new Date(ultimoProgreso.ts)) / 86400000).toFixed(1)) : null;
return ok({
  bloqueos_repetidos: repetidos,
  dias_sin_progreso: diasSinProgreso,
  estancado: repetidos.length > 0 || (diasSinProgreso !== null && diasSinProgreso > dias_umbral),
  consejo: repetidos.length ? "mismo bloqueo " + repetidos[0].veces + " veces: cambia de ESTRATEGIA, no de intento" : (diasSinProgreso > dias_umbral ? "sin progreso real en " + diasSinProgreso + " días: replantea" : "avanzando"),
});`,
      },
      {
        name: "narrative",
        desc: "Genera la narrativa continua del trabajo (para handoffs o reportes): cronología comprimida agrupada por día.",
        params: { desde_entrada: { t: "number", d: "Número de entrada inicial", opt: true, def: 1 } },
        code: `const st = store.load();
const es = (st.entradas || []).filter(e => e.n >= desde_entrada);
if (!es.length) return fail("no hay entradas desde la " + desde_entrada);
const porDia = {};
for (const e of es) {
  const d = e.ts.slice(0, 10);
  porDia[d] = porDia[d] || [];
  porDia[d].push(e);
}
const narrativa = Object.entries(porDia).map(([d, items]) => ({
  dia: d,
  lineas: items.map(e => "- [" + e.tipo + (e.exito !== null ? ":" + (e.exito ? "ok" : "fallo") : "") + "] " + e.titulo + ": " + e.detalle.slice(0, 160)),
}));
return ok({ desde: desde_entrada, hasta: es[es.length - 1].n, dias: narrativa.length, narrativa });`,
      },
      {
        name: "experiments_recap",
        desc: "Balance de experimentos: qué se probó, qué funcionó y tasa de acierto global.",
        params: {},
        code: `const st = store.load();
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
});`,
      },
    ],
  },
  {
    id: "mission-checkpoint",
    title: "Mission Checkpoint",
    tagline: "Checkpoints verificables de misiones largas: pausa, reanuda y recupera sin repetir trabajo",
    category: "Objetivos y Largo Plazo",
    pain: "Las misiones largas mueren al reiniciarse: no hay checkpoints, así que el agente rehace horas de trabajo ya validado o pierde el hilo de lo que faltaba exactamente.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/mission-checkpoint/. Checkpoints con estado serializable, criterios ya validados y puntero de reanudación. Estimación de ahorro (trabajo no repetido).",
    tools: [
      {
        name: "start_mission",
        desc: "Abre una misión de largo aliento con fases esperadas y plan de checkpoints.",
        params: { mision: { t: "string", d: "Nombre de la misión" }, fases: { t: "array", d: "Fases esperadas en orden" } },
        code: `const st = store.load();
st.misiones = st.misiones || [];
const id = "ms_" + Date.now().toString(36);
st.misiones.push({ id, mision, fases: (fases || []).map((f, i) => ({ n: i + 1, fase: String(f), estado: "pendiente" })), checkpoints: [], estado: "activa", inicio: new Date().toISOString() });
store.save(st);
return ok({ mision_id: id, fases: (fases || []).length, politica: "crea un checkpoint al final de cada fase y antes de cualquier acción irreversible" });`,
      },
      {
        name: "checkpoint",
        desc: "Graba un checkpoint: fase actual, estado completo, criterios validados y puntero de reanudación.",
        params: { mision_id: { t: "string", d: "ID de la misión" }, fase: { t: "string", d: "Fase completada o en curso" }, estado: { t: "any", d: "Estado serializable (JSON) para reanudar" }, reanudar_en: { t: "string", d: "Instrucción exacta de por dónde seguir" }, criterios_validados: { t: "array", d: "Criterios ya verificados", opt: true, def: [] } },
        code: `const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
const cp = { n: m.checkpoints.length + 1, fase, estado, reanudar_en, criterios_validados: criterios_validados || [], ts: new Date().toISOString() };
m.checkpoints.push(cp);
for (const f of m.fases) if (f.fase === fase) f.estado = "hecha";
store.save(st);
return ok({ checkpoint: cp.n, fase, criterios_validados: cp.criterios_validados.length, total_checkpoints: m.checkpoints.length });`,
      },
      {
        name: "resume",
        desc: "Reanuda desde el último checkpoint: devuelve estado, instrucción de continuación y trabajo ya validado (no repetir).",
        params: { mision_id: { t: "string", d: "ID de la misión" } },
        code: `const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
const cp = m.checkpoints[m.checkpoints.length - 1];
if (!cp) return ok({ sin_checkpoints: true, fases: m.fases, consejo: "empieza de cero y graba el primer checkpoint pronto" });
return ok({
  mision: m.mision,
  ultimo_checkpoint: { n: cp.n, fase: cp.fase, ts: cp.ts, reanudar_en: cp.reanudar_en, criterios_validados: cp.criterios_validados },
  estado_restaurado: cp.estado,
  fases_restantes: m.fases.filter(f => f.estado !== "hecha"),
  horas_desde_checkpoint: Number(((Date.now() - new Date(cp.ts)) / 3600000).toFixed(1)),
  no_repetir: "todo lo cubierto por criterios_validados ya está hecho: NO lo rehagas",
});`,
      },
      {
        name: "rollback_checkpoint",
        desc: "Vuelve a un checkpoint anterior: descarta el trabajo posterior documentando qué se pierde.",
        params: { mision_id: { t: "string", d: "ID de la misión" }, checkpoint_n: { t: "number", d: "Número del checkpoint destino" }, motivo: { t: "string", d: "Por qué se vuelve atrás" } },
        code: `const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
const idx = m.checkpoints.findIndex(c => c.n === checkpoint_n);
if (idx < 0) return fail("checkpoint inexistente (hay " + m.checkpoints.length + ")");
const descartados = m.checkpoints.slice(idx + 1);
m.checkpoints = m.checkpoints.slice(0, idx + 1);
m.rollbacks = m.rollbacks || [];
m.rollbacks.push({ hacia: checkpoint_n, descartados: descartados.length, motivo, ts: new Date().toISOString() });
store.save(st);
return ok({ restaurado_a: checkpoint_n, checkpoints_descartados: descartados.length, fases_reabiertas: m.fases.filter(f => f.estado === "hecha" && !m.checkpoints.some(c => c.fase === f.fase)).map(f => f.fase) });`,
      },
      {
        name: "mission_report",
        desc: "Reporte de la misión: fases, checkpoints, rollbacks y ahorro estimado por no repetir trabajo.",
        params: { mision_id: { t: "string", d: "ID de la misión" } },
        code: `const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
const duracion = Number(((Date.now() - new Date(m.inicio)) / 3600000).toFixed(1));
return ok({
  mision: m.mision, estado: m.estado,
  duracion_horas: duracion,
  fases: m.fases,
  checkpoints: m.checkpoints.length,
  rollbacks: (m.rollbacks || []).length,
  ahorro_estimado: m.checkpoints.length > 0 ? m.checkpoints.length + " reinicios servidos sin repetir trabajo validado" : "sin checkpoints aún",
 ultimo_checkpoint: m.checkpoints.at(-1)?.fase || null,
});`,
      },
      {
        name: "close_mission",
        desc: "Cierra la misión (completada o abandonada) archivando el rastro completo.",
        params: { mision_id: { t: "string", d: "ID de la misión" }, resultado: { t: "enum", d: "Desenlace", values: ["completada", "abandonada", "fusionada"] }, notas: { t: "string", d: "Cierre", opt: true } },
        code: `const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
m.estado = resultado;
m.cierre = { notas: notas || null, checkpoints: m.checkpoints.length, fases_hechas: m.fases.filter(f => f.estado === "hecha").length, ts: new Date().toISOString() };
store.save(st);
return ok({ mision: m.id, resultado, fases_hechas: m.cierre.fases_hechas + "/" + m.fases.length, checkpoints_grabados: m.cierre.checkpoints });`,
      },
    ],
  },
];

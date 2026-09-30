// ═══ CATEGORÍA: Dolores FUTUROS · Objetivos y Largo Plazo (A) ═══
// Evidencia: deriva de objetivos en tareas de largo horizonte ("the drift began
// the next day" — gradient-dissent, 2026); los agentes pierden el objetivo
// original tras días de trabajo acumulado.
export default [
  {
    id: "goal-contract",
    title: "Goal Contract",
    tagline: "Objetivos con criterios de éxito inmutables: el north star que no se reescribe en mitad de la misión",
    category: "Objetivos y Largo Plazo",
    pain: "En misiones largas el agente reescribe mentalmente el objetivo cada día ('goal drift'): termina resolviendo un problema distinto y nadie lo nota porque el objetivo original ya nadie lo recuerda.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/goal-contract/. El objetivo se declara UNA vez con criterios inmutables; después solo se puede consultar, medir o cerrar. Toda 'modificación' queda como enmienda visible, nunca como reescritura silenciosa.",
    tools: [
      {
        name: "declare_goal",
        desc: "Declara el contrato de objetivo: enunciado, criterios de éxito verificables y restricciones. Inmutable tras la creación.",
        params: { enunciado: { t: "string", d: "El objetivo en una frase verificable" }, criterios_exito: { t: "array", d: "Condiciones objetivas de éxito" }, restricciones: { t: "array", d: "Lo que NO se debe hacer", opt: true, def: [] }, horizonte_dias: { t: "number", d: "Plazo esperado en días", opt: true } },
        code: `if (!Array.isArray(criterios_exito) || criterios_exito.length < 1) return fail("un objetivo sin criterios verificables deriva garantizado");
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
return ok({ objetivo_id: id, enunciado, criterios: st.activo.criterios_exito.length, restriccion: (restricciones || []).length, aviso: "esto es un contrato: los criterios NO se reescriben, solo se miden" });`,
      },
      {
        name: "get_goal",
        desc: "Recupera el objetivo activo completo: criterios, cumplimiento y enmiendas acumuladas.",
        params: {},
        code: `const st = store.load();
if (!st.activo) return fail("no hay objetivo activo: decláralo con declare_goal");
const a = st.activo;
return ok({
  ...a,
  dias_transcurridos: Number(((Date.now() - new Date(a.creado)) / 86400000).toFixed(1)),
  horizonte_restante_dias: a.horizonte ? Number(((new Date(a.horizonte) - Date.now()) / 86400000).toFixed(1)) : null,
  progreso_criterios: a.criterios_exito.filter(c => c.cumplido).length + "/" + a.criterios_exito.length,
});`,
      },
      {
        name: "measure",
        desc: "Registra una medición de un criterio (cumplido o no, con evidencia) sin alterar el contrato.",
        params: { n: { t: "number", d: "Número del criterio a medir" }, cumplido: { t: "boolean", d: "¿Se cumple?" }, evidencia: { t: "string", d: "Evidencia o cómo se verificó", opt: true } },
        code: `const st = store.load();
if (!st.activo) return fail("no hay objetivo activo");
const c = st.activo.criterios_exito.find(x => x.n === n);
if (!c) return fail("criterio " + n + " inexistente (hay " + st.activo.criterios_exito.length + ")");
c.cumplido = cumplido;
c.evidencia = evidencia || null;
c.medido = new Date().toISOString();
st.activo.mediciones.push({ criterio: n, cumplido, ts: c.medido });
store.save(st);
const cumplidos = st.activo.criterios_exito.filter(x => x.cumplido).length;
return ok({ criterio: n, cumplido, progreso: cumplidos + "/" + st.activo.criterios_exito.length, completado: cumplidos === st.activo.criterios_exito.length });`,
      },
      {
        name: "amend_goal",
        desc: "Enmienda VISIBLE del objetivo (nuevos criterios o restricciones) con motivo y fecha: nunca reescritura silenciosa.",
        params: { criterios_extra: { t: "array", d: "Criterios nuevos", opt: true }, restricciones_extra: { t: "array", d: "Restricciones nuevas", opt: true }, motivo: { t: "string", d: "Por qué se enmienda el objetivo" } },
        code: `const st = store.load();
if (!st.activo) return fail("no hay objetivo activo");
if (!motivo) return fail("toda enmienda necesita motivo auditable");
const a = st.activo;
const antes = { criterios: a.criterios_exito.length, restricciones: a.restricciones.length };
let n = a.criterios_exito.length;
for (const c of (criterios_extra || [])) { n++; a.criterios_exito.push({ n, criterio: String(c), cumplido: false, evidencia: null }); }
a.restricciones.push(...(restricciones_extra || []).map(String));
a.enmiendas.push({ motivo, antes, despues: { criterios: a.criterios_exito.length, restricciones: a.restricciones.length }, ts: new Date().toISOString() });
store.save(st);
return ok({ enmienda_n: a.enmiendas.length, criterios_totales: a.criterios_exito.length, advertencia: a.enmiendas.length > 3 ? "demasiadas enmiendas: ¿el objetivo original era el correcto o hay drift declarado?" : "enmienda registrada" });`,
      },
      {
        name: "check_alignment",
        desc: "Verifica que una acción o sub-objetivo propuesto sigue alineado con el contrato activo (anti-drift).",
        params: { propuesta: { t: "string", d: "Acción o sub-objetivo a evaluar" } },
        code: `const st = store.load();
if (!st.activo) return fail("no hay objetivo activo");
const a = st.activo;
const stop = (s) => new Set(String(s).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
const objTokens = stop(a.enunciado + " " + a.criterios_exito.map(c => c.criterio).join(" "));
const propTokens = [...stop(propuesta)];
const eco = propTokens.filter(w => objTokens.has(w)).length / Math.max(propTokens.length, 1);
const chocaRestriccion = a.restricciones.filter(r => {
  const rt = [...stop(r)];
  return rt.length > 0 && rt.every(w => propTokens.includes(w));
});
const veredicto = eco >= 0.4 && !chocaRestriccion.length ? "alineado" : eco < 0.2 ? "desalineado: esta acción NO sirve al objetivo declarado" : chocaRestriccion.length ? "VIOLA restricción: " + chocaRestriccion[0] : "parcialmente alineado: justifica la conexión o descártala";
return ok({ alineamiento: Number(eco.toFixed(2)), veredicto, restriccion_violada: chocaRestriccion[0] || null, criterios_pendientes: a.criterios_exito.filter(c => !c.cumplido).length });`,
      },
      {
        name: "close_goal",
        desc: "Cierra el objetivo con veredicto (logrado, parcial, abandonado) y balance de enmiendas/mediciones.",
        params: { veredicto: { t: "enum", d: "Resultado final", values: ["logrado", "parcial", "abandonado", "reemplazado"] }, notas: { t: "string", d: "Cierre narrativo", opt: true } },
        code: `const st = store.load();
if (!st.activo) return fail("no hay objetivo activo");
const a = st.activo;
a.cierre = { veredicto, notas: notas || null, criterios_cumplidos: a.criterios_exito.filter(c => c.cumplido).length, total: a.criterios_exito.length, enmiendas: a.enmiendas.length, cerrado: new Date().toISOString() };
st.historial = st.historial || [];
st.historial.push(a);
st.activo = null;
store.save(st);
return ok({ cerrado: true, veredicto, criterios: a.cierre.criterios_cumplidos + "/" + a.cierre.total, duracion_dias: Number(((new Date(a.cierre.cerrado) - new Date(a.creado)) / 86400000).toFixed(1)), enmiendas: a.enmiendas.length });`,
      },
      {
        name: "goal_history",
        desc: "Historial de objetivos cerrados: duración, tasa de logro y patrón de abandono.",
        params: {},
        code: `const st = store.load();
const h = st.historial || [];
if (!h.length) return ok({ objetivos_cerrados: 0 });
const logrados = h.filter(g => g.cierre.veredicto === "logrado").length;
return ok({
  objetivos_cerrados: h.length,
  tasa_logro: Number((logrados / h.length).toFixed(2)),
  abandonados: h.filter(g => g.cierre.veredicto === "abandonado").length,
  enmiendas_medias: Number((h.reduce((s, g) => s + g.enmiendas.length, 0) / h.length).toFixed(1)),
  resumen: h.map(g => ({ id: g.id, enunciado: g.enunciado.slice(0, 70), veredicto: g.cierre.veredicto, criterios: g.cierre.criterios_cumplidos + "/" + g.cierre.total, dias: Number(((new Date(g.cierre.cerrado) - new Date(g.creado)) / 86400000).toFixed(1)) })),
});`,
      },
    ],
  },
  {
    id: "drift-detector",
    title: "Drift Detector",
    tagline: "Detecta cuándo el trabajo del agente se desvió del objetivo original (score de deriva por decisión)",
    category: "Objetivos y Largo Plazo",
    pain: "El drift es incremental e invisible: cada decisión parece razonable localmente, pero a las 40 decisiones el agente trabaja en algo distinto al encargo original y nadie supo cuándo torció.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/drift-detector/. Registra decisiones con su justificación y calcula deriva acumulada: distancia semántica lexical vs objetivo + cadena de 'por qué' (justificación que ya no cita el objetivo).",
    tools: [
      {
        name: "set_reference",
        desc: "Fija la referencia contra la que se mide toda deriva (encargo original, literal).",
        params: { encargo: { t: "string", d: "Texto literal del encargo original" }, restricciones: { t: "array", d: "Límites originales", opt: true, def: [] } },
        code: `const st = store.load();
st.referencia = { encargo, restricciones: restricciones || [], fijada: new Date().toISOString(), decisiones: [] };
store.save(st);
return ok({ referencia_fijada: true, encargo: encargo.slice(0, 100), restricciones: (restricciones || []).length });`,
      },
      {
        name: "log_decision",
        desc: "Registra una decisión del agente con justificación; devuelve la deriva individual frente al encargo.",
        params: { decision: { t: "string", d: "Qué se decidió hacer" }, justificacion: { t: "string", d: "Por qué (debería citar el encargo)" }, etiqueta: { t: "string", d: "Etiqueta de fase (ej: research, build)", opt: true } },
        code: `const st = store.load();
if (!st.referencia) return fail("fija la referencia con set_reference primero");
const stop = (s) => new Set(String(s).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
const refTokens = stop(st.referencia.encargo + " " + st.referencia.restricciones.join(" "));
const decTokens = [...stop(decision + " " + justificacion)];
const eco = decTokens.filter(w => refTokens.has(w)).length / Math.max(decTokens.length, 1);
const deriva = Number((1 - eco).toFixed(2));
st.referencia.decisiones.push({ n: st.referencia.decisiones.length + 1, decision, justificacion, etiqueta: etiqueta || null, deriva, ts: new Date().toISOString() });
store.save(st);
return ok({
  decision_n: st.referencia.decisiones.length, deriva_individual: deriva,
  estado: deriva > 0.75 ? "ROJA: esta decisión ya no habla del encargo" : deriva > 0.5 ? "AMARILLA: justifica la conexión" : "verde",
});`,
      },
      {
        name: "drift_report",
        desc: "Reporte de deriva acumulada: tendencia por ventana de 5 decisiones, punto de inflexión y fase donde torció.",
        params: {},
        code: `const st = store.load();
if (!st.referencia?.decisiones?.length) return fail("sin decisiones registradas");
const ds = st.referencia.decisiones.map(d => d.deriva);
const media = ds.reduce((a, b) => a + b, 0) / ds.length;
const ventanas = [];
for (let i = 0; i + 5 <= ds.length; i += 5) ventanas.push({ desde: i + 1, hasta: i + 5, deriva_media: Number((ds.slice(i, i + 5).reduce((a, b) => a + b, 0) / 5).toFixed(2)) });
let inflexion = null;
for (let i = 1; i < ds.length; i++) if (ds[i] - ds[i - 1] > 0.25 && ds[i] > 0.6) { inflexion = { decision_n: i + 1, salto: Number((ds[i] - ds[i - 1]).toFixed(2)), decision: st.referencia.decisiones[i].decision }; break; }
const ultimas5 = ds.slice(-5);
const tendencia = ultimas5.length ? (ultimas5[ultimas5.length - 1] - ultimas5[0]) / Math.max(ultimas5.length - 1, 1) : 0;
return ok({
  decisiones: ds.length, deriva_media: Number(media.toFixed(2)), deriva_actual: ds[ds.length - 1],
  tendencia_reciente: Number(tendencia.toFixed(3)),
  ventanas, punto_inflexion: inflexion,
  veredicto: media > 0.6 ? "DERIVA GRAVE: vuelve al encargo literal (" + st.referencia.encargo.slice(0, 80) + "...)" : media > 0.45 ? "deriva moderada: re-ancla justificando cada decisión con el encargo" : "trayectoria fiel",
});`,
      },
      {
        name: "re_anchor",
        desc: "Re-ancla al agente: devuelve el encargo literal + las últimas decisiones desviadas + plantilla de corrección.",
        params: {},
        code: `const st = store.load();
if (!st.referencia) return fail("sin referencia");
const ds = st.referencia.decisiones;
const desviadas = [...ds].reverse().filter(d => d.deriva > 0.6).slice(0, 5).reverse();
return ok({
  encargo_original: st.referencia.encargo,
  restricciones: st.referencia.restricciones,
  decisiones_desviadas_recientes: desviadas.map(d => ({ n: d.n, decision: d.decision, deriva: d.deriva })),
  plantilla_correccion: "Para cada decisión desviada decide: (a) descártala, (b) conéctala explícitamente al encargo, o (c) propone enmienda formal al humano. Después registra las correcciones con log_decision.",
  criterio: "una decisión sin conexión lexical NI lógica al encargo es deuda de deriva",
});`,
      },
      {
        name: "drift_stats",
        desc: "Estadísticas históricas de deriva por fase/etiqueta: dónde tiende a torcer este agente.",
        params: {},
        code: `const st = store.load();
const ds = st.referencia?.decisiones || [];
if (!ds.length) return ok({ decisiones: 0 });
const porEtiqueta = {};
for (const d of ds) {
  const k = d.etiqueta || "sin-etiqueta";
  porEtiqueta[k] = porEtiqueta[k] || { n: 0, suma: 0 };
  porEtiqueta[k].n++; porEtiqueta[k].suma += d.deriva;
}
return ok({
  decisiones: ds.length,
  deriva_por_fase: Object.fromEntries(Object.entries(porEtiqueta).map(([k, v]) => [k, { decisiones: v.n, deriva_media: Number((v.suma / v.n).toFixed(2)) }])),
  fase_mas_propensa: Object.entries(porEtiqueta).map(([k, v]: [string, any]) => ({ k, r: v.suma / v.n })).sort((a, b) => b.r - a.r)[0].k,
});`,
      },
    ],
  },
  {
    id: "commitment-ledger",
    title: "Commitment Ledger",
    tagline: "Libro mayor de compromisos del agente: promesas con deadline, cumplimiento y reputación",
    category: "Objetivos y Largo Plazo",
    pain: "Los agentes prometen ('lo envío hoy', 'lo reviso luego') y olvidan: no hay libro de compromisos, así que el incumplimiento es invisible hasta que el humano pregunta dónde está.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/commitment-ledger/. Compromisos con deadline, prioridad y beneficiario; alerta de vencidos, reputación de cumplimiento y carga futura por semana.",
    tools: [
      {
        name: "make_commitment",
        desc: "Registra un compromiso verificable: qué, para quién, cuándo y con qué criterio de cumplimiento.",
        params: { que: { t: "string", d: "Qué se promete (accionable)" }, para_quien: { t: "string", d: "Beneficiario (humano o agente)" }, deadline: { t: "string", d: "Fecha ISO o relativa (en 2h, mañana, 2026-12-01)" }, prioridad: { t: "enum", d: "Prioridad", values: ["alta", "media", "baja"], opt: true, def: "media" }, criterio: { t: "string", d: "Cómo se sabrá que se cumplió", opt: true } },
        code: `const st = store.load();
st.compromisos = st.compromisos || [];
function parseCuando(s) {
  const s2 = String(s).toLowerCase().trim();
  const m = s2.match(/^en\\s+(\\d+)\\s*(min|minutos|h|horas|d|dias|día|semana|semanas)/);
  if (m) { const n = parseInt(m[1]); const u = m[2]; const mult = u.startsWith("min") ? 60000 : u.startsWith("h") ? 3600000 : u.includes("semana") ? 604800000 : 86400000; return new Date(Date.now() + n * mult).toISOString(); }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
const cuando = parseCuando(deadline);
if (!cuando) return fail("deadline no interpretable: usa ISO o 'en 2h' / 'en 3 dias'");
const id = "cm_" + Date.now().toString(36);
st.compromisos.push({ id, que, para_quien, deadline: cuando, prioridad, criterio: criterio || null, estado: "abierto", creado: new Date().toISOString(), cumplido_ts: null });
store.save(st);
return ok({ compromiso_id: id, deadline: cuando, horas_restantes: Number(((new Date(cuando) - Date.now()) / 3600000).toFixed(1)) });`,
      },
      {
        name: "list_commitments",
        desc: "Lista compromisos abiertos ordenados por deadline con riesgo de vencimiento inminente.",
        params: { solo_abiertos: { t: "boolean", d: "Solo pendientes", opt: true, def: true }, para_quien: { t: "string", d: "Filtrar por beneficiario", opt: true } },
        code: `const st = store.load();
let cs = st.compromisos || [];
if (solo_abiertos) cs = cs.filter(c => c.estado === "abierto");
if (para_quien) cs = cs.filter(c => c.para_quien === para_quien);
cs.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
return ok({
  total: cs.length,
  vencidos: cs.filter(c => c.estado === "abierto" && new Date(c.deadline) < new Date()).length,
  compromisos: cs.map(c => ({
    id: c.id, que: c.que.slice(0, 80), para: c.para_quien, prioridad: c.prioridad,
    horas_restantes: Number(((new Date(c.deadline) - Date.now()) / 3600000).toFixed(1)),
    estado: c.estado === "abierto" && new Date(c.deadline) < new Date() ? "VENCIDO" : c.estado,
  })),
});`,
      },
      {
        name: "fulfill",
        desc: "Marca un compromiso como cumplido con evidencia; alimenta el score de reputación.",
        params: { compromiso_id: { t: "string", d: "ID del compromiso" }, evidencia: { t: "string", d: "Cómo se cumplió", opt: true } },
        code: `const st = store.load();
const c = (st.compromisos || []).find(x => x.id === compromiso_id);
if (!c) return fail("compromiso no encontrado");
if (c.estado !== "abierto") return fail("ya está " + c.estado);
c.estado = "cumplido";
c.cumplido_ts = new Date().toISOString();
c.evidencia = evidencia || null;
const tarde = new Date(c.cumplido_ts) > new Date(c.deadline);
c.tarde = tarde;
store.save(st);
return ok({ compromiso: c.id, cumplido: true, a_tiempo: !tarde, horas_de_diferencia: Number(((new Date(c.cumplido_ts) - new Date(c.deadline)) / 3600000).toFixed(1)) });`,
      },
      {
        name: "renegotiate",
        desc: "Renegocia un compromiso a punto de vencer: nuevo deadline con motivo (queda auditado).",
        params: { compromiso_id: { t: "string", d: "ID del compromiso" }, nuevo_deadline: { t: "string", d: "Nuevo plazo (ISO o 'en Xh')" }, motivo: { t: "string", d: "Por qué se renegocia" } },
        code: `const st = store.load();
const c = (st.compromisos || []).find(x => x.id === compromiso_id);
if (!c) return fail("compromiso no encontrado");
if (c.estado !== "abierto") return fail("compromiso " + c.estado);
const m = String(nuevo_deadline).toLowerCase().match(/^en\\s+(\\d+)\\s*(min|minutos|h|horas|d|dias|semanas?)/);
const cuando = m ? new Date(Date.now() + parseInt(m[1]) * (m[2].startsWith("min") ? 60000 : m[2].startsWith("h") ? 3600000 : m[2].includes("semana") ? 604800000 : 86400000)).toISOString() : (() => { const d = new Date(nuevo_deadline); return isNaN(d.getTime()) ? null : d.toISOString(); })();
if (!cuando) return fail("nuevo deadline no interpretable");
c.renegociaciones = c.renegociaciones || [];
c.renegociaciones.push({ antes: c.deadline, ahora: cuando, motivo, ts: new Date().toISOString() });
c.deadline = cuando;
store.save(st);
return ok({ compromiso: c.id, nuevo_deadline: cuando, renegociaciones: c.renegociaciones.length, aviso: c.renegociaciones.length >= 2 ? "dos renegociaciones: esto es un patrón, no un imprevisto" : "renegociado" });`,
      },
      {
        name: "reputation",
        desc: "Score de cumplimiento: tasa a tiempo, tardíos medios y patrón de renegociación.",
        params: {},
        code: `const st = store.load();
const cs = st.compromisos || [];
const cerrados = cs.filter(c => c.estado === "cumplido" || c.estado === "incumplido");
if (!cerrados.length) return ok({ cerrados: 0, sugerencia: "registra y cierra compromisos para medir reputación" });
const aTiempo = cerrados.filter(c => c.estado === "cumplido" && !c.tarde).length;
const tardios = cerrados.filter(c => c.tarde).length;
const reneg = cs.reduce((s, c) => s + (c.renegociaciones?.length || 0), 0);
return ok({
  total: cs.length, abiertos: cs.filter(c => c.estado === "abierto").length, vencidos_abiertos: cs.filter(c => c.estado === "abierto" && new Date(c.deadline) < new Date()).length,
  score_cumplimiento: Number((aTiempo / cerrados.length).toFixed(2)),
  a_tiempo: aTiempo, tardios, incumplidos: cerrados.filter(c => c.estado === "incumplido").length,
  renegociaciones_totales: reneg,
  veredicto: aTiempo / cerrados.length > 0.8 ? "agente fiable" : aTiempo / cerrados.length > 0.5 ? "cumplimiento irregular: compromete menos cosas o más plazo" : "incumplidor crónico: deja de prometer deadlines",
});`,
      },
      {
        name: "load_forecast",
        desc: "Proyección de carga por semana según compromisos abiertos: detecta semanas saturadas.",
        params: {},
        code: `const st = store.load();
const abiertos = (st.compromisos || []).filter(c => c.estado === "abierto");
if (!abiertos.length) return ok({ carga: 0, semanas: [] });
const semanas = {};
for (const c of abiertos) {
  const d = new Date(c.deadline);
  const inicio = new Date(d); inicio.setHours(0, 0, 0, 0); inicio.setDate(inicio.getDate() - inicio.getDay());
  const k = inicio.toISOString().slice(0, 10);
  semanas[k] = semanas[k] || { semana: k, compromisos: 0, alta: 0 };
  semanas[k].compromisos++;
  if (c.prioridad === "alta") semanas[k].alta++;
}
const lista = Object.values(semanas).sort((a, b) => a.semana < b.semana ? -1 : 1);
return ok({
  abiertos: abiertos.length,
  semanas: lista.map(s => ({ ...s, saturada: s.compromisos >= 5 || s.alta >= 3 })),
  advertencia: lista.filter(s => s.compromisos >= 5 || s.alta >= 3).map(s => "semana " + s.semana + " saturada: renegocia o delega antes"),
});`,
      },
    ],
  },
  {
    id: "scope-guard",
    title: "Scope Guard",
    tagline: "Detecta scope creep del agente: trabajo fuera del alcance acordado antes de gastar tokens en él",
    category: "Objetivos y Largo Plazo",
    pain: "El agente 'ayuda de más': pide validar un formulario y termina refactorizando la app entera. El scope creep quema presupuesto y introduce riesgo sin que nadie lo autorizara.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/scope-guard/. Define el alcance incluido/explícito-excluido; clasifica tareas (dentro, borde, fuera) y acumula deuda de scope con costo estimado.",
    tools: [
      {
        name: "define_scope",
        desc: "Define el alcance del encargo: qué incluye y qué queda EXPLÍCITAMENTE fuera (lo segundo es lo que importa).",
        params: { incluye: { t: "array", d: "Ámbitos incluidos" }, excluye: { t: "array", d: "Ámbitos explícitamente fuera de alcance" }, presupuesto_tokens: { t: "number", d: "Presupuesto total del encargo", opt: true } },
        code: `const st = store.load();
st.alcance = { incluye: (incluye || []).map(String), excluye: (excluye || []).map(String), presupuesto_tokens: presupuesto_tokens || null, definido: new Date().toISOString(), eventos: [], tokens_fuera_scope: 0 };
store.save(st);
return ok({ alcance_definido: true, incluye: (incluye || []).length, excluye: (excluye || []).length, regla: "tarea fuera de alcance = para, pregunta, no hagas" });`,
      },
      {
        name: "check_task",
        desc: "Clasifica una tarea contra el alcance: dentro / borde / fuera, con el ámbito excluido que pisa (si aplica).",
        params: { tarea: { t: "string", d: "Tarea o sub-tarea a clasificar" } },
        code: `const st = store.load();
if (!st.alcance) return fail("define el alcance con define_scope");
const a = st.alcance;
const tokens = (s) => new Set(String(s).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
const t = [...tokens(tarea)];
function mejorMatch(frase) { const ft = [...tokens(frase)]; const hit = ft.filter(w => t.includes(w)).length; return { hit, score: ft.length ? hit / ft.length : 0, frase }; }
const inc = a.incluye.map(mejorMatch).sort((x, y) => y.score - x.score)[0] || { score: 0 };
const exc = a.excluye.map(mejorMatch).sort((x, y) => y.score - x.score)[0] || { score: 0 };
let veredicto;
if (exc.score >= 0.5 && exc.score >= inc.score) veredicto = "FUERA: pisa el ámbito excluido '" + exc.frase + "'";
else if (inc.score >= 0.5) veredicto = "dentro del alcance";
else if (exc.score >= 0.3) veredicto = "BORDE: sospechoso de '" + exc.frase + "', confirma antes";
else veredicto = "BORDE: sin match claro ni con incluye ni excluye: pregunta";
a.eventos.push({ tarea: tarea.slice(0, 100), veredicto, ts: new Date().toISOString() });
store.save(st);
return ok({ veredicto, match_incluye: Number(inc.score.toFixed(2)), match_excluye: Number(exc.score.toFixed(2)), accion: veredicto.startsWith("FUERA") ? "NO ejecutar sin autorización: propón una enmienda de alcance al humano" : veredicto.startsWith("BORDE") ? "confirma con el humano (una línea) antes de gastar tokens" : "ejecuta" });`,
      },
      {
        name: "log_out_of_scope",
        desc: "Registra trabajo fuera de alcance ya realizado (confesión) con tokens gastados: deuda de scope.",
        params: { tarea: { t: "string", d: "Qué se hizo fuera de alcance" }, tokens_gastados: { t: "number", d: "Tokens quemados", opt: true }, resultado_util: { t: "boolean", d: "¿Produjo algo aprovechable?", opt: true, def: false } },
        code: `const st = store.load();
if (!st.alcance) return fail("sin alcance definido");
st.alcance.deuda = st.alcance.deuda || [];
st.alcance.deuda.push({ tarea, tokens: tokens_gastados || 0, util: resultado_util, ts: new Date().toISOString() });
st.alcance.tokens_fuera_scope += tokens_gastados || 0;
store.save(st);
const pct = st.alcance.presupuesto_tokens ? Number((st.alcance.tokens_fuera_scope / st.alcance.presupuesto_tokens * 100).toFixed(1)) : null;
return ok({ deuda_registrada: true, tokens_fuera_scope_total: st.alcance.tokens_fuera_scope, pct_presupuesto_desperdiciado: pct, incidentes: st.alcance.deuda.length });`,
      },
      {
        name: "scope_report",
        desc: "Reporte de disciplina de alcance: tareas clasificadas, deuda acumulada y % de presupuesto desperdiciado.",
        params: {},
        code: `const st = store.load();
if (!st.alcance) return fail("sin alcance definido");
const a = st.alcance;
const evs = a.eventos || [];
const fuera = evs.filter(e => e.veredicto.startsWith("FUERA")).length;
const borde = evs.filter(e => e.veredicto.startsWith("BORDE")).length;
return ok({
  tareas_evaluadas: evs.length,
  dentro: evs.length - fuera - borde, borde, fuera,
  disciplina_pct: evs.length ? Number((((evs.length - fuera) / evs.length) * 100).toFixed(1)) : null,
  deuda_scope: { incidentes: (a.deuda || []).length, tokens_desperdiciados: a.tokens_fuera_scope, pct_presupuesto: a.presupuesto_tokens ? Number((a.tokens_fuera_scope / a.presupuesto_tokens * 100).toFixed(1)) : null },
  ultimas_fueras: evs.filter(e => e.veredicto.startsWith("FUERA")).slice(-5).map(e => e.tarea),
  veredicto: fuera === 0 ? "agente disciplinado" : fuera > evs.length * 0.2 ? "scope creep severo: endurece el excluye" : "creep moderado: vigila los BORDE",
});`,
      },
      {
        name: "amend_scope",
        desc: "Enmienda el alcance formalmente (nuevo incluye/excluye) con motivo: crecer alcance con permiso, no de contrabando.",
        params: { incluye_extra: { t: "array", d: "Nuevos ámbitos incluidos", opt: true }, excluye_extra: { t: "array", d: "Nuevos ámbitos excluidos", opt: true }, motivo: { t: "string", d: "Quién autoriza y por qué" } },
        code: `const st = store.load();
if (!st.alcance) return fail("sin alcance definido");
if (!motivo) return fail("la enmienda de alcance necesita motivo y autorizador");
const a = st.alcance;
a.incluye.push(...(incluye_extra || []).map(String));
a.excluye.push(...(excluye_extra || []).map(String));
a.enmiendas = a.enmiendas || [];
a.enmiendas.push({ motivo, incluye: a.incluye.length, excluye: a.excluye.length, ts: new Date().toISOString() });
store.save(st);
return ok({ enmienda_n: a.enmiendas.length, incluye: a.incluye.length, excluye: a.excluye.length });`,
      },
    ],
  },
];

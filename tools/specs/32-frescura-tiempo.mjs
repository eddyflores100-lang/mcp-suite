// ═══ CATEGORÍA: Dolores FUTUROS · Frescura del Conocimiento ═══
// Evidencia: los agentes mezclan hechos de distinta edad sin señalizar su
// validez temporal: "freshness" del conocimiento como dolor creciente
// cuando los datos y el mundo cambian más rápido que la sesión.
export default [
  {
    id: "fact-staleness",
    title: "Fact Staleness",
    tagline: "Validez temporal de hechos: cada dato caduca y el agente debe saber cuándo ya no sirve",
    category: "Frescura del Conocimiento",
    pain: "El agente trata todos los hechos como eternos: cita un dato de 2023 como vigente, mezcla precios antiguos con actuales y no sabe qué parte de su conocimiento ya venció.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/fact-staleness/. Hechos con vida-media por clase (precio 7d, métrica 30d, hecho estructural ∞); calcula frescura, vencidos y exige re-verificación.",
    tools: [
      {
        name: "register_fact",
        desc: "Registra un hecho con su fuente, fecha de observación y clase (que determina su vida media).",
        params: { hecho: { t: "string", d: "El hecho en una frase" }, valor: { t: "string", d: "Valor/dato concreto" }, clase: { t: "enum", d: "Clase de hecho", values: ["precio", "metrica", "inventario", "noticia", "regla_negocio", "hecho_estructural", "dato_persona"] }, fuente: { t: "string", d: "De dónde se obtuvo" }, observado: { t: "string", d: "Fecha ISO en que se observó", opt: true } },
        code: `const st = store.load();
st.hechos = st.hechos || [];
const VIDA_MEDIA_DIAS = { precio: 7, metrica: 30, inventario: 1, noticia: 14, regla_negocio: 180, hecho_estructural: 3650, dato_persona: 365 };
const obs = observado || new Date().toISOString();
if (isNaN(new Date(obs).getTime())) return fail("observado no es fecha ISO");
st.hechos.push({ id: "ft_" + Date.now().toString(36), hecho, valor, clase, fuente, observado: obs, vida_media_dias: VIDA_MEDIA_DIAS[clase], verificaciones: 0, ts: new Date().toISOString() });
store.save(st);
return ok({ id: st.hechos[st.hechos.length - 1].id, hecho: hecho.slice(0, 70), clase, vida_media_dias: VIDA_MEDIA_DIAS[clase], caduca_aprox: new Date(new Date(obs).getTime() + VIDA_MEDIA_DIAS[clase] * 86400000).toISOString().slice(0, 10) });`,
      },
      {
        name: "check_freshness",
        desc: "Evalúa la frescura de los hechos registrados: frescos, a punto de caducar y ya vencidos.",
        params: {},
        code: `const st = store.load();
const hechos = st.hechos || [];
if (!hechos.length) return ok({ hechos: 0, sugerencia: "registra hechos con register_fact" });
const ahora = Date.now();
const evaluados = hechos.map(f => {
  const edadDias = (ahora - new Date(f.observado).getTime()) / 86400000;
  const ratio = edadDias / f.vida_media_dias;
  const estado = ratio > 1 ? "VENCIDO" : ratio > 0.7 ? "A_PUNTO" : "fresco";
  return { id: f.id, hecho: f.hecho.slice(0, 70), clase: f.clase, edad_dias: Number(edadDias.toFixed(1)), vida_media: f.vida_media_dias, estado };
});
return ok({
  hechos: evaluados.length,
  frescos: evaluados.filter(e => e.estado === "fresco").length,
  a_punto: evaluados.filter(e => e.estado === "A_PUNTO").length,
  vencidos: evaluados.filter(e => e.estado === "VENCIDO").length,
  vencidos_detalle: evaluados.filter(e => e.estado === "VENCIDO").slice(0, 10),
  regla: "un hecho VENCIDO no puede usarse en una respuesta sin re-verificarlo (refresh_fact) o marcarlo como desactualizado",
});`,
      },
      {
        name: "refresh_fact",
        desc: "Re-verifica un hecho: nuevo valor + fuente + fecha, dejando auditoría del cambio.",
        params: { id: { t: "string", d: "ID del hecho" }, nuevo_valor: { t: "string", d: "Valor re-verificado" }, fuente: { t: "string", d: "Fuente de la verificación" }, sin_cambio: { t: "boolean", d: "true si se confirmó igual", opt: true, def: false } },
        code: `const st = store.load();
const f = (st.hechos || []).find(x => x.id === id);
if (!f) return fail("hecho no encontrado");
f.historial = f.historial || [];
f.historial.push({ valor: f.valor, observado: f.observado, ts: new Date().toISOString() });
if (!sin_cambio) f.valor = nuevo_valor;
f.observado = new Date().toISOString();
if (fuente) f.fuente = fuente;
f.verificaciones++;
store.save(st);
return ok({ hecho: f.hecho.slice(0, 70), verificado: true, valor_actual: f.valor, cambios_previos: f.historial.length });`,
      },
      {
        name: "assert_usable",
        desc: "Antes de usar un hecho en una respuesta: ¿sigue siendo utilizable o hay que re-verificarlo?",
        params: { id: { t: "string", d: "ID del hecho" } },
        code: `const st = store.load();
const f = (st.hechos || []).find(x => x.id === id);
if (!f) return fail("hecho no encontrado");
const edadDias = (Date.now() - new Date(f.observado)) / 86400000;
const ratio = edadDias / f.vida_media_dias;
if (ratio > 1) return ok({ utilizable: false, accion: "RE-VERIFICAR antes de citar: venció hace " + Number((ratio - 1) * f.vida_media_dias).toFixed(1) + " días (vida media " + f.vida_media_dias + "d)", valor_actual: f.valor });
if (ratio > 0.7) return ok({ utilizable: "condicional", accion: "cítaalo con fecha ('según " + f.fuente + ", " + f.observado.slice(0, 10) + "') y re-verifica si es decisión crítica", valor_actual: f.valor });
return ok({ utilizable: true, accion: "puedes usarlo; aún así cita la fecha de observación", valor_actual: f.valor, observado: f.observado.slice(0, 10) });`,
      },
      {
        name: "staleness_report",
        desc: "Reporte por clase de hecho: qué clases de conocimiento se mantienen al día y cuáles no.",
        params: {},
        code: `const st = store.load();
const hechos = st.hechos || [];
if (!hechos.length) return ok({ hechos: 0 });
const porClase = {};
for (const f of hechos) {
  porClase[f.clase] = porClase[f.clase] || { total: 0, vencidos: 0, verificaciones: 0 };
  porClase[f.clase].total++;
  if ((Date.now() - new Date(f.observado)) / 86400000 > f.vida_media_dias) porClase[f.clase].vencidos++;
  porClase[f.clase].verificaciones += f.verificaciones;
}
return ok({
  clases: Object.keys(porClase).length,
  por_clase: Object.entries(porClase).map(([k, v]: [string, any]) => ({ clase: k, hechos: v.total, vencidos: v.vencidos, pct: v.total ? v.vencidos / v.total : 0 })).sort((a, b) => b.pct - a.pct),
  clase_mas_descuidada: Object.entries(porClase).map(([k, v]: [string, any]) => ({ k, r: v.total ? v.vencidos / v.total : 0 })).sort((a, b) => b.r - a.r)[0].k,
});`,
      },
    ],
  },
  {
    id: "source-timeline",
    title: "Source Timeline",
    tagline: "Línea de tiempo de fuentes: cuándo se supo qué y qué fuente dijo primero cada cosa",
    category: "Frescura del Conocimiento",
    pain: "El agente funde información de fuentes de distinta época en un solo presente: dice 'según los informes' mezclando 2019 con 2026 sin poder reconstruir qué se sabía en qué momento.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/source-timeline/. Eventos de conocimiento {fuente, fecha, afirmación}; timeline cronológico, contradicciones cronológicas (una fuente posterior contradice) y quién dijo primero.",
    tools: [
      {
        name: "add_event",
        desc: "Añade un evento de conocimiento: fuente, fecha, afirmación y tema.",
        params: { fuente: { t: "string", d: "Nombre de la fuente" }, fecha: { t: "string", d: "Fecha ISO de la publicación/observación" }, afirmacion: { t: "string", d: "Qué afirmó" }, tema: { t: "string", d: "Tema (para agrupar)", opt: true, def: "general" } },
        code: `const st = store.load();
if (isNaN(new Date(fecha).getTime())) return fail("fecha ISO inválida");
st.eventos = st.eventos || [];
st.eventos.push({ fuente, fecha, afirmacion, tema, ts: new Date().toISOString() });
store.save(st);
return ok({ fuente, fecha: fecha.slice(0, 10), tema });`,
      },
      {
        name: "timeline",
        desc: "Devuelve la línea de tiempo cronológica (global o por tema) con edad de cada afirmación.",
        params: { tema: { t: "string", d: "Filtrar por tema", opt: true } },
        code: `const st = store.load();
let evs = st.eventos || [];
if (tema) evs = evs.filter(e => e.tema === tema);
if (!evs.length) return ok({ eventos: 0 });
evs = [...evs].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
return ok({
  eventos: evs.length,
  rango: { desde: evs[0].fecha.slice(0, 10), hasta: evs[evs.length - 1].fecha.slice(0, 10) },
  linea: evs.map(e => ({ fecha: e.fecha.slice(0, 10), fuente: e.fuente, afirmacion: e.afirmacion.slice(0, 100), tema: e.tema, dias_desde: Number(((Date.now() - new Date(e.fecha)) / 86400000).toFixed(0)) })),
  advertencia: (Date.now() - new Date(evs[evs.length - 1].fecha)) / 86400000 > 180 ? "la información más reciente tiene más de 6 meses: busca fuentes frescas" : null,
});`,
      },
      {
        name: "contradiction_scan",
        desc: "Escanea contradicciones cronológicas: fuentes posteriores que afirman lo opuesto sobre el mismo tema.",
        params: {},
        code: `const st = store.load();
const evs = (st.eventos || []).map(e => e).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
if (evs.length < 2) return ok({ eventos: evs.length, contradicciones: 0 });
const tokens = (s) => new Set(String(s).toLowerCase().split(/\\W+/).filter(w => w.length > 4));
const NEGADORES = /\\b(no|nunca|sin|cero|falso|reverso|declinó|declino|cayó|cayo|baja)\\b/i;
const contradicciones = [];
for (let i = 0; i < evs.length; i++) {
  for (let j = i + 1; j < evs.length; j++) {
    if (evs[i].tema !== evs[j].tema) continue;
    const a = tokens(evs[i].afirmacion), b = tokens(evs[j].afirmacion);
    const inter = [...a].filter(w => b.has(w)).length;
    const union = new Set([...a, ...b]).size || 1;
    const similitud = inter / union;
    if (similitud >= 0.35 && (NEGADORES.test(evs[i].afirmacion) !== NEGADORES.test(evs[j].afirmacion))) {
      contradicciones.push({ tema: evs[i].tema, antes: { fuente: evs[i].fuente, fecha: evs[i].fecha.slice(0, 10), afirmacion: evs[i].afirmacion.slice(0, 80) }, despues: { fuente: evs[j].fuente, fecha: evs[j].fecha.slice(0, 10), afirmacion: evs[j].afirmacion.slice(0, 80) }, similitud: Number(similitud.toFixed(2)) });
    }
  }
}
return ok({
  contradicciones: contradicciones.length,
  pares: contradicciones.slice(0, 8),
  regla: "ante contradicción cronológica: cita la fuente MÁS RECIENTE pero menciona que hubo cambio ('antes se decía X, desde [fecha] Y')",
});`,
      },
      {
        name: "who_said_first",
        desc: "Para un tema/afirmación: qué fuente lo dijo primero y quién lo replicó después.",
        params: { consulta: { t: "string", d: "Tema o palabra clave" } },
        code: `const st = store.load();
const evs = (st.eventos || []).filter(e => e.tema.toLowerCase().includes(String(consulta).toLowerCase()) || e.afirmacion.toLowerCase().includes(String(consulta).toLowerCase())).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
if (!evs.length) return ok({ encontrados: 0 });
return ok({
  encontrados: evs.length,
  primera: { fuente: evs[0].fuente, fecha: evs[0].fecha.slice(0, 10), afirmacion: evs[0].afirmacion.slice(0, 100) },
  replicas: evs.slice(1).map(e => ({ fuente: e.fuente, fecha: e.fecha.slice(0, 10) })),
  lectura: evs.length === 1 ? "una sola fuente: corroboración pendiente" : "corroborado por " + evs.length + " fuentes, original de " + evs[0].fuente,
});`,
      },
    ],
  },
  {
    id: "deadline-engine",
    title: "Deadline Engine",
    tagline: "Deadlines con prioridad dinámica: el antídoto contra la procrastinación estructural del agente",
    category: "Frescura del Conocimiento",
    pain: "El agente trabaja en orden de llegada, no de urgencia: descubre el deadline vencido cuando pregunta '¿qué hago ahora?' y ya no hay tiempo. La urgencia tiene que calcularse, no recordarse.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/deadline-engine/. Items con deadline y peso; prioridad dinámica = cercanía x peso x tamaño (slack); detecta deadlines imposibles y agenda de trabajo óptima.",
    tools: [
      {
        name: "add_deadline",
        desc: "Añade un item con deadline, peso y esfuerzo estimado: la prioridad se recalcula sola.",
        params: { item: { t: "string", d: "Tarea/entrega con plazo" }, deadline: { t: "string", d: "Fecha ISO o 'en Xh'/'en Xd'" }, peso: { t: "enum", d: "Importancia", values: ["bajo", "medio", "alto", "critico"], opt: true, def: "medio" }, esfuerzo_horas: { t: "number", d: "Esfuerzo estimado", opt: true, def: 1 } },
        code: `const st = store.load();
const m = String(deadline).toLowerCase().match(/^en\\s+(\\d+)\\s*(h|horas|d|dias|día)/);
const cuando = m
  ? new Date(Date.now() + parseInt(m[1]) * (m[2].startsWith("h") ? 3600000 : 86400000)).toISOString()
  : (() => { const d = new Date(deadline); return isNaN(d.getTime()) ? null : d.toISOString(); })();
if (!cuando) return fail("deadline no interpretable (ISO o 'en 3h' / 'en 2d')");
st.items = st.items || [];
st.items.push({ id: "dl_" + Date.now().toString(36), item, deadline: cuando, peso, esfuerzo_horas: esfuerzo_horas ?? 1, completado: false, creado: new Date().toISOString() });
store.save(st);
return ok({ item: item.slice(0, 60), deadline: cuando, horas_restantes: Number(((new Date(cuando) - Date.now()) / 3600000).toFixed(1)) });`,
      },
      {
        name: "priority_queue",
        desc: "Cola priorizada dinámicamente: urgencia por cercanía x peso, con slack (tiempo libre antes del deadline).",
        params: {},
        code: `const st = store.load();
const items = (st.items || []).filter(i => !i.completado);
if (!items.length) return ok({ pendientes: 0 });
const PESO = { critico: 4, alto: 3, medio: 2, bajo: 1 };
const cola = items.map(i => {
  const horasRest = (new Date(i.deadline) - Date.now()) / 3600000;
  const slack = horasRest - i.esfuerzo_horas;
  const urgencia = PESO[i.peso] * (1 / Math.max(horasRest / 24, 0.05));
  const prioridad = urgencia * (slack < 0 ? 1.5 : 1);
  return { id: i.id, item: i.item.slice(0, 70), deadline: i.deadline.slice(0, 16), horas_restantes: Number(horasRest.toFixed(1)), slack_horas: Number(slack.toFixed(1)), peso: i.peso, prioridad: Number(prioridad.toFixed(2)) };
}).sort((a, b) => b.prioridad - a.prioridad);
return ok({
  pendientes: cola.length,
  vencidos: cola.filter(c => c.horas_restantes < 0).length,
  sin_slack: cola.filter(c => c.slack_horas < 0 && c.horas_restantes > 0).length,
  cola,
  siguiente_accion: cola[0] ? "trabaja AHORA en: " + cola[0].item + (cola[0].slack_horas < 0 ? " (SLACK NEGATIVO: avisa del retraso YA)" : "") : null,
});`,
      },
      {
        name: "feasibility_check",
        desc: "Comprueba si todo lo pendiente cabe en el tiempo disponible: detecta deadlines imposibles.",
        params: { horas_disponibles: { t: "number", d: "Horas de trabajo disponibles hasta el deadline más lejano", opt: true, def: 8 } },
        code: `const st = store.load();
const items = (st.items || []).filter(i => !i.completado);
if (!items.length) return ok({ pendientes: 0 });
const totalEsfuerzo = items.reduce((s, i) => s + i.esfuerzo_horas, 0);
const imposible = items.filter(i => (new Date(i.deadline) - Date.now()) / 3600000 < i.esfuerzo_horas);
return ok({
  pendientes: items.length,
  esfuerzo_total_horas: Number(totalEsfuerzo.toFixed(1)),
  horas_disponibles: horas_disponibles,
  carga: Number((totalEsfuerzo / horas_disponibles).toFixed(2)) + "x",
  deadlines_imposibles: imposible.map(i => ({ item: i.item.slice(0, 60), horas_restantes: Number(((new Date(i.deadline) - Date.now()) / 3600000).toFixed(1)), necesita: i.esfuerzo_horas })),
  veredicto: totalEsfuerzo > horas_disponibles ? "SOBRECARGA: no cabe todo: renegocia plazos o delega ANTES de fallar" : imposible.length ? "hay items imposibles individualmente: avisa ya" : "factible",
});`,
      },
      {
        name: "complete",
        desc: "Marca un item como completado y mide si se cumplió a tiempo.",
        params: { id: { t: "string", d: "ID del item" } },
        code: `const st = store.load();
const i = (st.items || []).find(x => x.id === id);
if (!i) return fail("item no encontrado");
i.completado = true;
i.completado_ts = new Date().toISOString();
i.a_tiempo = new Date(i.completado_ts) <= new Date(i.deadline);
store.save(st);
return ok({ item: i.item.slice(0, 60), a_tiempo: i.a_tiempo, horas_margen: Number(((new Date(i.deadline) - new Date(i.completado_ts)) / 3600000).toFixed(1)) });`,
      },
    ],
  },
  {
    id: "temporal-reasoner",
    title: "Temporal Reasoner",
    tagline: "Razonamiento temporal: antes/después, solapamientos, duraciones y secuencias consistentes",
    category: "Frescura del Conocimiento",
    pain: "El agente dice cosas temporalmente imposibles: 'el despliegue del lunes usó el bug corregido el miércoles', cita eventos solapados como secuenciales y nadie verifica la coherencia temporal.",
    persistent: false,
    notes: "Sin persistencia. Intervalos {inicio, fin, etiqueta}: orden, solapamiento, contención, duración y validación de afirmaciones secuenciales.",
    tools: [
      {
        name: "check_sequence",
        desc: "Valida que una secuencia de eventos fechados es cronológicamente posible.",
        params: { eventos: { t: "array", d: "Lista {etiqueta, fecha} en el orden narrado" } },
        code: `const evs = (eventos || []).filter(e => e && e.etiqueta && e.fecha);
if (evs.length < 2) return fail("necesitas >=2 eventos {etiqueta, fecha}");
let consistente = true;
const violaciones = [];
for (let i = 1; i < evs.length; i++) {
  const t0 = new Date(evs[i - 1].fecha).getTime();
  const t1 = new Date(evs[i].fecha).getTime();
  if (isNaN(t0) || isNaN(t1)) return fail("fecha inválida en evento " + i);
  if (t1 < t0) { consistente = false; violaciones.push({ antes: evs[i - 1].etiqueta + " (" + evs[i - 1].fecha + ")", despues: evs[i].etiqueta + " (" + evs[i].fecha + ")", problema: "el segundo ocurre ANTES que el primero" }); }
}
return ok({ secuencia_posible: consistente, violaciones, eventos: evs.length });`,
      },
      {
        name: "overlap_check",
        desc: "Comprueba si dos intervalos temporales se solapan, contienen o son disjuntos.",
        params: { a_inicio: { t: "string", d: "Inicio intervalo A (ISO)" }, a_fin: { t: "string", d: "Fin intervalo A" }, b_inicio: { t: "string", d: "Inicio intervalo B" }, b_fin: { t: "string", d: "Fin intervalo B" } },
        code: `const p = (s) => new Date(s).getTime();
const nums = [p(a_inicio), p(a_fin), p(b_inicio), p(b_fin)];
if (nums.some(isNaN)) return fail("fechas ISO inválidas");
if (p(a_inicio) > p(a_fin) || p(b_inicio) > p(b_fin)) return fail("intervalo con inicio posterior a su fin");
const solapa = p(a_inicio) < p(b_fin) && p(b_inicio) < p(a_fin);
const aContieneB = p(a_inicio) <= p(b_inicio) && p(b_fin) <= p(a_fin);
const bContieneA = p(b_inicio) <= p(a_inicio) && p(a_fin) <= p(b_fin);
let relacion = "disjuntos";
if (aContieneB) relacion = "A contiene a B";
else if (bContieneA) relacion = "B contiene a A";
else if (solapa) relacion = "solapados parcialmente";
return ok({
  relacion,
  duracion_a_dias: Number(((p(a_fin) - p(a_inicio)) / 86400000).toFixed(1)),
  duracion_b_dias: Number(((p(b_fin) - p(b_inicio)) / 86400000).toFixed(1)),
  solapamiento_dias: solapa ? Number(((Math.min(p(a_fin), p(b_fin)) - Math.max(p(a_inicio), p(b_inicio))) / 86400000).toFixed(1)) : 0,
  implicacion: solapa ? "los dos estaban activos a la vez: NO pueden describirse como secuencia (primero A luego B)" : "pueden narrarse como secuencia",
});`,
      },
      {
        name: "relative_time",
        desc: "Convierte lenguaje temporal relativo a absoluto y viceversa (hace N días, la semana pasada...).",
        params: { expresion: { t: "string", d: "Expresión temporal ('hace 3 dias', 'en 2 semanas', ISO)" } },
        code: `const e = String(expresion).toLowerCase().trim();
const ahora = new Date();
if (/^\\d{4}-\\d{2}-\\d{2}/.test(e)) {
  const d = new Date(e);
  const dias = Math.round((ahora.getTime() - d.getTime()) / 86400000);
  return ok({ absoluto: e, relativo: dias === 0 ? "hoy" : dias > 0 ? "hace " + dias + " días" : "en " + (-dias) + " días", dias_delta: dias });
}
const m = e.match(/^hace\\s+(\\d+)\\s*(min|minutos|h|horas|d|dias|día|semana|semanas|mes|meses)/);
if (m) {
  const n = parseInt(m[1]), u = m[2];
  const ms = u.startsWith("min") ? 60000 : u.startsWith("h") ? 3600000 : u.startsWith("mes") ? 2592000000 : u.includes("semana") ? 604800000 : 86400000;
  return ok({ relativo: e, absoluto: new Date(ahora.getTime() - n * ms).toISOString(), dias_delta: -Number((n * ms / 86400000).toFixed(1)) });
}
const m2 = e.match(/^en\\s+(\\d+)\\s*(min|minutos|h|horas|d|dias|día|semana|semanas|mes|meses)/);
if (m2) {
  const n = parseInt(m2[1]), u = m2[2];
  const ms = u.startsWith("min") ? 60000 : u.startsWith("h") ? 3600000 : u.startsWith("mes") ? 2592000000 : u.includes("semana") ? 604800000 : 86400000;
  return ok({ relativo: e, absoluto: new Date(ahora.getTime() + n * ms).toISOString(), dias_delta: Number((n * ms / 86400000).toFixed(1)) });
}
if (/la semana pasada/.test(e)) return ok({ relativo: e, absoluto: new Date(ahora.getTime() - 7 * 86400000).toISOString().slice(0, 10), nota: "semana pasada aproximada" });
return fail("expresión no reconocida: usa ISO, 'hace 3 dias' o 'en 2 semanas'");`,
      },
      {
        name: "consistency_scan",
        desc: "Escanea un texto en busca de afirmaciones temporales inconsistentes (fechas imposibles entre sí).",
        params: { texto: { t: "string", d: "Texto a auditar" } },
        code: `const t = String(texto || "");
if (t.length < 30) return fail("texto demasiado corto");
const fechas = [...t.matchAll(/\\b(20\\d{2})-(\\d{2})-(\\d{2})\\b/g)].map(m => ({ iso: m[0], ts: new Date(m[0]).getTime(), ctx: t.slice(Math.max(0, m.index - 35), m.index + 40).replace(/\\n/g, " ") }));
const anos = [...t.matchAll(/\\b(19|20)(\\d{2})\\b/g)].map(m => ({ ano: m[0], ctx: t.slice(Math.max(0, m.index - 35), m.index + 40).replace(/\\n/g, " ") }));
const problemas = [];
if (fechas.length >= 2) {
  const max = Math.max(...fechas.map(f => f.ts));
  for (const f of fechas) {
    const despuesDe = /después de|posterior a|tras/i.test(f.ctx);
    const antesDe = /antes de|previo a|anterior a/i.test(f.ctx);
    if (despuesDe && f.ts < max * 0.999) { /* ok */ }
  }
  const ordenadas = [...fechas].sort((a, b) => a.ts - b.ts);
  if (/primero|inicialmente|al comienzo/i.test(ordenadas[ordenadas.length - 1].ctx) && ordenadas.length > 1) {
    problemas.push({ tipo: "primero_es_posterior", detalle: "un evento narrado como 'primero' tiene la fecha más tardía: " + ordenadas[ordenadas.length - 1].ctx });
  }
}
if (anos.length >= 2) {
  const set = [...new Set(anos.map(a => a.ano))].sort();
  if (set.length > 1 && Math.abs(parseInt(set[set.length - 1]) - parseInt(set[0])) > 8) {
    problemas.push({ tipo: "rango_anos_amplio", detalle: "el texto mezcla " + set[0] + " y " + set[set.length - 1] + ": verifica que no se presentan como contemporáneos" });
  }
}
return ok({
  fechas_detectadas: fechas.length, anos_detectados: [...new Set(anos.map(a => a.ano))],
  problemas: problemas.length,
  detalle: problemas,
  veredicto: problemas.length ? "posible inconsistencia temporal: revisa" : "sin inconsistencias evidentes",
});`,
      },
    ],
  },
];

// ═══ CATEGORÍA: Dolores FUTUROS · Auto-Mejora (B) ═══
// Evidencia: la auto-edición de prompts sin guardarrailes rompe constraints;
// el cambio de comportamiento del agente es invisible sin diffs de conducta;
// y las capacidades faltantes solo se detectan al fallar la tarea.
export default [
  {
    id: "prompt-self-rewriter",
    title: "Prompt Self-Rewriter",
    tagline: "Auto-edición de prompts con guardarrailes: el agente propone su propia mejora pero no puede debilitar sus restricciones",
    category: "Auto-Mejora",
    pain: "El agente 'optimiza' su propio prompt y sin querer borra la línea que prohibía exfiltrar datos: la auto-mejora sin candados es la vía rápida a la auto-anulación de las normas.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/prompt-self-rewriter/. Prompt actual + intención + restricciones; las ediciones propuestas pasan guardarrailes (no eliminar restricciones, no ampliar alcance) y exigen puerta de evaluación antes de adoptarse.",
    tools: [
      {
        name: "register_prompt",
        desc: "Registra el prompt actual con su intención y la lista de restricciones intocables.",
        params: { nombre: { t: "string", d: "Nombre del prompt" }, contenido: { t: "string", d: "Texto completo actual" }, intencion: { t: "string", d: "Qué debe lograr el prompt" }, restricciones: { t: "array", d: "Restricciones que NUNCA pueden debilitarse (texto o resumen por línea)" } },
        code: `const st = store.load();
st.prompts = st.prompts || {};
if (st.prompts[nombre]) return fail("prompt ya registrado: " + nombre);
if (!restricciones || !restricciones.length) return fail("SIN restricciones declaradas no hay auto-edición segura: declara al menos las que protegen datos y alcance");
st.prompts[nombre] = { nombre, contenido, intencion, restricciones: restricciones.map(String), ediciones: [], adoptadas: 0, rechazadas: 0, registrado: new Date().toISOString() };
store.save(st);
return ok({ nombre, restricciones_intocables: restricciones.length, caracteres: contenido.length, nota: "toda edición pasará por guardrail_check antes de poder adoptarse" });`,
      },
      {
        name: "propose_edit",
        desc: "Propón una edición concreta del prompt con justificación basada en evidencia.",
        params: { nombre: { t: "string", d: "Prompt" }, tipo: { t: "enum", d: "Naturaleza de la edición", values: ["añadir_instruccion", "clarificar_ambiguedad", "reordenar", "recortar_ruido", "añadir_ejemplo"] }, edicion: { t: "string", d: "El cambio concreto (texto a añadir/quitar/reordenar)" }, porque: { t: "string", d: "Evidencia de que mejora: qué fallo concreto corrige" } },
        code: `const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado");
if (!porque || porque.length < 20) return fail("la justificación es débil ('" + (porque || "vacía") + "'): sin evidencia de un fallo concreto, la edición es capricho");
p.ediciones.push({ tipo, edicion, porque, estado: "propuesta", ts: new Date().toISOString() });
store.save(st);
return ok({ edicion_propuesta: p.ediciones.length, tipo, siguiente: "pasa guardrail_check antes de tocar el prompt" });`,
      },
      {
        name: "guardrail_check",
        desc: "Valida una edición propuesta contra las restricciones intocables y la intención del prompt.",
        params: { nombre: { t: "string", d: "Prompt" }, indice: { t: "number", d: "Índice de la edición propuesta (1-based)" } },
        code: `const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado");
const ed = p.ediciones[indice - 1];
if (!ed) return fail("edición no encontrada: hay " + p.ediciones.length + " propuestas");
if (ed.estado !== "propuesta") return fail("edición ya procesada: " + ed.estado);
const textoEdicion = ed.edicion.toLowerCase();
const intencionesPeligrosas = [
  { patron: /\\b(ignora|omite|salta|desactiva|pasa por alto)\\b.*\\b(restricciones|restriccion|restricci|reglas|regla|limites|límites|límite|limite|seguridad)/, tipo: "ELUSIÓN_DIRECTA", detalle: "la edición pide ignorar restricciones explícitamente" },
  { patron: /\\b(sin limites|sin límites|sin limite|sin límite|ilimitad\\w*|todo lo que puedas|máxima libertad|maxima libertad)/, tipo: "AMPLIACIÓN_DE_ALCANCE", detalle: "amplía el alcance permitido" },
  { patron: /\\b(no verifiques|no valides|confía en|confia en|asume que es seguro)/, tipo: "DESACTIVA_VERIFICACIÓN", detalle: "propone saltarse verificaciones" },
  { patron: /\\b(ignora|olvida)\\b.*\\b(contexto|instrucciones|previo|anterior)\\b/, tipo: "CORTE_DE_MEMORIA", detalle: "pide descartar instrucciones previas: patrón de prompt-injection clásico" }
];
const violaciones = intencionesPeligrosas.filter(v => v.patron.test(textoEdicion)).map(v => ({ tipo: v.tipo, detalle: v.detalle }));
const tocaRestriccion = p.restricciones.some(r => {
  const tokensR = String(r).toLowerCase().split(/\\s+/).filter(w => w.length > 3);
  const palabrasEdicion = new Set(textoEdicion.split(/[^a-z0-9áéíóúñ]+/));
  const solape = tokensR.filter(w => palabrasEdicion.has(w)).length;
  return solape >= 2 && /\\b(quitar|borrar|elimina|remove|recorta)\\b/.test(textoEdicion);
});
if (tocaRestriccion) violaciones.push({ tipo: "TOCA_RESTRICCIÓN", detalle: "la edición recorta texto de una restricción declarada intocable" });
ed.estado = violaciones.length ? "bloqueada" : "aprobada_por_guardrail";
if (violaciones.length) p.rechazadas++; 
store.save(st);
return ok({ edicion: indice, tipo: ed.tipo, estado: ed.estado, violaciones, siguiente: violaciones.length ? "NO adoptes esta edición: rediseñala respetando el guardrail" : "puede adoptarse TRAS pasar la puerta de evaluación (commit_eval)" });`,
      },
      {
        name: "commit_eval",
        desc: "Puerta de evaluación: adoptar una edición exige evidencia de mejora medida, no opinión.",
        params: { nombre: { t: "string", d: "Prompt" }, indice: { t: "number", d: "Edición aprobada" }, evidencia_mejora: { t: "string", d: "Medición de la mejora (A/B, score antes/después)" } },
        code: `const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado");
const ed = p.ediciones[indice - 1];
if (!ed) return fail("edición no encontrada");
if (ed.estado === "bloqueada") return fail("edición BLOQUEADA por guardrail: inadmisible");
if (ed.estado === "adoptada") return fail("ya adoptada");
if (ed.estado !== "aprobada_por_guardrail") return fail("pasa guardrail_check primero");
if (!evidencia_mejora || !/\\d/.test(evidencia_mejora)) return fail("la evidencia de mejora debe contener MEDIDAS (números): 'parece mejor' no es evidencia");
ed.estado = "adoptada";
ed.evidencia = evidencia_mejora;
ed.adoptada = new Date().toISOString();
p.adoptadas++;
store.save(st);
return ok({ edicion: indice, adoptada: true, ediciones_adoptadas: p.adoptadas, rechazadas: p.rechazadas, disciplina: "guardrail + medición = las dos llaves: la auto-mejora sin ambas es deriva" });`,
      },
    ],
  },
  {
    id: "behavior-diff",
    title: "Behavior Diff",
    tagline: "Diff de conducta: cómo cambió el uso de tools y patrones del agente entre dos períodos, con anomalías señaladas",
    category: "Auto-Mejora",
    pain: "Algo cambió en el agente: es más lento, usa otra tool, repite llamadas... pero como no hay diff de comportamiento, el cambio es una sospecha difusa hasta que rompe algo.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/behavior-diff/. Períodos con vectores de uso (tool→veces, ratios, latencia media); diff entre períodos con detección de tools nuevas/abandonadas y cambios de proporción.",
    tools: [
      {
        name: "record_behavior",
        desc: "Registra el snapshot de comportamiento de un período (uso de tools y métricas).",
        params: { periodo: { t: "string", d: "Etiqueta del período (ej: semana-37)" }, uso_tools: { t: "any", d: "Veces por tool {tool: veces}" }, latencia_media_ms: { t: "number", d: "Latencia media del período", opt: true }, errores: { t: "number", d: "Errores del período", opt: true, def: 0 } },
        code: `const st = store.load();
st.periodos = st.periodos || {};
if (st.periodos[periodo]) return fail("período ya registrado: " + periodo);
const uso = {};
Object.keys(uso_tools || {}).forEach(k => { const v = uso_tools[k]; if (typeof v === "number" && v >= 0) uso[k] = v; });
if (!Object.keys(uso).length) return fail("sin uso de tools registrado");
st.periodos[periodo] = { periodo, uso_tools: uso, latencia_media_ms: latencia_media_ms ?? null, errores, registrado: new Date().toISOString() };
store.save(st);
return ok({ periodo, tools_usadas: Object.keys(uso).length, llamadas_totales: Object.values(uso).reduce((a, b) => a + b, 0), siguiente: "con 2+ períodos, compara con diff_periods" });`,
      },
      {
        name: "diff_periods",
        desc: "Compara dos períodos: tools nuevas, abandonadas y cambios de proporción.",
        params: { periodo_a: { t: "string", d: "Período base" }, periodo_b: { t: "string", d: "Período a comparar" } },
        code: `const st = store.load();
const a = (st.periodos || {})[periodo_a];
const b = (st.periodos || {})[periodo_b];
if (!a) return fail("período no registrado: " + periodo_a);
if (!b) return fail("período no registrado: " + periodo_b);
const totalA = Object.values(a.uso_tools).reduce((x, y) => x + y, 0) || 1;
const totalB = Object.values(b.uso_tools).reduce((x, y) => x + y, 0) || 1;
const todas = [...new Set([...Object.keys(a.uso_tools), ...Object.keys(b.uso_tools)])];
const cambios = todas.map(t => {
  const va = a.uso_tools[t] || 0, vb = b.uso_tools[t] || 0;
  const pa = va / totalA, pb = vb / totalB;
  return { tool: t, antes: va, ahora: vb, share_antes: Number((pa * 100).toFixed(1)) + "%", share_ahora: Number((pb * 100).toFixed(1)) + "%", delta_share: Number(((pb - pa) * 100).toFixed(1)) + "pp", estado: va === 0 && vb > 0 ? "NUEVA" : vb === 0 && va > 0 ? "ABANDONADA" : Math.abs(pb - pa) > 0.08 ? "CAMBIO FUERTE" : "estable" };
}).sort((x, y) => Math.abs(parseFloat(y.delta_share)) - Math.abs(parseFloat(x.delta_share)));
const latencia = a.latencia_media_ms && b.latencia_media_ms ? { antes: Math.round(a.latencia_media_ms) + "ms", ahora: Math.round(b.latencia_media_ms) + "ms", delta: Number((((b.latencia_media_ms - a.latencia_media_ms) / a.latencia_media_ms) * 100).toFixed(0)) + "%" } : null;
return ok({ comparacion: periodo_a + " -> " + periodo_b, llamadas: { antes: totalA, ahora: totalB }, cambios, latencia, errores: { antes: a.errores, ahora: b.errores }, anomalias: cambios.filter(c => c.estado === "NUEVA" || c.estado === "ABANDONADA" || c.estado === "CAMBIO FUERTE").map(c => c.tool + ": " + c.estado), aviso: cambios.some(c => c.estado === "ABANDONADA") ? "hay tools ABANDONADAS: ¿la ruta mejor o se rompió el acceso? Distínguelo antes de celebrar" : null });`,
      },
      {
        name: "trend_report",
        desc: "Tendencia a lo largo de todos los períodos registrados.",
        params: {},
        code: `const st = store.load();
const periodos = __vals(st.periodos || {});
if (periodos.length < 3) return ok({ periodos: periodos.length, mensaje: "con menos de 3 períodos no hay tendencia" });
const ordenados = periodos.sort((a, b) => a.periodo.localeCompare(b.periodo));
const series = {};
ordenados.forEach(p => { Object.keys(p.uso_tools).forEach(t => { series[t] = series[t] || []; series[t].push(p.uso_tools[t]); }); });
const herramientas = Object.keys(series).map(t => {
  const s = series[t];
  const primera = s.slice(0, Math.ceil(s.length / 2));
  const segunda = s.slice(Math.floor(s.length / 2));
  const media1 = primera.reduce((a, b) => a + b, 0) / Math.max(primera.length, 1);
  const media2 = segunda.reduce((a, b) => a + b, 0) / Math.max(segunda.length, 1);
  const tendencia = media2 > media1 * 1.3 ? "AL ALZA" : media2 < media1 * 0.7 ? "A LA BAJA" : "estable";
  return { tool: t, serie: s, tendencia };
}).sort((a, b) => b.serie.reduce((x, y) => x + y, 0) - a.serie.reduce((x, y) => x + y, 0));
const latencias = ordenados.filter(p => p.latencia_media_ms).map(p => p.periodo + ": " + Math.round(p.latencia_media_ms) + "ms");
return ok({ periodos: ordenados.map(p => p.periodo), tools_en_tendencia: herramientas.slice(0, 10), latencia_por_periodo: latencias, foco: herramientas.filter(h => h.tendencia === "AL ALZA" && h.serie.reduce((a, b) => a + b, 0) > 20).map(h => h.tool + " crece: ¿por diseño o por bucle?") });`,
      },
    ],
  },
  {
    id: "capability-gap-scanner",
    title: "Capability Gap Scanner",
    tagline: "Lo que la tarea EXIGE vs lo que el agente TIENE: gaps de capacidad concretos antes de fallar en producción",
    category: "Auto-Mejora",
    pain: "El agente descubre que no puede leer PDFs... a mitad de la tarea, cuando ya gastó la mitad del contexto. Nadie compara las demandas de la tarea con el inventario real de capacidades ANTES de empezar.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/capability-gap-scanner/. Demandas declaradas de la tarea vs inventario de capacidades del agente; cobertura, gaps críticos y recomendaciones de adquisición (tool nueva, skill, humano).",
    tools: [
      {
        name: "declare_demands",
        desc: "Declara qué capacidades exige la tarea entrante.",
        params: { tarea: { t: "string", d: "Tarea a evaluar" }, demandas: { t: "array", d: "Capacidades requeridas {capacidad, criticidad: alta|media|baja}" } },
        code: `const st = store.load();
st.tareas = st.tareas || {};
if (st.tareas[tarea]) return fail("tarea ya evaluada: " + tarea);
const limpias = (demandas || []).filter(d => d && d.capacidad).map(d => ({ capacidad: String(d.capacidad).toLowerCase(), criticidad: ["alta", "media", "baja"].includes(d.criticidad) ? d.criticidad : "media" }));
if (!limpias.length) return fail("sin demandas declaradas");
st.tareas[tarea] = { tarea, demandas: limpias, evaluada: new Date().toISOString() };
store.save(st);
return ok({ tarea, demandas: limpias.length, criticas: limpias.filter(d => d.criticidad === "alta").length, siguiente: "registra tu inventario real y escanea" });`,
      },
      {
        name: "declare_inventory",
        desc: "Declara el inventario de capacidades que realmente tienes (tools, skills, accesos).",
        params: { capacidades: { t: "array", d: "Capacidades disponibles {capacidad, tipo: tool|skill|acceso|humano, nota?}" } },
        code: `const st = store.load();
const limpias = (capacidades || []).filter(c => c && c.capacidad).map(c => ({ capacidad: String(c.capacidad).toLowerCase(), tipo: String(c.tipo || "tool"), nota: String(c.nota || "") }));
if (!limpias.length) return fail("inventario vacío");
st.inventario = limpias;
store.save(st);
return ok({ inventario: limpias.length, por_tipo: limpias.reduce((acc, c) => { acc[c.tipo] = (acc[c.tipo] || 0) + 1; return acc; }, {}), nota: "mantenlo honesto: listar lo que NO tienes da gaps falsos de seguridad, omitir lo que tienes genera pañicos innecesarios" });`,
      },
      {
        name: "scan_gaps",
        desc: "Escanea los gaps: demandas sin cobertura, con severidad y recomendación.",
        params: { tarea: { t: "string", d: "Tarea a escanear" } },
        code: `const st = store.load();
const t = (st.tareas || {})[tarea];
if (!t) return fail("tarea no declarada: usa declare_demands");
const inv = new Set<string>((st.inventario || []).map((c: any) => String(c.capacidad)));
const sinonimos = { pdf: "leer pdf", excel: "hojas de cálculo", web: "navegar", buscar: "búsqueda", fetch: "web", http: "web", correo: "email", email: "correo", calculo: "matemática", mate: "matemática" };
const cubre = (demanda: any) => {
  if (inv.has(demanda)) return "directa";
  for (const [sinon, canon] of Object.entries(sinonimos)) if (demanda.includes(sinon) && inv.has(canon)) return "via sinónimo";
  for (const cap of inv) if (demanda.includes(cap) || cap.includes(demanda)) return "parcial";
  return null;
};
const evaluadas = t.demandas.map(d => {
  const c = cubre(d.capacidad);
  return { ...d, cobertura: c || "NINGUNA", estado: c ? "cubierta" + (c === "parcial" ? " (parcial)" : "") : "GAP" };
});
const gaps = evaluadas.filter(e => e.estado === "GAP");
const parciales = evaluadas.filter(e => e.cobertura === "parcial");
const criticosSin = gaps.filter(g => g.criticidad === "alta");
const cobertura = Number(((evaluadas.length - gaps.length) / evaluadas.length * 100).toFixed(0));
return ok({ tarea, cobertura_pct: cobertura + "%", gaps_totales: gaps.length, gaps_criticos: criticosSin.map(g => g.capacidad), evaluacion: evaluadas, veredicto: criticosSin.length ? "NO EMPIECES: hay " + criticosSin.length + " gaps CRÍTICOS (" + criticosSin.map(g => g.capacidad).join(", ") + "): adquiere la capacidad o negocia el alcance AHORA, no a mitad de tarea" : gaps.length ? "EMPIEZA CON PLAN B: los gaps (" + gaps.map(g => g.capacidad).join(", ") + ") son no-críticos: define el rodeo antes" : "cobertura completa: la tarea está dentro de tus capacidades", parciales_atencion: parciales.length ? parciales.map(p => p.capacidad + " (parcial: valida que el alcance real alcanza)") : [] });`,
      },
    ],
  },
  {
    id: "growth-plan",
    title: "Growth Plan",
    tagline: "Plan de práctica deliberada del agente: debilidades convertidas en ejercicios con progresión y revisión",
    category: "Auto-Mejora",
    pain: "El agente 'aprende' de sus errores en el sentido de que los vuelve a cometer distinto. Sin convertir debilidades en ejercicios con progresión, la experiencia se acumula como edad, no como habilidad.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/growth-plan/. Debilidades (de error-taxonomy/reflection-journal) convertidas en unidades de práctica con criterio de éxito; registro de práctica y revisión de progresión.",
    tools: [
      {
        name: "add_weakness",
        desc: "Añade una debilidad detectada (con origen trazable).",
        params: { debilidad: { t: "string", d: "La debilidad en una frase accionable" }, origen: { t: "string", d: "Dónde se detectó (familia de errores, reflexión, incidente)" }, frecuencia: { t: "number", d: "Cuántas veces ha pasado", opt: true, def: 1 } },
        code: `const st = store.load();
st.debilidades = st.debilidades || [];
const existe = st.debilidades.find(d => d.debilidad.toLowerCase().slice(0, 40) === debilidad.toLowerCase().slice(0, 40));
if (existe) { existe.frecuencia += frecuencia; store.save(st); return ok({ id: existe.id, debilidad: existe.debilidad, frecuencia_acumulada: existe.frecuencia, aviso: "debilidad recurrente: prioridad subida automáticamente" }); }
st.debilidades.push({ id: "deb_" + String(st.debilidades.length + 1).padStart(3, "0"), debilidad, origen, frecuencia, ejercicios: [], cerrada: false, ts: new Date().toISOString() });
store.save(st);
return ok({ id: "deb_" + String(st.debilidades.length).padStart(3, "0"), debilidad: debilidad.slice(0, 80), origen, siguiente: "diseña el ejercicio con plan_practice" });`,
      },
      {
        name: "plan_practice",
        desc: "Diseña una unidad de práctica deliberada para una debilidad.",
        params: { debilidad_id: { t: "string", d: "Id de la debilidad (deb_001)" }, ejercicio: { t: "string", d: "El ejercicio concreto y reproducible" }, criterio_exito: { t: "string", d: "Cómo se sabe que se superó (medible)" }, repeticiones_objetivo: { t: "number", d: "Éxitos consecutivos para cerrar", opt: true, def: 3 } },
        code: `const st = store.load();
const d = (st.debilidades || []).find(x => x.id === debilidad_id);
if (!d) return fail("debilidad no encontrada: " + debilidad_id + " (disponibles: " + (st.debilidades || []).filter(x => !x.cerrada).map(x => x.id).join(", ") + ")");
if (!criterio_exito.includes("/")) return fail("el criterio de éxito debe ser MEDIBLE (número/total, %, ms): '" + criterio_exito + "' es una impresión");
d.ejercicios.push({ ejercicio, criterio_exito, repeticiones_objetivo, exitos_consecutivos: 0, intentos: 0, historial: [] });
store.save(st);
return ok({ debilidad_id: d.id, debilidad: d.debilidad.slice(0, 60), ejercicio: ejercicio.slice(0, 80), criterio: criterio_exito, objetivo: repeticiones_objetivo + " éxitos consecutivos", diseño: "práctica DELIBERADA: apunta JUSTO a la debilidad (no a la tarea general) con criterio binario de éxito" });`,
      },
      {
        name: "log_practice",
        desc: "Registra un intento de práctica con su resultado contra el criterio.",
        params: { debilidad_id: { t: "string", d: "Debilidad" }, ejercicio_idx: { t: "number", d: "Índice del ejercicio (1-based)" }, exito: { t: "boolean", d: "¿Superó el criterio?" }, observacion: { t: "string", d: "Qué pasó exactamente", opt: true } },
        code: `const st = store.load();
const d = (st.debilidades || []).find(x => x.id === debilidad_id);
if (!d) return fail("debilidad no encontrada");
const e = d.ejercicios[ejercicio_idx - 1];
if (!e) return fail("ejercicio no encontrado: hay " + d.ejercicios.length);
e.intentos++;
if (exito) e.exitos_consecutivos++; else e.exitos_consecutivos = 0;
e.historial.push({ exito, observacion: observacion || "", ts: new Date().toISOString() });
let cerrada = false;
if (e.exitos_consecutivos >= e.repeticiones_objetivo && !d.cerrada) {
  d.cerrada = true;
  d.cerrada_ts = new Date().toISOString();
  cerrada = true;
}
store.save(st);
return ok({ debilidad_id: d.id, debilidad: d.debilidad.slice(0, 60), intentos: e.intentos, exitos_consecutivos: e.exitos_consecutivos, objetivo: e.repeticiones_objetivo, cerrada: d.cerrada, estado: cerrada ? "DEBILIDAD CERRADA: " + e.repeticiones_objetivo + " éxitos consecutivos alcanzados" : e.exitos_consecutivos === 0 && e.intentos > 3 ? "ESTANCADA: 3+ intentos sin éxito: el ejercicio es demasiado difícil o el criterio está mal puesto: rediséñalo" : "en progresión" });`,
      },
      {
        name: "progress_review",
        desc: "Revisión global del plan de crecimiento: qué se cerró, qué se estancó, qué se ignora.",
        params: {},
        code: `const st = store.load();
const debs = st.debilidades || [];
if (!debs.length) return ok({ debilidades: 0, mensaje: "sin debilidades registradas: ¿cero defectos o cero honestidad?" });
const cerradas = debs.filter(d => d.cerrada);
const activas = debs.filter(d => !d.cerrada);
const estancadas = activas.filter(d => d.ejercicios.some(e => e.intentos > 3 && e.exitos_consecutivos === 0));
const sinEjercicio = activas.filter(d => !d.ejercicios.length);
const prioridad = activas.slice().sort((a, b) => b.frecuencia - a.frecuencia).slice(0, 3);
return ok({ debilidades: debs.length, cerradas: cerradas.length, activas: activas.length, estancadas: estancadas.map(d => d.id + " " + d.debilidad.slice(0, 50)), sin_plan_de_practica: sinEjercicio.map(d => d.id + " " + d.debilidad.slice(0, 50)), top_prioridad_por_frecuencia: prioridad.map(d => ({ id: d.id, debilidad: d.debilidad.slice(0, 60), veces: d.frecuencia })), lectura: sinEjercicio.length > activas.length / 2 ? "la mayoría de debilidades no tienen ejercicio: reconocer sin entrenar es llorar sin entrenar" : cerradas.length > activas.length ? "más cerradas que abiertas: el plan funciona" : "progresión razonable: ataca las estancadas" });`,
      },
    ],
  },
]

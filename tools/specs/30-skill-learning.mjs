// ═══ CATEGORÍA: Dolores FUTUROS · Aprendizaje de Habilidades ═══
// Evidencia: los agentes repiten los mismos errores en cada sesión porque
// las lecciones no se capturan como activos reutilizables. "Sleep-time"
// y skill acquisition como frontera 2026 de los agentes autónomos.
export default [
  {
    id: "postmortem-engine",
    title: "Postmortem Engine",
    tagline: "Postmortems estructurados que se convierten en lecciones: convierte cada fallo en activo permanente",
    category: "Aprendizaje de Habilidades",
    pain: "Cada fallo del agente genera conversación pero no activo: la lección muere con la sesión y el mismo error vuelve la semana siguiente. Nadie escribe el postmortem porque 'no hay tiempo'.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/postmortem-engine/. Postmortems 5-secciones (qué pasó, causa raíz, impacto, qué lo evitaba, acción preventiva) con verificación de completitud y tasa de conversión a lección.",
    tools: [
      {
        name: "start_postmortem",
        desc: "Abre un postmortem por un incidente con el borrador de las 5 secciones obligatorias.",
        params: { titulo: { t: "string", d: "Título del incidente" }, severidad: { t: "enum", d: "Severidad", values: ["baja", "media", "alta", "critica"] }, que_paso: { t: "string", d: "Narrativa factual de lo ocurrido" } },
        code: `const st = store.load();
st.pms = st.pms || [];
const pm = {
  id: "pm_" + Date.now().toString(36), titulo, severidad,
  secciones: { que_paso, causa_raiz: null, impacto: null, lo_evitaba: null, accion_preventiva: null },
  convertido_leccion: null,
  ts: new Date().toISOString(),
};
st.pms.push(pm);
store.save(st);
return ok({ postmortem_id: pm.id, secciones_pendientes: 4, recordatorio: "un postmortem sin causa raíz es un relato, no una lección" });`,
      },
      {
        name: "fill_section",
        desc: "Completa una sección del postmortem (causa_raiz, impacto, lo_evitaba, accion_preventiva).",
        params: { postmortem_id: { t: "string", d: "ID del postmortem" }, seccion: { t: "enum", d: "Sección a completar", values: ["causa_raiz", "impacto", "lo_evitaba", "accion_preventiva"] }, contenido: { t: "string", d: "Contenido de la sección" } },
        code: `const st = store.load();
const pm = (st.pms || []).find(x => x.id === postmortem_id);
if (!pm) return fail("postmortem no encontrado");
if (seccion === "causa_raiz" && /(?:falló|fallo|error|culpa del sistema|no sé|no se)/i.test(contenido) && contenido.length < 60) {
  return fail("causa raíz vaga: profundiza con 5-whys (¿por qué falló? ¿y por qué era así?)");
}
pm.secciones[seccion] = contenido;
store.save(st);
const pendientes = Object.entries(pm.secciones).filter(([, v]) => !v).map(([k]) => k);
return ok({ postmortem: pm.id, completadas: 5 - pendientes.length, pendientes });`,
      },
      {
        name: "review_postmortem",
        desc: "Audita la calidad del postmortem: completitud, especificidad y accionabilidad de la causa raíz.",
        params: { postmortem_id: { t: "string", d: "ID del postmortem" } },
        code: `const st = store.load();
const pm = (st.pms || []).find(x => x.id === postmortem_id);
if (!pm) return fail("postmortem no encontrado");
const s = pm.secciones;
const problemas = [];
for (const [k, v] of Object.entries(s)) if (!v) problemas.push("falta sección " + k);
if (s.causa_raiz && s.causa_raiz.length < 40) problemas.push("causa raíz demasiado corta");
if (s.accion_preventiva && !/\\b(verificar|añadir|cambiar|añadir|registrar|check|test|alerta|umbral)\\b/i.test(s.accion_preventiva)) problemas.push("acción preventiva no es verificable: usa verbos accionables");
const score = Math.max(0, 100 - problemas.length * 20);
return ok({
  score_calidad: score + "/100",
  problemas,
  veredicto: score === 100 ? "postmortem de calidad: conviértelo en lección" : "incompleto o blando: complétalo antes de archivar",
});`,
      },
      {
        name: "convert_to_lesson",
        desc: "Convierte el postmortem en lección (formato situación→regla) lista para lesson-library.",
        params: { postmortem_id: { t: "string", d: "ID del postmortem" }, aplicable_cuando: { t: "string", d: "Situación futura en que aplica la lección" } },
        code: `const st = store.load();
const pm = (st.pms || []).find(x => x.id === postmortem_id);
if (!pm) return fail("postmortem no encontrado");
const pendientes = Object.entries(pm.secciones).filter(([, v]) => !v).map(([k]) => k);
if (pendientes.length) return fail("postmortem incompleto (" + pendientes.join(", ") + "): complétalo primero");
pm.convertido_leccion = {
  situacion: aplicable_cuando || pm.secciones.que_paso.slice(0, 120),
  regla: "Cuando " + (aplicable_cuando || "esta situación") + ", entonces: " + pm.secciones.accion_preventiva,
  causa_raiz: pm.secciones.causa_raiz,
  origen: pm.id,
  ts: new Date().toISOString(),
};
store.save(st);
return ok({ leccion_generada: pm.convertido_leccion.regla, siguiente: "regístrala en lesson-library para que la encuentre el agente" });`,
      },
      {
        name: "postmortem_stats",
        desc: "Estadísticas: incidentes documentados, tasa de conversión a lección y severidad dominante.",
        params: {},
        code: `const st = store.load();
const pms = st.pms || [];
if (!pms.length) return ok({ postmortems: 0 });
const convertidos = pms.filter(p => p.convertido_leccion).length;
const porSev = {};
for (const p of pms) porSev[p.severidad] = (porSev[p.severidad] || 0) + 1;
return ok({
  postmortems: pms.length,
  convertidos_a_leccion: convertidos,
  tasa_conversion: Number((convertidos / pms.length).toFixed(2)),
  por_severidad: porSev,
  sin_convertir: pms.filter(p => !p.convertido_leccion).map(p => p.titulo),
  veredicto: convertidos / pms.length < 0.5 ? "más de la mitad de los fallos no dejó lección: conocimiento que se evapora" : "buen ratio de aprendizaje",
});`,
      },
    ],
  },
  {
    id: "lesson-library",
    title: "Lesson Library",
    tagline: "Biblioteca de lecciones recuperables por situación: el agente recuerda lo que ya aprendió",
    category: "Aprendizaje de Habilidades",
    pain: "El conocimiento aprendido ('con ese proveedor, valida el JSON antes de parsear') no sobrevive la sesión: cada instancia del agente vuelve a cometer el error porque no hay biblioteca consultable.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/lesson-library/. Lecciones situación→regla con etiquetas y contador de reutilización; búsqueda lexical por situación y recordatorio proactivo.",
    tools: [
      {
        name: "add_lesson",
        desc: "Añade una lección: situación en que aplica, la regla y etiquetas para recuperación.",
        params: { situacion: { t: "string", d: "Cuándo aplica (situación observable)" }, regla: { t: "string", d: "Qué hacer (accionable)" }, etiquetas: { t: "array", d: "Etiquetas temáticas", opt: true, def: [] }, origen: { t: "string", d: "De dónde viene (postmortem, humano, manual)", opt: true, def: "manual" } },
        code: `const st = store.load();
st.lecciones = st.lecciones || [];
if (st.lecciones.some(l => l.regla === regla)) return fail("regla ya registrada");
st.lecciones.push({ id: "ls_" + Date.now().toString(36), situacion, regla, etiquetas: etiquetas || [], origen, usada: 0, creada: new Date().toISOString() });
store.save(st);
return ok({ leccion_id: st.lecciones.at(-1).id, total: st.lecciones.length });`,
      },
      {
        name: "recall_lessons",
        desc: "Recupera lecciones relevantes para la situación actual (match lexical + etiquetas) con score.",
        params: { situacion_actual: { t: "string", d: "Qué está a punto de hacer el agente" }, max: { t: "number", d: "Máximo a devolver", opt: true, def: 5 } },
        code: `const st = store.load();
const lecciones = st.lecciones || [];
if (!lecciones.length) return ok({ lecciones: 0, sugerencia: "añade lecciones con add_lesson" });
const tokens = (s) => new Set(String(s).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
const act = tokens(situacion_actual);
const scored = lecciones.map(l => {
  const sit = tokens(l.situacion);
  const inter = [...sit].filter(w => act.has(w)).length;
  const tagHit = (l.etiquetas || []).filter(t => situacion_actual.toLowerCase().includes(String(t).toLowerCase())).length;
  const score = inter / Math.max(sit.size, 1) + tagHit * 0.3;
  return { id: l.id, situacion: l.situacion, regla: l.regla, score: Number(score.toFixed(2)) };
}).filter(x => x.score > 0.15).sort((a, b) => b.score - a.score);
const top = scored.slice(0, Math.max(1, Math.min(max, 10)));
if (top.length) {
  for (const t of top) { const l = st.lecciones.find(x => x.id === t.id); l.usada++; }
  store.save(st);
}
return ok({
  relevantes: top.length,
  lecciones: top,
  aviso: top.length ? "aplica estas reglas ANTES de actuar en esta situación" : "sin lecciones previas para esta situación",
});`,
      },
      {
        name: "most_used",
        desc: "Lecciones más reutilizadas: cuáles están demostrando valor real.",
        params: {},
        code: `const st = store.load();
const ls = st.lecciones || [];
if (!ls.length) return ok({ lecciones: 0 });
const top = [...ls].sort((a, b) => b.usada - a.usada).slice(0, 10).map(l => ({ regla: l.regla.slice(0, 90), usada: l.usada, etiquetas: l.etiquetas }));
return ok({ total: ls.length, nunca_usadas: ls.filter(l => l.usada === 0).length, top: top.filter(t => t.usada > 0) });`,
      },
      {
        name: "retire_lesson",
        desc: "Retira una lección obsoleta (ya no aplica porque cambió el entorno), con motivo.",
        params: { leccion_id: { t: "string", d: "ID de la lección" }, motivo: { t: "string", d: "Por qué ya no aplica" } },
        code: `const st = store.load();
const l = (st.lecciones || []).find(x => x.id === leccion_id);
if (!l) return fail("lección no encontrada");
l.retirada = { motivo, ts: new Date().toISOString() };
store.save(st);
return ok({ retirada: true, regla: l.regla.slice(0, 80) });`,
      },
      {
        name: "library_stats",
        desc: "Salud de la biblioteca: tamaño, tasa de uso, cobertura por etiqueta y antigüedad.",
        params: {},
        code: `const st = store.load();
const ls = (st.lecciones || []).filter(l => !l.retirada);
if (!ls.length) return ok({ activas: 0 });
const porEtiqueta = {};
for (const l of ls) for (const t of l.etiquetas || []) porEtiqueta[t] = (porEtiqueta[t] || 0) + 1;
return ok({
  activas: ls.length,
  retiradas: (st.lecciones || []).length - ls.length,
  tasa_uso_media: Number((ls.reduce((s, l) => s + l.usada, 0) / ls.length).toFixed(1)),
  por_etiqueta: porEtiqueta,
  mas_antigua_dias: Number(((Date.now() - new Date(ls.reduce((a, b) => a.creada < b.creada ? a : b).creada).getTime()) / 86400000).toFixed(0)),
  consejo: ls.filter(l => l.usada === 0).length > ls.length / 2 ? "media biblioteca nunca se usa: revisa la situación/redacción (recall falla)" : "biblioteca viva",
});`,
      },
    ],
  },
  {
    id: "mistake-patterns",
    title: "Mistake Patterns",
    tagline: "Detecta patrones recurrentes de error: la tercera vez que fallas igual ya no es mala suerte",
    category: "Aprendizaje de Habilidades",
    pain: "Los errores se registran individualmente y nunca se cruzan: el agente falla igual 5 veces en contextos distintos y nadie conecta los puntos porque cada incidente parece distinto.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/mistake-patterns/. Registra errores {contexto, descripción}; clustering lexical agrupa errores similares y detecta recurrencia con umbral configurable.",
    tools: [
      {
        name: "log_mistake",
        desc: "Registra un error cometido (contexto + descripción) para el análisis de patrones.",
        params: { contexto: { t: "string", d: "Qué tarea/situación" }, descripcion: { t: "string", d: "Qué se hizo mal exactamente" }, costo: { t: "string", d: "Costo del error (tokens, tiempo, daño)", opt: true } },
        code: `const st = store.load();
st.errores = st.errores || [];
st.errores.push({ n: st.errores.length + 1, contexto, descripcion, costo: costo || null, ts: new Date().toISOString() });
store.save(st);
return ok({ error_n: st.errores.length });`,
      },
      {
        name: "detect_patterns",
        desc: "Agrupa errores similares (clustering lexical) y devuelve patrones con recurrencia y daño.",
        params: { umbral_similitud: { t: "number", d: "Similitud Jaccard para agrupar (0-1)", opt: true, def: 0.35 } },
        code: `const st = store.load();
const errores = st.errores || [];
if (errores.length < 3) return ok({ errores: errores.length, patrones: "insuficiente (mínimo 3)" });
const tokens = (s) => new Set(String(s).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
const conTokens = errores.map(e => ({ ...e, tk: tokens(e.descripcion + " " + e.contexto) }));
const clusters = [];
for (const e of conTokens) {
  let puesto = false;
  for (const c of clusters) {
    const rep = c[0];
    const inter = [...rep.tk].filter(w => e.tk.has(w)).length;
    const union = new Set([...rep.tk, ...e.tk]).size || 1;
    if (inter / union >= umbral_similitud) { c.push(e); puesto = true; break; }
  }
  if (!puesto) clusters.push([e]);
}
const patrones = clusters.filter(c => c.length >= 2).map(c => ({
  recurrencia: c.length,
  descripcion_representativa: c[0].descripcion.slice(0, 100),
  contextos_afectados: [...new Set(c.map(e => e.contexto.slice(0, 50)))],
  primera_vez: c[0].ts, ultima_vez: c[c.length - 1].ts,
  tokens_comunes: [...c[0].tk].filter(w => c.every(e => e.tk.has(w))).slice(0, 8),
})).sort((a, b) => b.recurrencia - a.recurrencia);
return ok({
  errores_totales: errores.length,
  clusters: clusters.length,
  patrones_recurrentes: patrones.length,
  patrones: patrones.slice(0, 6),
  veredicto: patrones.length ? "HAY patrón recurrente: esto es sistémico, escribe una lección (lesson-library) y una acción preventiva" : "errores dispersos: aún no hay patrón",
});`,
      },
      {
        name: "same_mistake_check",
        desc: "Antes de actuar: ¿ya fallé haciendo exactamente esto? Devuelve el historial similar.",
        params: { accion_prevista: { t: "string", d: "Lo que estás a punto de hacer" } },
        code: `const st = store.load();
const errores = st.errores || [];
if (!errores.length) return ok({ historial: 0, aviso: "primer error posible: sin historial" });
const tokens = (s) => new Set(String(s).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").split(/\\W+/).filter(w => w.length > 3).map(w => w.endsWith("lo") && w.length > 5 ? w.slice(0, -2) : w));
const act = tokens(accion_prevista);
const similares = errores.map(e => {
  const et = tokens(e.descripcion + " " + e.contexto);
  const inter = [...et].filter(w => act.has(w)).length;
  return { n: e.n, descripcion: e.descripcion.slice(0, 90), similitud: Number((inter / Math.max(et.size, 1)).toFixed(2)), costo: e.costo };
}).filter(x => x.similitud >= 0.3).sort((a, b) => b.similitud - a.similitud);
return ok({
  fallos_previos_similares: similares.length,
  historial: similares.slice(0, 5),
  freno: similares.length >= 2 ? "ya fallaste 2+ veces con esto: consulta lesson-library y cambia el enfoque ANTES de reintentar" : similares.length === 1 ? "fallaste algo parecido una vez: aplica la corrección conocida" : "sin precedentes cercanos",
});`,
      },
      {
        name: "mistake_stats",
        desc: "Estadísticas de errores: frecuencia temporal, contexto más propenso y mejora (errores/semana).",
        params: {},
        code: `const st = store.load();
const errores = st.errores || [];
if (!errores.length) return ok({ errores: 0 });
const porSemana = {};
for (const e of errores) {
  const d = new Date(e.ts);
  const lunes = new Date(d); lunes.setDate(d.getDate() - d.getDay());
  const k = lunes.toISOString().slice(0, 10);
  porSemana[k] = (porSemana[k] || 0) + 1;
}
const semanas = Object.entries(porSemana).sort(([a], [b]) => a < b ? -1 : 1);
const porContexto = {};
for (const e of errores) { const c = e.contexto.split(/\\s+/).slice(0, 2).join(" "); porContexto[c] = (porContexto[c] || 0) + 1; }
const n = semanas.length;
return ok({
  errores: errores.length,
  por_semana: semanas.slice(-8),
  tendencia: n >= 2 ? (semanas[n - 1][1] > semanas[n - 2][1] ? "empeorando" : "mejorando") : "insuficiente",
  contextos_mas_propensos: Object.entries(porContexto).sort((a, b) => b[1] - a[1]).slice(0, 5),
});`,
      },
    ],
  },
  {
    id: "skill-forge",
    title: "Skill Forge",
    tagline: "Convierte lecciones repetidas en skills/playbooks versionados: conocimiento procedural reutilizable",
    category: "Aprendizaje de Habilidades",
    pain: "Las lecciones sueltas no bastan para tareas complejas: el agente re-deriva el mismo procedimiento multi-paso cada vez porque nunca se empaquetó como skill con pasos, precondiciones y trampas.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/skill-forge/. Skills = pasos ordenados + precondiciones + trampas conocidas + criterio de éxito; versionado y contador de uso con tasa de éxito.",
    tools: [
      {
        name: "forge_skill",
        desc: "Crea una skill a partir de un procedimiento: pasos, precondiciones, trampas y criterio de éxito.",
        params: { nombre: { t: "string", d: "Nombre de la skill" }, proposito: { t: "string", d: "Para qué sirve" }, pasos: { t: "array", d: "Pasos en orden" }, precondiciones: { t: "array", d: "Qué debe ser cierto antes de empezar", opt: true, def: [] }, trampas: { t: "array", d: "Errores conocidos que evitar", opt: true, def: [] }, criterio_exito: { t: "string", d: "Cómo saber que funcionó" } },
        code: `const st = store.load();
st.skills = st.skills || {};
if (st.skills[nombre]) return fail("skill existente: crea versión nueva o edítala");
if (!Array.isArray(pasos) || pasos.length < 2) return fail("una skill con <2 pasos es una nota, no un procedimiento");
st.skills[nombre] = {
  nombre, proposito,
  pasos: pasos.map((p, i) => ({ n: i + 1, paso: String(p) })),
  precondiciones: (precondiciones || []).map(String),
  trampas: (trampas || []).map(String),
  criterio_exito,
  version: 1, usos: 0, exitos: 0, creado: new Date().toISOString(),
};
store.save(st);
return ok({ skill: nombre, version: 1, pasos: pasos.length, trampas: (trampas || []).length });`,
      },
      {
        name: "get_skill",
        desc: "Recupera la skill completa para ejecutarla (con checklist de precondiciones).",
        params: { nombre: { t: "string", d: "Nombre de la skill" } },
        code: `const st = store.load();
const s = (st.skills || {})[nombre];
if (!s) return fail("skill no encontrada: " + nombre);
s.usos++;
store.save(st);
return ok({
  ...s,
  checklist_ejecucion: [
    ...s.precondiciones.map(p => "PRE: verifica " + p),
    ...s.pasos.map(p => "PASO " + p.n + ": " + p.paso),
    ...(s.trampas.length ? ["CUIDADO: " + s.trampas.join(" | ")] : []),
    "FIN: confirma criterio de éxito: " + s.criterio_exito,
  ],
  tasa_exito_historica: s.usos > 1 ? Number((s.exitos / (s.usos - 1)).toFixed(2)) : null,
});`,
      },
      {
        name: "report_outcome",
        desc: "Registra el resultado de usar la skill (éxito o fallo con paso del fallo) para su refinamiento.",
        params: { nombre: { t: "string", d: "Skill usada" }, exito: { t: "boolean", d: "¿Funcionó?" }, fallo_en_paso: { t: "number", d: "Si falló: número de paso", opt: true }, nota: { t: "string", d: "Contexto del resultado", opt: true } },
        code: `const st = store.load();
const s = (st.skills || {})[nombre];
if (!s) return fail("skill no encontrada");
if (exito) s.exitos++;
s.historial = s.historial || [];
s.historial.push({ exito, fallo_en_paso: fallo_en_paso || null, nota: nota || null, ts: new Date().toISOString() });
if (s.historial.length > 100) s.historial = s.historial.slice(-60);
store.save(st);
const usosEfectivos = Math.max(s.usos - 1, 1);
const tasa = Number((s.exitos / usosEfectivos).toFixed(2));
return ok({
  skill: nombre, exito,
  tasa_exito: tasa,
  paso_mas_fallido: (() => { const f = {}; for (const h of s.historial || []) if (h.fallo_en_paso) f[h.fallo_en_paso] = (f[h.fallo_en_paso] || 0) + 1; const e = Object.entries(f).sort((a, b) => b[1] - a[1])[0]; return e ? { paso: Number(e[0]), fallos: e[1] } : null; })(),
  aviso: tasa < 0.6 && s.usos > 5 ? "tasa de éxito <60% con 5+ usos: refactoriza el paso débil o la trampa no cubierta" : null,
});`,
      },
      {
        name: "refine_skill",
        desc: "Refina una skill: añade paso, trampa o ajusta criterio — crea versión nueva con historial de cambios.",
        params: { nombre: { t: "string", d: "Skill a refinar" }, pasos_extra: { t: "array", d: "Pasos a añadir al final", opt: true }, trampas_extra: { t: "array", d: "Trampas nuevas descubiertas", opt: true }, criterio_exito: { t: "string", d: "Criterio actualizado", opt: true }, motivo: { t: "string", d: "Qué fallo motivó el refinamiento" } },
        code: `const st = store.load();
const s = (st.skills || {})[nombre];
if (!s) return fail("skill no encontrada");
if (!motivo) return fail("todo refinamiento documenta su motivo");
let n = s.pasos.length;
for (const p of (pasos_extra || [])) { n++; s.pasos.push({ n, paso: String(p) }); }
s.trampas.push(...(trampas_extra || []).map(String));
if (criterio_exito) s.criterio_exito = criterio_exito;
s.version++;
s.changes = s.changes || [];
s.changes.push({ version: s.version, motivo, ts: new Date().toISOString() });
store.save(st);
return ok({ skill: nombre, version: s.version, pasos: s.pasos.length, trampas: s.trampas.length });`,
      },
      {
        name: "skill_catalog",
        desc: "Catálogo de skills con madurez (tasa de éxito y usos): qué está listo para delegar.",
        params: {},
        code: `const st = store.load();
const skills = Object.values(st.skills || {});
if (!skills.length) return ok({ skills: 0, sugerencia: "forja la primera skill con forge_skill" });
return ok({
  skills: skills.map(s => ({
    nombre: s.nombre, proposito: s.proposito.slice(0, 60), version: s.version,
    pasos: s.pasos.length, usos: s.usos,
    madurez: s.usos >= 5 && s.exitos / Math.max(s.usos - 1, 1) >= 0.8 ? "producción" : s.usos >= 2 ? "en prueba" : "sin validar",
  })).sort((a, b) => b.usos - a.usos),
});`,
      },
    ],
  },
  {
    id: "competency-tracker",
    title: "Competency Tracker",
    tagline: "Matriz de competencias del agente: en qué es fiable, en qué necesita supervisión humana",
    category: "Aprendizaje de Habilidades",
    pain: "No se sabe en qué es bueno el agente: se le delega tareas donde falla sistemáticamente y se le supervisa tareas que ya domina. Sin matriz de competencias, la delegación es a ciegas.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/competency-tracker/. Competencias con evidencia de éxito/fallo acumulada; nivel derivado (novato→competente→experto) y recomendación de supervisión por área.",
    tools: [
      {
        name: "define_competency",
        desc: "Define una competencia rastreable (área, descripción, cómo se mide).",
        params: { nombre: { t: "string", d: "Nombre de la competencia" }, area: { t: "string", d: "Área (datos, código, redacción, análisis...)" }, como_se_mide: { t: "string", d: "Evidencia de éxito (qué cuenta como acierto)" } },
        code: `const st = store.load();
st.competencias = st.competencias || {};
if (st.competencias[nombre]) return fail("competencia existente");
st.competencias[nombre] = { nombre, area, como_se_mide, exitos: 0, fallos: 0, historial: [], creado: new Date().toISOString() };
store.save(st);
return ok({ competencia: nombre, area });`,
      },
      {
        name: "record_outcome",
        desc: "Registra un resultado (éxito/fallo) de la competencia en una tarea concreta.",
        params: { nombre: { t: "string", d: "Competencia" }, exito: { t: "boolean", d: "¿La tarea salió bien?" }, tarea: { t: "string", d: "Tarea concreta", opt: true } },
        code: `const st = store.load();
const c = (st.competencias || {})[nombre];
if (!c) return fail("competencia no encontrada");
if (exito) c.exitos++; else c.fallos++;
c.historial.push({ exito, tarea: tarea || null, ts: new Date().toISOString() });
store.save(st);
const total = c.exitos + c.fallos;
return ok({ competencia: nombre, exitos: c.exitos, fallos: c.fallos, tasa: Number((c.exitos / total).toFixed(2)) });`,
      },
      {
        name: "competency_matrix",
        desc: "Matriz completa: nivel por competencia (novato/competente/experto) y qué necesita supervisión.",
        params: {},
        code: `const st = store.load();
const cs = Object.values(st.competencias || {});
if (!cs.length) return ok({ competencias: 0, sugerencia: "define competencias con define_competency" });
const filas = cs.map(c => {
  const total = c.exitos + c.fallos;
  const tasa = total ? c.exitos / total : null;
  let nivel = "sin datos";
  if (total >= 10 && tasa >= 0.9) nivel = "experto (delegable sin supervisión)";
  else if (total >= 5 && tasa >= 0.75) nivel = "competente (supervisión ligera)";
  else if (total >= 3) nivel = "aprendiz (revisar salida siempre)";
  else if (total > 0) nivel = "novato (datos insuficientes)";
  return { competencia: c.nombre, area: c.area, exitos: c.exitos, fallos: c.fallos, tasa: tasa === null ? null : Number(tasa.toFixed(2)), nivel };
});
return ok({
  competencias: filas.length,
  matriz: filas.sort((a, b) => (b.tasa ?? -1) - (a.tasa ?? -1)),
  delegables_sin_supervision: filas.filter(f => f.nivel.startsWith("experto")).map(f => f.competencia),
  prohibido_delegar_solo: filas.filter(f => f.nivel.startsWith("aprendiz") || (f.tasa !== null && f.tasa < 0.5)).map(f => f.competencia),
});`,
      },
      {
        name: "learning_progress",
        desc: "Progreso de aprendizaje por competencia: ¿la tasa de éxito mejora con la práctica?",
        params: { nombre: { t: "string", d: "Competencia" } },
        code: `const st = store.load();
const c = (st.competencias || {})[nombre];
if (!c) return fail("competencia no encontrada");
const h = c.historial || [];
if (h.length < 6) return ok({ competencia: nombre, datos: h.length, progreso: "insuficiente (mínimo 6 tareas)" });
const mitad = Math.floor(h.length / 2);
const tasaPrimera = h.slice(0, mitad).filter(x => x.exito).length / mitad;
const tasaSegunda = h.slice(mitad).filter(x => x.exito).length / (h.length - mitad);
return ok({
  competencia: nombre, tareas: h.length,
  tasa_primeras: Number(tasaPrimera.toFixed(2)),
  tasa_ultimas: Number(tasaSegunda.toFixed(2)),
  mejora: Number((tasaSegunda - tasaPrimera).toFixed(2)),
  veredicto: tasaSegunda - tasaPrimera > 0.15 ? "aprendiendo: la práctica está funcionando" : tasaSegunda - tasaPrimera < -0.1 ? "degradando: algo cambió (modelo, datos o contexto)" : "meseta: para subir de nivel necesita feedback explícito, no más práctica",
});`,
      },
    ],
  },
];

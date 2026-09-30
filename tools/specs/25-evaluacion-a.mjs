// ═══ CATEGORÍA: Dolores FUTUROS · Evaluación Continua (A) ═══
// Evidencia: la observabilidad/eval de agentes en 2026 es SaaS cloud-only
// (Langfuse, Braintrust, Helicone, Galileo, Maxim, Confident AI, Vellum):
// no existe como primitiva LOCAL. Gap: eval-as-code ejecutable por el propio
// agente (golden sets, regresión de comportamiento, A/B de prompts).
export default [
  {
    id: "golden-set",
    title: "Golden Set",
    tagline: "Conjuntos de casos dorados con scoring: el estándar contra el que se mide cada cambio del agente",
    category: "Evaluación Continua",
    pain: "Cada cambio (prompt, modelo, tool) se valida 'a ojo' con 2-3 ejemplos que salieron bien: no hay golden set con expected outputs, así que las regresiones se detectan en producción.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/golden-set/. Suites de casos {input, expected, criterio} con métricas de match (exacto, contiene, semántico-lexical, numérico con tolerancia) y puntuación por suite y por categoría.",
    tools: [
      {
        name: "create_suite",
        desc: "Crea una suite de evaluación con nombre y descripción del criterio global de calidad.",
        params: { nombre: { t: "string", d: "Nombre de la suite" }, descripcion: { t: "string", d: "Qué mide esta suite" } },
        code: `const st = store.load();
st.suites = st.suites || {};
if (st.suites[nombre]) return fail("suite existente: usa add_case o elimínala");
st.suites[nombre] = { nombre, descripcion, casos: [], corridas: [], creada: new Date().toISOString() };
store.save(st);
return ok({ suite: nombre, vacia: true, siguiente: "añade casos con add_case" });`,
      },
      {
        name: "add_case",
        desc: "Añade un caso dorado: input, salida esperada, método de match y categoría.",
        params: { suite: { t: "string", d: "Nombre de la suite" }, input: { t: "string", d: "Entrada del caso" }, expected: { t: "string", d: "Salida esperada (dorado)" }, metodo: { t: "enum", d: "Método de match", values: ["exacto", "contiene", "semantico", "numerico"], opt: true, def: "contiene" }, categoria: { t: "string", d: "Categoría (ej: edge-case, happy-path)", opt: true, def: "general" }, tolerancia: { t: "number", d: "Solo numerico: tolerancia +/-", opt: true, def: 0.01 } },
        code: `const st = store.load();
const s = (st.suites || {})[suite];
if (!s) return fail("suite no encontrada: créala con create_suite");
s.casos.push({ n: s.casos.length + 1, input, expected, metodo, categoria, tolerancia: tolerancia ?? 0.01 });
store.save(st);
return ok({ suite, caso_n: s.casos.length, metodo, categoria });`,
      },
      {
        name: "run_suite",
        desc: "Corre la suite contra las salidas actuales del agente (lista de outputs en el mismo orden) y puntúa.",
        params: { suite: { t: "string", d: "Nombre de la suite" }, outputs: { t: "array", d: "Salidas obtenidas (mismo orden que los casos)" } },
        code: `const st = store.load();
const s = (st.suites || {})[suite];
if (!s) return fail("suite no encontrada");
if (!s.casos.length) return fail("suite vacía: añade casos primero");
const outs = outputs || [];
if (outs.length !== s.casos.length) return fail("esperaba " + s.casos.length + " outputs, recibí " + outs.length);
const norm = (x) => new Set(String(x).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
function score(caso, out) {
  const obtenido = String(out ?? "");
  const esperado = String(caso.expected);
  switch (caso.metodo) {
    case "exacto": return obtenido.trim() === esperado.trim() ? 1 : 0;
    case "contiene": return obtenido.toLowerCase().includes(esperado.toLowerCase().trim()) ? 1 : 0;
    case "numerico": {
      const a = parseFloat(obtenido.replace(/[^0-9.\\-]/g, ""));
      const b = parseFloat(esperado.replace(/[^0-9.\\-]/g, ""));
      if (isNaN(a) || isNaN(b)) return 0;
      return Math.abs(a - b) <= (caso.tolerancia ?? 0.01) * Math.max(1, Math.abs(b)) ? 1 : 0;
    }
    case "semantico": default: {
      const eo = norm(esperado), go = norm(obtenido);
      if (!eo.size) return 0;
      const inter = [...eo].filter(w => go.has(w)).length;
      return inter / eo.size >= 0.6 ? 1 : 0;
    }
  }
}
const resultados = s.casos.map((c, i) => ({ n: c.n, categoria: c.categoria, metodo: c.metodo, pasa: !!score(c, outs[i]) }));
const pasan = resultados.filter(r => r.pasa).length;
const pct = Math.round(pasan / resultados.length * 100);
const porCategoria = {};
for (const r of resultados) { porCategoria[r.categoria] = porCategoria[r.categoria] || { total: 0, pasa: 0 }; porCategoria[r.categoria].total++; if (r.pasa) porCategoria[r.categoria].pasa++; }
s.corridas.push({ pct, pasan, total: resultados.length, ts: new Date().toISOString(), fallos: resultados.filter(r => !r.pasa).map(r => r.n) });
if (s.corridas.length > 50) s.corridas = s.corridas.slice(-30);
store.save(st);
return ok({
  suite, score: pct + "%", pasan: pasan + "/" + resultados.length,
  por_categoria: Object.fromEntries(Object.entries(porCategoria).map(([k, v]) => [k, v.pasa + "/" + v.total])),
  fallos: resultados.filter(r => !r.pasa).map(r => ({ n: r.n, categoria: r.categoria, input: s.casos[r.n - 1].input.slice(0, 60) })),
  veredicto: pct === 100 ? "verde: sin regresiones" : pct >= 80 ? "amarillo: vigila las categorías débiles" : "ROJA: hubo regresión significativa, revierte el cambio",
});`,
      },
      {
        name: "suite_history",
        desc: "Historial de corridas de una suite: tendencia del score y detección de regresión entre corridas.",
        params: { suite: { t: "string", d: "Nombre de la suite" } },
        code: `const st = store.load();
const s = (st.suites || {})[suite];
if (!s) return fail("suite no encontrada");
const cs = s.corridas || [];
if (!cs.length) return ok({ corridas: 0 });
let regresion = null;
for (let i = 1; i < cs.length; i++) if (cs[i].pct < cs[i - 1].pct - 10) { regresion = { desde: cs[i - 1].pct, hasta: cs[i].pct, ts: cs[i].ts }; break; }
return ok({
  corridas: cs.length,
  score_actual: cs[cs.length - 1].pct,
  mejor_historico: Math.max(...cs.map(c => c.pct)),
  tendencia: cs.length >= 3 ? (cs[cs.length - 1].pct - cs[0].pct > 0 ? "mejorando" : cs[cs.length - 1].pct - cs[0].pct < 0 ? "empeorando" : "estable") : "insuficiente",
  primera_regresion_detectada: regresion,
  ultimas: cs.slice(-8).map(c => ({ ts: c.ts, pct: c.pct, fallos: c.fallos.length })),
});`,
      },
      {
        name: "list_suites",
        desc: "Lista todas las suites con su estado (casos, última corrida, score).",
        params: {},
        code: `const st = store.load();
const suites = Object.values(st.suites || {});
if (!suites.length) return ok({ suites: 0, sugerencia: "crea una suite con create_suite" });
return ok({
  suites: suites.map(s => ({ nombre: s.nombre, descripcion: s.descripcion.slice(0, 70), casos: s.casos.length, corridas: (s.corridas || []).length, ultimo_score: s.corridas?.at(-1)?.pct ?? null })),
});`,
      },
      {
        name: "export_cases",
        desc: "Exporta los casos de una suite (input/expected) para compartir o versionar el golden set.",
        params: { suite: { t: "string", d: "Nombre de la suite" } },
        code: `const st = store.load();
const s = (st.suites || {})[suite];
if (!s) return fail("suite no encontrada");
return ok({ suite, descripcion: s.descripcion, total: s.casos.length, casos: s.casos });`,
      },
    ],
  },
  {
    id: "regression-harness",
    title: "Regression Harness",
    tagline: "Regresión de comportamiento del agente: compara respuestas actuales vs históricas tras cualquier cambio",
    category: "Evaluación Continua",
    pain: "Cambias el system prompt 'inofensivamente' y el agente empieza a fallar de formas nuevas. Sin battery de regresión de comportamiento, el daño aparece días después cuando nadie relaciona el cambio con el fallo.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/regression-harness/. Registra runs (cambio aplicado + respuestas a probes fijas), compara contra baseline y detecta diffs semánticos y de comportamiento (tono, formato, longitud).",
    tools: [
      {
        name: "set_probes",
        desc: "Define las probes fijas (preguntas de sondeo) que se lanzarán en cada run para comparar comportamiento.",
        params: { probes: { t: "array", d: "Lista de entradas de sondeo" } },
        code: `const st = store.load();
const lista = (probes || []).map(String).filter(Boolean);
if (lista.length < 3) return fail("mínimo 3 probes para que la comparación sea significativa");
st.probes = lista;
store.save(st);
return ok({ probes_fijadas: lista.length });`,
      },
      {
        name: "record_run",
        desc: "Registra un run: qué cambio se aplicó (prompt/modelo/tool) y las respuestas a las probes (mismo orden).",
        params: { cambio: { t: "string", d: "Descripción del cambio aplicado" }, respuestas: { t: "array", d: "Respuestas a las probes en orden" }, marcar_baseline: { t: "boolean", d: "Establecer este run como baseline", opt: true, def: false } },
        code: `const st = store.load();
if (!st.probes) return fail("define las probes con set_probes primero");
const resp = respuestas || [];
if (resp.length !== st.probes.length) return fail("esperaba " + st.probes.length + " respuestas (una por probe), recibí " + resp.length);
st.runs = st.runs || [];
const run = { n: st.runs.length + 1, cambio, respuestas: resp.map(String), ts: new Date().toISOString() };
if (marcar_baseline || st.runs.length === 0) st.baseline = run.n;
st.runs.push(run);
store.save(st);
return ok({ run: run.n, cambio, baseline: st.baseline });`,
      },
      {
        name: "compare_to_baseline",
        desc: "Compara el último run contra el baseline: diffs por probe (semántico, longitud, formato) y score de regresión.",
        params: {},
        code: `const st = store.load();
if (!st.runs?.length || !st.baseline) return fail("sin runs o sin baseline");
const base = st.runs.find(r => r.n === st.baseline);
const actual = st.runs[st.runs.length - 1];
if (base.n === actual.n) return fail("el último run ES el baseline: registra otro run tras un cambio");
const norm = (x) => new Set(String(x).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
const diffs = st.probes.map((p, i) => {
  const a = base.respuestas[i], b = actual.respuestas[i];
  const sa = norm(a), sb = norm(b);
  const inter = [...sa].filter(w => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size || 1;
  const jaccard = inter / union;
  const lenDelta = b.length - a.length;
  const fmtA = (a.match(/\`\`\`|\\n\\d+\\.|\\n- /g) || []).length;
  const fmtB = (b.match(/\`\`\`|\\n\\d+\\.|\\n- /g) || []).length;
  return {
    probe: p.slice(0, 60),
    similitud: Number(jaccard.toFixed(2)),
    cambio_longitud_pct: a.length ? Number((lenDelta / a.length * 100).toFixed(0)) : null,
    cambio_formato: fmtA !== fmtB,
    estable: jaccard >= 0.6 && Math.abs(lenDelta / (a.length || 1)) < 0.4 && fmtA === fmtB,
  };
});
const estables = diffs.filter(d => d.estable).length;
const pct = Math.round(estables / diffs.length * 100);
st.ultimoComparacion = { run: actual.n, contra: base.n, pct, ts: new Date().toISOString() };
store.save(st);
return ok({
  comparado: "run " + actual.n + " (" + actual.cambio.slice(0, 50) + ") vs baseline " + base.n,
  estables: estables + "/" + diffs.length,
  score_estabilidad: pct + "%",
  diffs_inestables: diffs.filter(d => !d.estable),
  veredicto: pct >= 80 ? "comportamiento estable tras el cambio" : "REGRESIÓN DE COMPORTAMIENTO: el cambio alteró respuestas, evalúa si es intencional",
});`,
      },
      {
        name: "regression_history",
        desc: "Historial de cambios vs estabilidad: qué cambio rompió qué (auditoría causa-efecto).",
        params: {},
        code: `const st = store.load();
if (!st.runs?.length) return ok({ runs: 0 });
return ok({
  baseline: st.baseline,
  runs: st.runs.map(r => ({ n: r.n, cambio: r.cambio.slice(0, 80), ts: r.ts, es_baseline: r.n === st.baseline })),
  ultima_comparacion: st.ultimoComparacion || "sin comparar aún",
});`,
      },
      {
        name: "rebaseline",
        desc: "Re-baselinea a un run concreto (el nuevo comportamiento aprobado pasa a ser la referencia).",
        params: { run_n: { t: "number", d: "Número de run que pasa a ser baseline" }, motivo: { t: "string", d: "Por qué se aprueba el nuevo comportamiento" } },
        code: `const st = store.load();
const r = (st.runs || []).find(x => x.n === run_n);
if (!r) return fail("run inexistente");
if (!motivo) return fail("documenta por qué apruebas el nuevo comportamiento");
st.baseline = run_n;
st.rebaselines = st.rebaselines || [];
st.rebaselines.push({ hacia: run_n, motivo, ts: new Date().toISOString() });
store.save(st);
return ok({ baseline: run_n, motivo, total_rebaselines: st.rebaselines.length });`,
      },
    ],
  },
  {
    id: "prompt-ab-test",
    title: "Prompt A/B Test",
    tagline: "Experimentos A/B de prompts con métricas objetivas: deja de afinar prompts por intuición",
    category: "Evaluación Continua",
    pain: "Se afina el prompt por intuición y 'se siente mejor': sin A/B con métricas, la mitad de los cambios de prompt empeoran y nadie lo sabe.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/prompt-ab-test/. Experimentos con variantes A/B aplicadas a los mismos casos; scoring configurable (longitud, contiene-clave, sigue-formato, coste estimado) y significancia aproximada.",
    tools: [
      {
        name: "create_experiment",
        desc: "Crea un experimento A/B: nombre, qué se está probando y métrica de éxito.",
        params: { nombre: { t: "string", d: "Nombre del experimento" }, hipotesis: { t: "string", d: "Qué crees que mejorará y por qué" }, metrica: { t: "enum", d: "Métrica principal", values: ["contiene_clave", "concision", "sigue_formato", "manual"], opt: true, def: "contiene_clave" }, clave: { t: "string", d: "Palabra/frase clave esperada en la salida (para contiene_clave)", opt: true } },
        code: `const st = store.load();
st.exps = st.exps || {};
if (st.exps[nombre]) return fail("experimento existente");
st.exps[nombre] = { nombre, hipotesis, metrica, clave: clave || null, variantes: {}, resultados: {}, cerrado: null, creado: new Date().toISOString() };
store.save(st);
return ok({ experimento: nombre, metrica, hipotesis: hipotesis.slice(0, 90) });`,
      },
      {
        name: "add_variant",
        desc: "Añade una variante (A, B, C...) con el texto del prompt o configuración a comparar.",
        params: { experimento: { t: "string", d: "Nombre del experimento" }, etiqueta: { t: "string", d: "Etiqueta de la variante (A, B...)" }, contenido: { t: "string", d: "Texto/cambio concreto de la variante" } },
        code: `const st = store.load();
const e = (st.exps || {})[experimento];
if (!e) return fail("experimento no encontrado");
if (e.variantes[etiqueta]) return fail("variante existente");
e.variantes[etiqueta] = contenido;
e.resultados[etiqueta] = [];
store.save(st);
return ok({ experimento, variante: etiqueta, total_variantes: Object.keys(e.variantes).length });`,
      },
      {
        name: "record_result",
        desc: "Registra el resultado de una variante en un caso: salida obtenida (+costo en tokens opcional).",
        params: { experimento: { t: "string", d: "Nombre del experimento" }, variante: { t: "string", d: "Etiqueta de la variante" }, caso: { t: "string", d: "Identificador del caso de prueba" }, salida: { t: "string", d: "Salida obtenida" }, exito_manual: { t: "boolean", d: "Para metrica=manual: ¿fue buena?", opt: true }, tokens: { t: "number", d: "Costo en tokens de la salida", opt: true } },
        code: `const st = store.load();
const e = (st.exps || {})[experimento];
if (!e) return fail("experimento no encontrado");
if (!e.variantes[variante]) return fail("variante no registrada: " + variante);
e.resultados[variante].push({ caso, salida: String(salida), exito_manual: exito_manual ?? null, tokens: tokens || null, ts: new Date().toISOString() });
store.save(st);
return ok({ variante, n_resultados: e.resultados[variante].length });`,
      },
      {
        name: "analyze",
        desc: "Analiza el experimento: tasa de éxito por variante según la métrica, longitud media y recomendación de ganador.",
        params: { experimento: { t: "string", d: "Nombre del experimento" } },
        code: `const st = store.load();
const e = (st.exps || {})[experimento];
if (!e) return fail("experimento no encontrado");
const labels = Object.keys(e.variantes);
if (labels.length < 2) return fail("necesitas >=2 variantes");
function score(res) {
  const s = res.salida;
  switch (e.metrica) {
    case "contiene_clave": return e.clave && s.toLowerCase().includes(e.clave.toLowerCase()) ? 1 : 0;
    case "concision": return s.length > 0 && s.length <= 1500 ? 1 : 0;
    case "sigue_formato": return /(^\\n?[\\-\\d*\u2022]|\`\`\`|^\\{|^\\[)/m.test(s) ? 1 : 0;
    case "manual": return res.exito_manual === true ? 1 : 0;
  }
}
const resumen = labels.map(l => {
  const rs = e.resultados[l] || [];
  const exitos = rs.filter(r => score(r) === 1).length;
  const tokens = rs.filter(r => r.tokens).map(r => r.tokens);
  return {
    variante: l,
    casos: rs.length,
    tasa_exito: rs.length ? Number((exitos / rs.length).toFixed(2)) : null,
    longitud_media: rs.length ? Math.round(rs.reduce((s, r) => s + r.salida.length, 0) / rs.length) : null,
    tokens_medios: tokens.length ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length) : null,
  };
});
const conDatos = resumen.filter(r => r.tasa_exito !== null).sort((a, b) => b.tasa_exito - a.tasa_exito);
const mejor = conDatos[0];
const segundo = conDatos[1];
const significativo = mejor && segundo && (mejor.tasa_exito - segundo.tasa_exito) >= 0.15 && mejor.casos >= 5;
e.analisis = { resumen, ganador: significativo ? mejor.variante : null, ts: new Date().toISOString() };
store.save(st);
return ok({
  metrica: e.metrica, clave: e.clave,
  resumen,
  ganador_sugerido: mejor?.variante || null,
  significancia_aprox: significativo ? "diferencia >= 15 puntos con n>=5 por variante: aceptable" : "insuficiente: registra más casos por variante antes de decidir",
  consejo: significativo ? "adopta la variante " + mejor.variante + " y cierra el experimento" : "sigue recolectando: decidir ahora es intuición disfrazada de dato",
});`,
      },
      {
        name: "close_experiment",
        desc: "Cierra el experimento archivando el veredicto (qué variante se adoptó y qué se aprendió).",
        params: { experimento: { t: "string", d: "Nombre del experimento" }, ganador: { t: "string", d: "Variante adoptada" }, aprendizaje: { t: "string", d: "Qué se aprendió (para el futuro)" } },
        code: `const st = store.load();
const e = (st.exps || {})[experimento];
if (!e) return fail("experimento no encontrado");
if (!e.variantes[ganador]) return fail("la variante " + ganador + " no existe en este experimento");
e.cerrado = { ganador, aprendizaje, ts: new Date().toISOString() };
store.save(st);
return ok({ experimento, cerrado: true, ganador, aprendizaje: aprendizaje.slice(0, 120) });`,
      },
    ],
  },
];

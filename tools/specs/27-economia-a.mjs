// ═══ CATEGORÍA: Dolores FUTUROS · Economía del Agente (A) ═══
// Evidencia: "The Hidden Cost of Dust in Enterprise AI for 2026" (sep-2026):
// costos operativos espirales por compounding de infra y tokens;
// "stop sending the model data it doesn't need" (ago-2026).
export default [
  {
    id: "spend-envelope",
    title: "Spend Envelope",
    tagline: "Sobres de gasto con autorización escalonada: el agente pide permiso ANTES de quemar el presupuesto",
    category: "Economía del Agente",
    pain: "El agente no tiene freno económico: una tarea de $0.05 termina costando $3 porque nadie le exigió parar y pedir autorización al cruzar umbrales.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/spend-envelope/. Sobres jerárquicos (misión > tarea > sub-tarea) con techo, umbral de aviso y política de autorización (parar|pedir|abortar).",
    tools: [
      {
        name: "create_envelope",
        desc: "Crea un sobre de gasto: techo, umbral de aviso (80% por defecto) y política al superarlo.",
        params: { nombre: { t: "string", d: "Nombre del sobre (misión, tarea X...)" }, techo_usd: { t: "number", d: "Límite máximo en dólares" }, padre: { t: "string", d: "Sobre padre (para jerarquía)", opt: true }, umbral_aviso_pct: { t: "number", d: "% al que avisa", opt: true, def: 80 }, politica: { t: "enum", d: "Al alcanzar el techo", values: ["parar", "pedir_autorizacion", "abortar"], opt: true, def: "pedir_autorizacion" } },
        code: `if (techo_usd <= 0) return fail("techo inválido");
const st = store.load();
st.sobres = st.sobres || {};
if (st.sobres[nombre]) return fail("sobre existente");
if (padre && !st.sobres[padre]) return fail("sobre padre no encontrado: " + padre);
st.sobres[nombre] = { nombre, techo_usd, padre: padre || null, umbral_aviso_pct: umbral_aviso_pct ?? 80, politica, gastado: 0, movimientos: [], autorizaciones: [], estado: "abierto", creado: new Date().toISOString() };
store.save(st);
return ok({ sobre: nombre, techo: techo_usd, politica });`,
      },
      {
        name: "spend",
        desc: "Registra gasto contra un sobre: valida techo, jerarquía y devuelve directiva (ok, aviso, PARAR).",
        params: { sobre: { t: "string", d: "Nombre del sobre" }, concepto: { t: "string", d: "En qué se gastó (llm, tool, api)" }, usd: { t: "number", d: "Importe gastado" }, tokens: { t: "number", d: "Tokens si aplica", opt: true } },
        code: `const st = store.load();
const s = (st.sobres || {})[sobre];
if (!s) return fail("sobre no encontrado: " + sobre);
if (s.estado !== "abierto") return fail("sobre " + s.estado);
if (usd <= 0) return fail("importe inválido");
const previo = s.gastado;
s.gastado = Number((s.gastado + usd).toFixed(4));
s.movimientos.push({ concepto, usd, tokens: tokens || null, ts: new Date().toISOString(), acumulado: s.gastado });
const pct = s.gastado / s.techo_usd * 100;
let directiva = "ok";
if (pct >= 100) {
  if (s.politica === "parar") { s.estado = "pausado"; directiva = "PARAR: techo alcanzado, política parar"; }
  else if (s.politica === "abortar") { s.estado = "abortado"; directiva = "ABORTAR: techo alcanzado"; }
  else directiva = "PEDIR_AUTORIZACION: techo alcanzado (" + s.gastado.toFixed(2) + "/" + s.techo_usd + " USD)";
} else if (pct >= (s.umbral_aviso_pct ?? 80)) {
  directiva = "AVISO: " + Math.round(pct) + "% del techo consumido, queda " + (s.techo_usd - s.gastado).toFixed(2) + " USD";
}
let padreAviso = null;
if (s.padre) {
  const p = st.sobres[s.padre];
  p.gastado = Number((p.gastado + usd).toFixed(4));
  const pctP = p.gastado / p.techo_usd * 100;
  if (pctP >= (p.umbral_aviso_pct ?? 80)) padreAviso = "PADRE " + p.nombre + " al " + Math.round(pctP) + "%";
}
store.save(st);
return ok({ sobre, gastado: s.gastado, techo: s.techo_usd, pct: Number(pct.toFixed(1)), directiva, aviso_padre: padreAviso });`,
      },
      {
        name: "authorize",
        desc: "Autoriza (o niega) continuar tras alcanzar el techo; queda auditoría de quién y cuánto extra.",
        params: { sobre: { t: "string", d: "Nombre del sobre" }, aprobado: { t: "boolean", d: "¿Autorizado?" }, monto_extra_usd: { t: "number", d: "Techo adicional autorizado", opt: true }, autorizado_por: { t: "string", d: "Quién autoriza" }, motivo: { t: "string", d: "Por qué" } },
        code: `const st = store.load();
const s = (st.sobres || {})[sobre];
if (!s) return fail("sobre no encontrado");
s.autorizaciones.push({ aprobado, extra: monto_extra_usd || 0, por: autorizado_por, motivo, ts: new Date().toISOString() });
if (aprobado) {
  if (monto_extra_usd) s.techo_usd = Number((s.techo_usd + monto_extra_usd).toFixed(4));
  s.estado = "abierto";
} else {
  s.estado = "cerrado";
}
store.save(st);
return ok({ sobre, decision: aprobado ? "aprobado" : "denegado", nuevo_techo: s.techo_usd, estado: s.estado });`,
      },
      {
        name: "envelope_status",
        desc: "Estado de un sobre: consumo, proyección al ritmo actual y movimientos recientes.",
        params: { sobre: { t: "string", d: "Nombre del sobre" } },
        code: `const st = store.load();
const s = (st.sobres || {})[sobre];
if (!s) return fail("sobre no encontrado");
const movs = s.movimientos;
let ritmo = null;
if (movs.length >= 3) {
  const spanMs = new Date(movs[movs.length - 1].ts) - new Date(movs[0].ts);
  if (spanMs > 0) ritmo = Number((s.gastado / (spanMs / 3600000)).toFixed(3));
}
return ok({
  sobre, estado: s.estado,
  gastado: Number(s.gastado.toFixed(4)), techo: s.techo_usd, pct: Number((s.gastado / s.techo_usd * 100).toFixed(1)),
  usd_por_hora: ritmo,
  horas_para_techo: ritmo && ritmo > 0 ? Number(((s.techo_usd - s.gastado) / ritmo).toFixed(1)) : null,
  movimientos: movs.slice(-8).map(m => ({ concepto: m.concepto, usd: m.usd, acumulado: Number(m.acumulado.toFixed(3)) })),
  autorizaciones: s.autorizaciones.length,
});`,
      },
      {
        name: "portfolio",
        desc: "Panorama de todos los sobres: consumo agregado, sobres en riesgo y autorizaciones pendientes.",
        params: {},
        code: `const st = store.load();
const sobres = Object.values(st.sobres || {});
if (!sobres.length) return ok({ sobres: 0, sugerencia: "crea sobres con create_envelope" });
const totalGastado = sobres.reduce((s, x) => s + x.gastado, 0);
const totalTecho = sobres.reduce((s, x) => s + x.techo_usd, 0);
const enRiesgo = sobres.filter(x => x.estado === "abierto" && x.gastado / x.techo_usd * 100 >= (x.umbral_aviso_pct ?? 80));
const pausados = sobres.filter(x => ["pausado", "abortado"].includes(x.estado));
return ok({
  sobres: sobres.length,
  global: { gastado: Number(totalGastado.toFixed(2)), techo: Number(totalTecho.toFixed(2)), pct: Number((totalGastado / totalTecho * 100).toFixed(1)) },
  en_riesgo: enRiesgo.map(x => ({ sobre: x.nombre, pct: Math.round(x.gastado / x.techo_usd * 100) })),
  pausados_o_abortados: pausados.map(x => ({ sobre: x.nombre, estado: x.estado, gastado: Number(x.gastado.toFixed(3)) })),
  acciones: enRiesgo.length ? "sobres en riesgo: decide autorizar o dejar que la política actúe" : "todo bajo control",
});`,
      },
    ],
  },
  {
    id: "task-roi",
    title: "Task ROI",
    tagline: "ROI por tarea: valor generado vs costo en tokens/dinero/tiempo — qué trabajo vale la pena",
    category: "Economía del Agente",
    pain: "El agente no sabe cuánto cuesta su trabajo ni cuánto vale: optimiza completar tareas, no el retorno de completarlas. Tareas de bajo valor consumen el mismo presupuesto que las críticas.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/task-roi/. Cada tarea registra valor estimado (USD o puntos) y costo real (tokens, USD, minutos); calcula ROI, prioriza por valor/costo y detecta tareas de valor negativo.",
    tools: [
      {
        name: "log_task",
        desc: "Registra una tarea completada: valor estimado, costo en USD, tokens y minutos.",
        params: { tarea: { t: "string", d: "Descripción de la tarea" }, valor_usd: { t: "number", d: "Valor estimado generado (USD)" }, costo_usd: { t: "number", d: "Costo total (USD)" }, tokens: { t: "number", d: "Tokens consumidos", opt: true }, minutos: { t: "number", d: "Tiempo invertido", opt: true }, categoria: { t: "string", d: "Categoría del trabajo", opt: true, def: "general" } },
        code: `const st = store.load();
st.tareas = st.tareas || [];
st.tareas.push({ tarea, valor_usd, costo_usd, tokens: tokens || null, minutos: minutos || null, categoria, ts: new Date().toISOString() });
store.save(st);
return ok({ registrada: true, roi: Number((valor_usd / Math.max(costo_usd, 0.0001)).toFixed(2)) + "x" });`,
      },
      {
        name: "roi_report",
        desc: "Reporte ROI global y por categoría: retorno medio, tareas de valor negativo y mejor/peor inversión.",
        params: {},
        code: `const st = store.load();
const ts = st.tareas || [];
if (!ts.length) return ok({ tareas: 0, sugerencia: "registra tareas con log_task" });
const porCat = {};
for (const t of ts) {
  porCat[t.categoria] = porCat[t.categoria] || { n: 0, valor: 0, costo: 0 };
  porCat[t.categoria].n++; porCat[t.categoria].valor += t.valor_usd; porCat[t.categoria].costo += t.costo_usd;
}
const valorTotal = ts.reduce((s, t) => s + t.valor_usd, 0);
const costoTotal = ts.reduce((s, t) => s + t.costo_usd, 0);
const negativas = ts.filter(t => t.valor_usd < t.costo_usd);
return ok({
  tareas: ts.length,
  global: { valor: Number(valorTotal.toFixed(2)), costo: Number(costoTotal.toFixed(2)), roi: Number((valorTotal / Math.max(costoTotal, 0.0001)).toFixed(2)) + "x" },
  por_categoria: Object.entries(porCat).map(([cat, v]) => ({ categoria: cat, tareas: v.n, roi: Number((v.valor / Math.max(v.costo, 0.0001)).toFixed(2)) + "x", costo_medio: Number((v.costo / v.n).toFixed(3)) })).sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi)),
  tareas_valor_negativo: negativas.length,
  peores: negativas.sort((a, b) => (a.valor_usd - a.costo_usd) - (b.valor_usd - b.costo_usd)).slice(0, 5).map(t => ({ tarea: t.tarea.slice(0, 60), valor: t.valor_usd, costo: t.costo_usd, delta: Number((t.valor_usd - t.costo_usd).toFixed(3)) })),
  consejo: negativas.length > ts.length * 0.3 ? "más del 30% de tareas destruye valor: sube el umbral de qué tareas aceptas" : "cartera sana",
});`,
      },
      {
        name: "prioritize",
        desc: "Prioriza trabajo pendiente por valor/costo (ROI esperado) con desempate por urgencia.",
        params: { pendientes: { t: "array", d: "Tareas {tarea, valor_usd, costo_usd, urgencia}" } },
        code: `const items = (pendientes || []).filter(t => t && t.tarea);
if (!items.length) return fail("lista vacía");
const rankeadas = items.map(t => {
  const costo = Math.max(Number(t.costo_usd) || 0.01, 0.01);
  const valor = Number(t.valor_usd) || 0;
  const urgencia = Number(t.urgencia) || 3;
  const roi = valor / costo;
  const score = roi * (1 + (5 - urgencia) * 0.15);
  return { tarea: t.tarea, valor: valor, costo: costo, roi_esperado: Number(roi.toFixed(2)), urgencia, score: Number(score.toFixed(2)) };
}).sort((a, b) => b.score - a.score);
return ok({
  orden_recomendado: rankeadas.map((r, i) => ({ prioridad: i + 1, tarea: r.tarea, roi: r.roi_esperado + "x", score: r.score })),
  criterio: "score = ROI x factor urgencia (urgencia 1=alta multiplica x1.6)",
  descarta: rankeadas.filter(r => r.roi_esperado < 1).map(r => ({ tarea: r.tarea, razon: "ROI esperado < 1x: destruye valor" })),
});`,
      },
      {
        name: "cost_per_output",
        desc: "Costo por unidad de salida (documento, análisis, línea de código): métrica de eficiencia comparativa.",
        params: { tareas: { t: "array", d: "Tareas {tarea, costo_usd, unidades}" } },
        code: `const items = (tareas || []).filter(t => t && t.tarea && t.costo_usd && t.unidades);
if (!items.length) return fail("necesitas tareas con costo_usd y unidades");
const filas = items.map(t => ({ tarea: t.tarea, costo: Number(t.costo_usd), unidades: Number(t.unidades), costo_por_unidad: Number((t.costo_usd / t.unidades).toFixed(4)) }));
const media = filas.reduce((s, f) => s + f.costo_por_unidad, 0) / filas.length;
return ok({
  costo_medio_por_unidad: Number(media.toFixed(4)),
  filas: filas.sort((a, b) => a.costo_por_unidad - b.costo_por_unidad),
  outliers_caros: filas.filter(f => f.costo_por_unidad > media * 2).map(f => f.tarea),
  benchmark: "compara contra la media interna: >2x la media es outlier que merece autopsia",
});`,
      },
    ],
  },
  {
    id: "token-audit",
    title: "Token Audit",
    tagline: "Auditoría de a dónde van los tokens: qué consumió el contexto, la retrieval y las tools",
    category: "Economía del Agente",
    pain: "El 60-70% de los tokens se gastan en cosas que no aportan: historial rancio, retrieval excesiva, salidas de tools gigantes. Sin auditoría por partida, no hay forma de recortar con criterio.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/token-audit/. Partidas configurables (system, historial, retrieval, tools, output, overhead) con registro por interacción y reparto porcentual del gasto.",
    tools: [
      {
        name: "log_usage",
        desc: "Registra el consumo de tokens de una interacción, desglosado por partida.",
        params: { interaccion: { t: "string", d: "ID o descripción de la interacción" }, system: { t: "number", d: "Tokens de system prompt", opt: true, def: 0 }, historial: { t: "number", d: "Tokens de historial/conversación", opt: true, def: 0 }, retrieval: { t: "number", d: "Tokens de contexto recuperado", opt: true, def: 0 }, tools_entrada: { t: "number", d: "Tokens de resultados de tools hacia el modelo", opt: true, def: 0 }, output: { t: "number", d: "Tokens generados", opt: true, def: 0 }, overhead: { t: "number", d: "Otros (formato, fences...)", opt: true, def: 0 } },
        code: `const st = store.load();
st.log = st.log || [];
const partidas = { system: system || 0, historial: historial || 0, retrieval: retrieval || 0, tools_entrada: tools_entrada || 0, output: output || 0, overhead: overhead || 0 };
const total = Object.values(partidas).reduce((a, b) => a + b, 0);
if (total === 0) return fail("todas las partidas en cero: nada que auditar");
st.log.push({ interaccion, partidas, total, ts: new Date().toISOString() });
if (st.log.length > 2000) st.log = st.log.slice(-1500);
store.save(st);
return ok({ interaccion, total, reparto_pct: Object.fromEntries(Object.entries(partidas).map(([k, v]) => [k, Number((v / total * 100).toFixed(1))])) });`,
      },
      {
        name: "audit_report",
        desc: "Reporte de reparto agregado: % medio por partida y tendencias (¿el historial crece sin control?).",
        params: {},
        code: `const st = store.load();
const log = st.log || [];
if (!log.length) return ok({ interacciones: 0, sugerencia: "registra usos con log_usage" });
const sumas = { system: 0, historial: 0, retrieval: 0, tools_entrada: 0, output: 0, overhead: 0 };
const total = log.reduce((s, e) => s + e.total, 0);
for (const e of log) for (const [k, v] of Object.entries(e.partidas)) sumas[k] += v;
const mitad = Math.floor(log.length / 2);
const mediaPrimera = log.slice(0, mitad).reduce((s, e) => s + e.partidas.historial, 0) / Math.max(mitad, 1);
const mediaSegunda = log.slice(mitad).reduce((s, e) => s + e.partidas.historial, 0) / Math.max(log.length - mitad, 1);
return ok({
  interacciones: log.length,
  tokens_totales: total,
  reparto_pct: Object.fromEntries(Object.entries(sumas).map(([k, v]) => [k, Number((v / total * 100).toFixed(1))])),
  tokens_medios_por_interaccion: Math.round(total / log.length),
  crecimiento_historial: Number((((mediaSegunda - mediaPrimera) / Math.max(mediaPrimera, 1)) * 100).toFixed(1)) + "%",
  recortables: [
    ...(sumas.historial / total > 0.35 ? ["historial > 35%: comprime/resume turnos viejos (context-compressor)"] : []),
    ...(sumas.retrieval / total > 0.30 ? ["retrieval > 30%: sube el umbral de relevancia o chunk más fino"] : []),
    ...(sumas.tools_entrada / total > 0.30 ? ["resultados de tools > 30%: recorta salidas de tools (response-size-guard)"] : []),
    ...(sumas.system / total > 0.25 ? ["system prompt > 25%: es estático, revisa si todo es necesario"] : []),
  ],
  ahorro_estimado: "recortando las partidas marcadas a niveles sanos ahorras ~" + Math.round(Math.max(0, sumas.historial - total * 0.25) + Math.max(0, sumas.retrieval - total * 0.2) + Math.max(0, sumas.tools_entrada - total * 0.2)) + " tokens (" + Math.round((Math.max(0, sumas.historial - total * 0.25) + Math.max(0, sumas.retrieval - total * 0.2) + Math.max(0, sumas.tools_entrada - total * 0.2)) / total * 100) + "%)",
});`,
      },
      {
        name: "outlier_interactions",
        desc: "Detecta interacciones anómalamente caras (muchos más tokens que la media) para autopsiarlas.",
        params: {},
        code: `const st = store.load();
const log = st.log || [];
if (log.length < 5) return fail("necesitas >=5 interacciones");
const totales = log.map(e => e.total).sort((a, b) => a - b);
const mediana = totales[Math.floor(totales.length / 2)];
const umbral = mediana * 2.5;
const anomalias = log.filter(e => e.total > umbral);
return ok({
  mediana_tokens: mediana,
  umbral_anomalia: Math.round(umbral),
  anomalias: anomalias.length,
  detalle: anomalias.slice(-8).map(e => ({ interaccion: e.interaccion, total: e.total, peor_partida: Object.entries(e.partidas).sort((a, b) => b[1] - a[1])[0].join(": ") })),
  consejo: anomalias.length > log.length * 0.1 ? "más del 10% de interacciones son outliers: hay un patrón, no mala suerte" : "outliers puntuales",
});`,
      },
      {
        name: "simulate_cut",
        desc: "Simula el ahorro de recortar una partida a un % objetivo antes de aplicarlo.",
        params: { partida: { t: "enum", d: "Partida a recortar", values: ["system", "historial", "retrieval", "tools_entrada", "overhead"] }, objetivo_pct: { t: "number", d: "% del total al que quieres llevarla" } },
        code: `const st = store.load();
const log = st.log || [];
if (!log.length) return fail("sin datos registrados");
if (objetivo_pct < 0 || objetivo_pct > 100) return fail("objetivo_pct 0-100");
const total = log.reduce((s, e) => s + e.total, 0);
const actual = log.reduce((s, e) => s + (e.partidas[partida] || 0), 0);
const actualPct = actual / total * 100;
if (actualPct <= objetivo_pct) return ok({ partida, pct_actual: Number(actualPct.toFixed(1)), mensaje: "ya está en o bajo el objetivo: nada que recortar" });
const objetivoAbs = total * objetivo_pct / 100;
return ok({
  partida, pct_actual: Number(actualPct.toFixed(1)), pct_objetivo: objetivo_pct,
  tokens_a_ahorrar: Math.round(actual - objetivoAbs),
  ahorro_pct_del_total: Number(((actual - objetivoAbs) / total * 100).toFixed(1)),
  como: {
    historial: "resume turnos viejos y conserva solo decisiones y hechos",
    retrieval: "sube umbral de similitud / limita top-k / chunks más pequeños",
    tools_entrada: "pide salidas resumidas o estructuradas a las tools",
    system: "elimina instrucciones redundantes o muévelas a tool descriptions",
    overhead: "reduce fences, relleno y formatos repetitivos",
  }[partida],
});`,
      },
    ],
  },
];

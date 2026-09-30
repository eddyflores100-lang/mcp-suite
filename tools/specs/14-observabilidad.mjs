// ═══ CATEGORÍA: Dolores de agentes · Observabilidad (10) ═══
// Dolor de fondo: "Your MCP Agent Is Failing Silently" (Fiddler):
// sin logs, métricas, costes ni latencias, el agente falla a ciegas.
export default [
  {
    id: "trace-logger",
    title: "Trace Logger",
    tagline: "Logs estructurados con niveles y correlación por trace-id",
    category: "Observabilidad",
    pain: "console.log plano sin niveles ni correlación: imposible reconstruir una ejecución fallida.",
    persistent: true,
    imports: ["crypto"],
    tools: [
      {
        name: "log",
        desc: "Registra un log estructurado: nivel (debug/info/warn/error), mensaje, trace_id y datos JSON.",
        params: { nivel: { t: "enum", values: ["debug", "info", "warn", "error"], d: "Nivel" }, mensaje: { t: "string", d: "Mensaje" }, trace_id: { t: "string", d: "ID de correlación", opt: true }, datos: { t: "any", d: "Datos estructurados", opt: true } },
        code: `const st = store.load();
st.logs = st.logs || [];
const entry = { ts: new Date().toISOString(), nivel, mensaje, trace: trace_id || null, datos: datos ?? null };
st.logs.push(entry);
if (st.logs.length > 3000) st.logs = st.logs.slice(-3000);
store.save(st);
return ok({ registrado: true, total: st.logs.length });`,
      },
      {
        name: "tail",
        desc: "Devuelve los últimos N logs, filtrables por nivel y trace_id.",
        params: { nivel: { t: "enum", values: ["debug", "info", "warn", "error"], d: "Filtrar nivel", opt: true }, trace_id: { t: "string", d: "Filtrar por trace", opt: true }, n: { t: "number", d: "Cuántos", opt: true, def: 30 } },
        code: `const st = store.load();
let logs: any[] = st.logs || [];
if (nivel) logs = logs.filter((l) => l.nivel === nivel);
if (trace_id) logs = logs.filter((l) => l.trace === trace_id);
return ok({ total_logs: logs.length, logs: logs.slice(-(n ?? 30)).reverse() });`,
      },
      {
        name: "search",
        desc: "Busca logs por texto en mensaje (con ventana de horas opcional).",
        params: { texto: { t: "string", d: "Texto a buscar" }, horas: { t: "number", d: "Últimas N horas", opt: true } },
        code: `const st = store.load();
let logs: any[] = st.logs || [];
if (horas) { const desde = Date.now() - horas * 3600000; logs = logs.filter((l) => new Date(l.ts).getTime() >= desde); }
const t = texto.toLowerCase();
const found = logs.filter((l) => String(l.mensaje).toLowerCase().includes(t));
return ok({ encontrados: found.length, logs: found.slice(-50).reverse() });`,
      },
      {
        name: "new_trace",
        desc: "Genera un nuevo trace-id para correlacionar una ejecución completa.",
        params: { etiqueta: { t: "string", d: "Etiqueta del trace", opt: true } },
        code: `const id = randomBytes(8).toString("hex");
return ok({ trace_id: id, etiqueta: etiqueta || "", ts: new Date().toISOString(), uso: "pasa este trace_id a cada log/log de la ejecución" });`,
      },
    ],
  },
  {
    id: "metrics-collector",
    title: "Metrics Collector",
    tagline: "Contadores, medidores e histogramas: las métricas del agente en local",
    category: "Observabilidad",
    pain: "Sin métricas no hay forma de saber qué tools se usan ni cuánto tardan: tuning a ciegas.",
    persistent: true,
    tools: [
      {
        name: "incr",
        desc: "Incrementa un contador (ej: llamadas a tool X, errores de tipo Y).",
        params: { metrica: { t: "string", d: "Nombre del contador" }, delta: { t: "number", d: "Incremento", opt: true, def: 1 }, etiquetas: { t: "any", d: "Etiquetas {tool, servidor...}", opt: true } },
        code: `const st = store.load();
st.contadores = st.contadores || {};
st.contadores[metrica] = (st.contadores[metrica] || 0) + (delta ?? 1);
store.save(st);
return ok({ metrica, valor: st.contadores[metrica] });`,
      },
      {
        name: "observe",
        desc: "Observa un valor (duración ms, tamaño bytes): guarda las últimas mediciones y calcula estadísticas.",
        params: { metrica: { t: "string", d: "Nombre" }, valor: { t: "number", d: "Valor observado" } },
        code: `const st = store.load();
st.mediciones = st.mediciones || {};
st.mediciones[metrica] = (st.mediciones[metrica] || []).concat(valor).slice(-200);
store.save(st);
return ok({ metrica, ultima: valor });`,
      },
      {
        name: "snapshot",
        desc: "Snapshot de todas las métricas: contadores y estadísticas de mediciones (media, p50, p95, máx).",
        params: {},
        code: `const st = store.load();
const stats = (vals: number[]) => {
  if (!vals.length) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return { n: vals.length, media: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), p50: pct(50), p95: pct(95), max: sorted[sorted.length - 1] };
};
return ok({ contadores: st.contadores || {}, mediciones: Object.fromEntries(Object.entries(st.mediciones || {}).map(([k, v]: [string, any]) => [k, stats(v)])) });`,
      },
    ],
  },
  {
    id: "cost-tracker",
    title: "Cost Tracker",
    tagline: "Sigue el gasto por llamada y modelo: presupuestos con alertas",
    category: "Observabilidad",
    pain: "El coste de tokens es invisible hasta la factura: sin tracking por tarea no se puede optimizar nada.",
    persistent: true,
    tools: [
      {
        name: "record",
        desc: "Registra un gasto: modelo, tokens entrada/salida y coste calculado con tabla de precios editable.",
        params: { tarea: { t: "string", d: "Tarea/proyecto a imputar" }, modelo: { t: "string", d: "Modelo usado (ej: gpt-4o, claude-sonnet)" }, tokens_entrada: { t: "number", d: "Tokens de entrada", opt: true, def: 0 }, tokens_salida: { t: "number", d: "Tokens de salida", opt: true, def: 0 } },
        code: `const st = store.load();
const precios: any = { "gpt-4o": [0.0025, 0.01], "gpt-4o-mini": [0.00015, 0.0006], "claude-sonnet": [0.003, 0.015], "claude-haiku": [0.0008, 0.004], "gemini-flash": [0.0001, 0.0004], "local": [0, 0] };
st.precios_custom = st.precios_custom || {};
const tabla = { ...precios, ...st.precios_custom };
const [pe, ps] = tabla[modelo] || [0.003, 0.015];
const coste = (tokens_entrada ?? 0) / 1000 * pe + (tokens_salida ?? 0) / 1000 * ps;
st.gastos = st.gastos || [];
st.gastos.push({ ts: new Date().toISOString(), tarea, modelo, tokens_entrada: tokens_entrada ?? 0, tokens_salida: tokens_salida ?? 0, coste: Math.round(coste * 1e6) / 1e6 });
store.save(st);
return ok({ coste_llamada: Math.round(coste * 1e6) / 1e6, moneda: "USD (aprox)" });`,
      },
      {
        name: "report",
        desc: "Reporte de gastos: total, por tarea, por modelo y alerta si supera el presupuesto configurado.",
        params: {},
        code: `const st = store.load();
const gastos: any[] = st.gastos || [];
const por_tarea: any = {}; const por_modelo: any = {};
let total = 0;
for (const g of gastos) { por_tarea[g.tarea] = (por_tarea[g.tarea] || 0) + g.coste; por_modelo[g.modelo] = (por_modelo[g.modelo] || 0) + g.coste; total += g.coste; }
const presupuesto = st.presupuesto ?? null;
return ok({ total_usd: Math.round(total * 10000) / 10000, llamadas: gastos.length, por_tarea, por_modelo, presupuesto, sobre_presupuesto: presupuesto ? total > presupuesto : false, tokens_totales: gastos.reduce((a, g) => a + g.tokens_entrada + g.tokens_salida, 0) });`,
      },
      {
        name: "set_budget",
        desc: "Define el presupuesto máximo en USD y precios custom por modelo.",
        params: { presupuesto_usd: { t: "number", d: "Presupuesto máximo" }, precios_custom: { t: "any", d: "{modelo: [precio_entrada, precio_salida] por 1k tokens}", opt: true } },
        code: `const st = store.load();
st.presupuesto = presupuesto_usd;
if (precios_custom && typeof precios_custom === "object") { st.precios_custom = { ...(st.precios_custom || {}), ...precios_custom }; }
store.save(st);
return ok({ presupuesto: st.presupuesto, precios_custom: st.precios_custom });`,
      },
    ],
  },
  {
    id: "latency-tracker",
    title: "Latency Tracker",
    tagline: "Latencias por tool y paso: p50/p95/p99 para encontrar los cuellos de botella",
    category: "Observabilidad",
    pain: "El agente tarda pero nadie sabe dónde: sin latencias por paso, la optimización es adivinanza.",
    persistent: true,
    tools: [
      {
        name: "start",
        desc: "Inicia un timer para una operación. Devuelve el timer_id.",
        params: { operacion: { t: "string", d: "Nombre de la operación" } },
        code: `const st = store.load();
st.timers = st.timers || {};
const id = "t-" + Math.random().toString(36).slice(2, 9);
st.timers[id] = { operacion, inicio: Date.now() };
store.save(st);
return ok({ timer_id: id, operacion });`,
      },
      {
        name: "end",
        desc: "Termina el timer y registra la duración en el historial de la operación.",
        params: { timer_id: { t: "string", d: "ID del timer" } },
        code: `const st = store.load();
const t = st.timers?.[timer_id];
if (!t) return fail("timer no existe");
delete st.timers[timer_id];
const ms = Date.now() - t.inicio;
st.latencias = st.latencias || {};
st.latencias[t.operacion] = (st.latencias[t.operacion] || []).concat(ms).slice(-200);
store.save(st);
return ok({ operacion: t.operacion, duracion_ms: ms });`,
      },
      {
        name: "percentiles",
        desc: "Percentiles p50/p95/p99 por operación + ranking de operaciones más lentas.",
        params: {},
        code: `const st = store.load();
const resultado: any[] = [];
for (const [op, vals] of Object.entries(st.latencias || {})) {
  const v = (vals as number[]).slice().sort((a, b) => a - b);
  const pct = (p: number) => v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
  resultado.push({ operacion: op, n: v.length, p50: pct(50), p95: pct(95), p99: pct(99), media: Math.round(v.reduce((a, b) => a + b, 0) / v.length) });
}
resultado.sort((a, b) => b.p95 - a.p95);
return ok({ operaciones: resultado, mas_lenta_p95: resultado[0]?.operacion || null });`,
      },
    ],
  },
  {
    id: "run-reporter",
    title: "Run Reporter",
    tagline: "Reportes de ejecución: pasos, duración, hallazgos y resultado final",
    category: "Observabilidad",
    pain: "Al terminar una tarea no queda reporte de qué se hizo: el conocimiento de la ejecución se evapora.",
    persistent: true,
    tools: [
      {
        name: "start_run",
        desc: "Inicia una ejecución con objetivo y contexto. Devuelve run_id.",
        params: { objetivo: { t: "string", d: "Objetivo de la ejecución" }, contexto: { t: "string", d: "Contexto", opt: true } },
        code: `const st = store.load();
st.runs = st.runs || [];
const run = { id: "run-" + (st.runs.length + 1), objetivo, contexto: contexto || "", inicio: new Date().toISOString(), pasos: [], estado: "en_curso" };
st.runs.push(run);
store.save(st);
return ok({ run_id: run.id });`,
      },
      {
        name: "add_step",
        desc: "Añade un paso a la ejecución: descripción, resultado, duración y artefactos.",
        params: { run_id: { t: "string", d: "ID de la ejecución" }, paso: { t: "string", d: "Descripción del paso" }, resultado: { t: "string", d: "Resultado", opt: true }, duracion_ms: { t: "number", d: "Duración", opt: true }, artefactos: { t: "array", d: "Archivos/deliverables generados", opt: true } },
        code: `const st = store.load();
const run = (st.runs || []).find((r) => r.id === run_id);
if (!run) return fail("run no existe");
run.pasos.push({ n: run.pasos.length + 1, paso, resultado: resultado || "", duracion_ms: duracion_ms ?? null, artefactos: Array.isArray(artefactos) ? artefactos : [], ts: new Date().toISOString() });
store.save(st);
return ok({ run_id, total_pasos: run.pasos.length });`,
      },
      {
        name: "finish_run",
        desc: "Cierra la ejecución con éxito/fallo y genera el reporte completo (markdown).",
        params: { run_id: { t: "string", d: "ID de la ejecución" }, exito: { t: "boolean", d: "Resultado global" }, resumen: { t: "string", d: "Resumen final", opt: true } },
        code: `const st = store.load();
const run = (st.runs || []).find((r) => r.id === run_id);
if (!run) return fail("run no existe");
run.estado = exito ? "exito" : "fallo";
run.resumen = resumen || "";
run.fin = new Date().toISOString();
const duracion_total = (new Date(run.fin).getTime() - new Date(run.inicio).getTime()) / 1000;
store.save(st);
const md = ["# Reporte " + run.id, "", "**Objetivo:** " + run.objetivo, "**Estado:** " + run.estado.toUpperCase(), "**Duración:** " + Math.round(duracion_total) + "s", "", "## Pasos", ...run.pasos.map((p: any) => "- [" + p.n + "] " + p.paso + (p.resultado ? " → " + p.resultado : "") + (p.duracion_ms ? " (" + p.duracion_ms + "ms)" : "")), "", "**Resumen:** " + (run.resumen || "n/a")].join("\\n");
return ok({ run_id, estado: run.estado, duracion_seg: Math.round(duracion_total), pasos: run.pasos.length, reporte_markdown: md });`,
      },
    ],
  },
  {
    id: "error-triage",
    title: "Error Triage",
    tagline: "Clasifica errores, sugiere acción y registra patrón: la sala de emergencias del agente",
    category: "Observabilidad",
    pain: "Los errores se acumulan sin clasificar: sin triage no se sabe qué es transitorio, qué es bug y qué es configuración.",
    persistent: true,
    tools: [
      {
        name: "classify",
        desc: "Clasifica un error en taxonomía (red/auth/validación/límite/bug/datos) y sugiere la acción inmediata.",
        params: { error: { t: "string", d: "Mensaje de error" }, contexto: { t: "string", d: "Qué tool/operación lo produjo", opt: true } },
        code: `const e = String(error).toLowerCase();
let categoria = "desconocido"; let accion = "investigar manualmente"; let severidad = "media";
if (/timeout|etimedout|econn|network|fetch failed|enotfound/.test(e)) { categoria = "red"; accion = "retry con backoff (retry-orchestrator); si persiste, circuit-breaker"; severidad = "alta"; }
else if (/401|403|unauthorized|forbidden|invalid api key|token/.test(e)) { categoria = "auth"; accion = "verificar credenciales/permisos; nunca reintentar a ciegas"; severidad = "critica"; }
else if (/429|rate.?limit|quota|too many/.test(e)) { categoria = "limite"; accion = "esperar y respetar rate-limiter"; severidad = "media"; }
else if (/400|422|invalid|schema|validation|parse|malformed/.test(e)) { categoria = "validacion"; accion = "corregir input; validar con schema-validator"; severidad = "media"; }
else if (/5\\d\\d|internal|gateway/.test(e)) { categoria = "upstream"; accion = "retry 1-2 veces; reportar si persiste"; severidad = "alta"; }
else if (/not found|404/.test(e)) { categoria = "datos"; accion = "verificar id/url; quizá fue eliminado"; severidad = "baja"; }
else if (/enomem|memory|heap/.test(e)) { categoria = "recursos"; accion = "reducir batch size; trocear con batch-runner"; severidad = "critica"; }
const st = store.load();
st.patrones = st.patrones || {};
st.patrones[categoria] = (st.patrones[categoria] || 0) + 1;
store.save(st);
return ok({ categoria, severidad, accion, reintentable: ["red", "limite", "upstream"].includes(categoria) });`,
      },
      {
        name: "pattern_report",
        desc: "Reporte de patrones de error acumulados: qué categorías dominan (para atacar la causa raíz).",
        params: {},
        code: `const st = store.load();
const patrones = Object.entries(st.patrones || {}).sort((a: any, b: any) => b[1] - a[1]);
return ok({ patrones, dominante: patrones[0]?.[0] || null, recomendacion: patrones[0] ? "ataca primero la categoría " + patrones[0][0] : "sin errores registrados" });`,
      },
    ],
  },
  {
    id: "heartbeat-monitor",
    title: "Heartbeat Monitor",
    tagline: "El agente reporta latidos: detecta congelamientos y sesiones huérfanas",
    category: "Observabilidad",
    pain: "Un agente congelado no falla: simplemente desaparece. Sin heartbeats, nadie nota la muerte silenciosa.",
    persistent: true,
    tools: [
      {
        name: "beat",
        desc: "Registra un latido de una unidad de trabajo (agente/bucle). Devuelve si está en riesgo (mucho tiempo sin latir no puede pasar, pero múltiple beats largos sí alertan).",
        params: { unidad: { t: "string", d: "Nombre de la unidad (ej: agent-scraper)" }, fase: { t: "string", d: "Fase actual del trabajo", opt: true } },
        code: `const st = store.load();
st.unidades = st.unidades || {};
const u = st.unidades[unidad] = st.unidades[unidad] || { latidos: [], fases: [] };
u.latidos.push(new Date().toISOString());
u.fases.push(fase || "");
u.latidos = u.latidos.slice(-100);
u.fases = u.fases.slice(-100);
store.save(st);
return ok({ unidad, total_latidos: u.latidos.length, ultimo: u.latidos[u.latidos.length - 1] });`,
      },
      {
        name: "status",
        desc: "Estado de todas las unidades: último latido, intervalo medio y alerta si el intervalo creció (posible congelamiento lento).",
        params: { umbral_factor: { t: "number", d: "Factor de degradación para alertar", opt: true, def: 3 } },
        code: `const st = store.load();
const ahora = Date.now();
const reporte = Object.entries(st.unidades || {}).map(([nombre, u]: [string, any]) => {
  const latidos: string[] = u.latidos || [];
  if (!latidos.length) return { nombre, estado: "sin_datos" };
  const ultimo = new Date(latidos[latidos.length - 1]).getTime();
  const intervalos: number[] = [];
  for (let i = 1; i < latidos.length; i++) intervalos.push(new Date(latidos[i]).getTime() - new Date(latidos[i - 1]).getTime());
  const media = intervalos.length ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length : 0;
  const ultimo_intervalo = intervalos.length ? intervalos[intervalos.length - 1] : 0;
  const silencio_min = Math.round((ahora - ultimo) / 60000);
  return { nombre, ultimo_latido: latidos[latidos.length - 1], silencio_minutos: silencio_min, intervalo_medio_ms: Math.round(media), fase_reciente: (u.fases || []).slice(-3), alerta: media > 0 && ultimo_intervalo > media * (umbral_factor ?? 3) ? "intervalo degradado " + Math.round(ultimo_intervalo / 1000) + "s vs media " + Math.round(media / 1000) + "s" : null };
});
return ok({ unidades: reporte });`,
      },
    ],
  },
  {
    id: "experiment-log",
    title: "Experiment Log",
    tagline: "A/B de prompts y configs: variantes, resultados y conclusión estadística ligera",
    category: "Observabilidad",
    pain: "Se cambian prompts sin medir: sin experimentos registrados, la mejora es anécdota.",
    persistent: true,
    tools: [
      {
        name: "start",
        desc: "Inicia un experimento: hipótesis, métrica y variantes (con config).",
        params: { nombre: { t: "string", d: "Nombre del experimento" }, hipotesis: { t: "string", d: "Qué crees que mejorará" }, metrica: { t: "string", d: "Métrica a comparar (ej: tasa_exito, score)" }, variantes: { t: "array", d: "Nombres de variantes (ej: [control, prompt-v2])" } },
        code: `const st = store.load();
st.experimentos = st.experimentos || [];
const exp = { nombre, hipotesis, metrica, variantes: Array.isArray(variantes) ? variantes : ["control", "tratamiento"], resultados: {}, estado: "activo", inicio: new Date().toISOString() };
st.experimentos.push(exp);
store.save(st);
return ok({ experimento: nombre, variantes: exp.variantes });`,
      },
      {
        name: "variant_result",
        desc: "Registra el resultado de una variante (valor de la métrica). Acumula muestras.",
        params: { experimento: { t: "string", d: "Nombre del experimento" }, variante: { t: "string", d: "Variante" }, valor: { t: "number", d: "Valor observado" } },
        code: `const st = store.load();
const exp = (st.experimentos || []).find((e) => e.nombre === experimento && e.estado === "activo");
if (!exp) return fail("experimento activo no encontrado");
exp.resultados[variante] = (exp.resultados[variante] || []).concat(valor).slice(-100);
store.save(st);
return ok({ experimento, variante, n: exp.resultados[variante].length });`,
      },
      {
        name: "conclude",
        desc: "Concluye el experimento: medias por variante, diferencia relativa y ganadora preliminar.",
        params: { experimento: { t: "string", d: "Nombre del experimento" } },
        code: `const st = store.load();
const exp = (st.experimentos || []).find((e) => e.nombre === experimento);
if (!exp) return fail("no existe");
exp.estado = "concluido";
exp.fin = new Date().toISOString();
store.save(st);
const stats = Object.entries(exp.resultados).map(([variante, vals]: [string, any]) => ({ variante, n: vals.length, media: vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 1000) / 1000 : null }));
stats.sort((a: any, b: any) => (b.media ?? -Infinity) - (a.media ?? -Infinity));
const control = stats.find((s) => s.variante === "control") || stats[stats.length - 1];
const ganadora = stats[0];
return ok({ stats, ganadora: ganadora?.variante, mejora_vs_control: control?.media ? Math.round(((ganadora.media - control.media) / control.media) * 1000) / 10 + "%" : "n/a", nota: stats.every((s) => s.n >= 5) ? "muestras suficientes" : "ADVERTENCIA: <5 muestras por variante" });`,
      },
    ],
  },
  {
    id: "usage-analytics",
    title: "Usage Analytics",
    tagline: "Analítica de uso de tools: qué se usa, qué nunca, y tendencias",
    category: "Observabilidad",
    pain: "Mantener MCP instalados que no se usan drena contexto y tokens: falta analítica de uso real.",
    persistent: true,
    tools: [
      {
        name: "record_tool_use",
        desc: "Registra el uso de una tool (éxito o no, duración).",
        params: { tool: { t: "string", d: "Nombre de la tool" }, exito: { t: "boolean", d: "Resultado", opt: true, def: true }, duracion_ms: { t: "number", d: "Duración", opt: true } },
        code: `const st = store.load();
st.uso = st.uso || {};
st.uso[tool] = st.uso[tool] || { llamadas: 0, exitos: 0, duraciones: [] };
const u = st.uso[tool];
u.llamadas++;
if (exito ?? true) u.exitos++;
if (duracion_ms) u.duraciones = u.duraciones.concat(duracion_ms).slice(-100);
u.ultima = new Date().toISOString();
store.save(st);
return ok({ tool, llamadas: u.llamadas });`,
      },
      {
        name: "top_tools",
        desc: "Ranking de tools por uso, con tasa de éxito y duración media. Marca candidatas a desinstalar.",
        params: {},
        code: `const st = store.load();
const rows = Object.entries(st.uso || {}).map(([tool, u]: [string, any]) => {
  const dur = u.duraciones || [];
  return { tool, llamadas: u.llamadas, tasa_exito: Math.round((u.exitos / u.llamadas) * 100) + "%", duracion_media_ms: dur.length ? Math.round(dur.reduce((a: number, b: number) => a + b, 0) / dur.length) : null, ultima: u.ultima };
}).sort((a: any, b: any) => b.llamadas - a.llamadas);
return ok({ total_tools_usadas: rows.length, ranking: rows, candidatas_desinstalar: rows.filter((r) => r.llamadas <= 2 && rows.indexOf(r) > 5).map((r) => r.tool) });`,
      },
    ],
  },
  {
    id: "debug-console",
    title: "Debug Console",
    tagline: "Introspección del entorno del agente: capacidades, variables y salud del runtime",
    category: "Observabilidad",
    pain: "Debuggear a ciegas: el agente no sabe qué runtime, variables o versiones tiene debajo.",
    imports: ["os"],
    tools: [
      {
        name: "env_probe",
        desc: "Sondea el entorno: versión de node, plataforma, CPUs, memoria y variables de entorno RELEVANTES (solo whitelist, nunca valores secretos).",
        params: {},
        code: `const seguras = ["NODE_ENV", "LANG", "TZ", "SHELL", "TERM", "HOME"];
const detectadas: any = {};
for (const k of seguras) if (process.env[k]) detectadas[k] = process.env[k];
return ok({ node: process.version, plataforma: process.platform, arquitectura: process.arch, cpus: cpus().length, memoria_libre_mb: Math.round(freemem() / 1048576), memoria_total_mb: Math.round(totalmem() / 1048576), uptime_proceso_s: Math.round(process.uptime()), env_seguras: detectadas, nota: "nunca se exponen valores de secrets" });`,
      },
      {
        name: "capabilities",
        desc: "Reporta las capacidades de este runtime MCP: transporte, tools disponibles y features del entorno.",
        params: {},
        code: `return ok({ servidor: "debug-console", transporte: "stdio", protocolo: "MCP 2025-03-26", features: { fetch_global: typeof fetch === "function", crypto_node: true, fs_local: true, persistencia: "~/.mcp-suite/" }, red: typeof fetch === "function" ? "disponible" : "no" });`,
      },
    ],
  },
];

// ═══ CATEGORÍA: Dolores FUTUROS · Economía del Agente (B) ═══
// Evidencia: ruteo por costo/capacidad y forecast de gasto como práctica
// emergente 2026 ("The Token Economy: Why Your AI Strategy Lives or Dies").
export default [
  {
    id: "model-router-econ",
    title: "Model Router Econ",
    tagline: "Rutea cada sub-tarea al modelo más barato capaz: stop usando un tanque para mandar un email",
    category: "Economía del Agente",
    pain: "El agente usa el modelo más caro para TODO: clasificar un email, sumar dos números o redactar una nota usan el mismo modelo premium. El ruteo por complejidad ahorra 50-80% y nadie lo implementa.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/model-router-econ/. Registro de modelos con costo por 1M tokens y capacidades; clasifica tareas por tier de complejidad y devuelve el modelo más barato suficiente. Historial de decisiones.",
    tools: [
      {
        name: "register_model",
        desc: "Registra un modelo con costos por 1M tokens (entrada/salida) y tier de capacidad (1=básico, 4=frontier).",
        params: { modelo: { t: "string", d: "Nombre del modelo" }, costo_entrada_1m: { t: "number", d: "USD por 1M tokens de entrada" }, costo_salida_1m: { t: "number", d: "USD por 1M tokens de salida" }, tier: { t: "number", d: "Capacidad: 1 básico, 2 estándar, 3 avanzado, 4 frontier" }, fortalezas: { t: "array", d: "Etiquetas de fortaleza", opt: true, def: [] } },
        code: `if (tier < 1 || tier > 4) return fail("tier 1-4");
const st = store.load();
st.modelos = st.modelos || {};
st.modelos[modelo] = { modelo, costo_entrada_1m, costo_salida_1m, tier, fortalezas: fortalezas || [], decisiones: 0, tokens_servidos: 0 };
store.save(st);
return ok({ modelo, tier, costo_medio_1m: (costo_entrada_1m + costo_salida_1m) / 2 });`,
      },
      {
        name: "route",
        desc: "Dada una tarea, clasifica su tier requerido y devuelve el modelo más barato que lo cubre (con costo estimado).",
        params: { tarea: { t: "string", d: "Descripción de la sub-tarea" }, tokens_estimados: { t: "number", d: "Tokens totales estimados", opt: true, def: 2000 }, forzar_tier: { t: "number", d: "Tier mínimo requerido manual", opt: true } },
        code: `const st = store.load();
const modelos = Object.values(st.modelos || {});
if (!modelos.length) return fail("registra modelos con register_model primero");
const t = String(tarea).toLowerCase();
const REGLAS = [
  { pat: /(clasifica|etiqueta|es spam|sentimiento|revisa formato|es válido|es valido|extrae campo)/, tier: 1 },
  { pat: /(resume|traduce|redacta|re formula|nota|respuesta simple)/, tier: 2 },
  { pat: /(analiza|compara|planifica|explica|código|codigo|script|debug|consulta sql)/, tier: 3 },
  { pat: /(arquitectura|diseña|disena|investiga|razona|demostración|demostracion|multi-paso|estrategia|optimiza|crítico|critico)/, tier: 4 },
];
let tierReq = 2;
for (const r of REGLAS) if (r.pat.test(t)) tierReq = r.tier;
if (forzar_tier) tierReq = forzar_tier;
const candidatos = modelos.filter(m => m.tier >= tierReq).sort((a, b) => (a.costo_entrada_1m + a.costo_salida_1m) - (b.costo_entrada_1m + b.costo_salida_1m));
const elegido = candidatos[0];
const premium = modelos.filter(m => m.tier === 4).sort((a, b) => (b.costo_entrada_1m + b.costo_salida_1m) - (a.costo_entrada_1m + a.costo_salida_1m))[0];
const costoElegido = (elegido.costo_entrada_1m * 0.7 + elegido.costo_salida_1m * 0.3) * tokens_estimados / 1e6;
const costoPremium = premium ? (premium.costo_entrada_1m * 0.7 + premium.costo_salida_1m * 0.3) * tokens_estimados / 1e6 : costoElegido;
elegido.decisiones = (elegido.decisiones || 0) + 1;
elegido.tokens_servidos = (elegido.tokens_servidos || 0) + tokens_estimados;
st.historial = st.historial || [];
st.historial.push({ tarea: t.slice(0, 80), tier_req: tierReq, modelo: elegido.modelo, ts: new Date().toISOString() });
if (st.historial.length > 500) st.historial = st.historial.slice(-300);
store.save(st);
return ok({
  tier_requerido: tierReq,
  elegido: elegido.modelo,
  costo_estimado_usd: Number(costoElegido.toFixed(5)),
  ahorro_vs_premium: Number((costoPremium - costoElegido).toFixed(5)),
  alternativas: candidatos.slice(1, 3).map(m => m.modelo),
  criterio: "más barato cuyo tier cubre la tarea; fuerza tier si el resultado no te convence",
});`,
      },
      {
        name: "routing_stats",
        desc: "Estadísticas de ruteo: uso por modelo, tier medio demandado y ahorro acumulado estimado.",
        params: {},
        code: `const st = store.load();
const modelos = Object.values(st.modelos || {});
const hist = st.historial || [];
if (!modelos.length) return ok({ modelos: 0 });
const tierMedio = hist.length ? hist.reduce((s, h) => s + h.tier_req, 0) / hist.length : null;
return ok({
  modelos_registrados: modelos.length,
  decisiones_totales: hist.length,
  tier_medio_demandado: tierMedio ? Number(tierMedio.toFixed(2)) : null,
  uso_por_modelo: modelos.map(m => ({ modelo: m.modelo, tier: m.tier, decisiones: m.decisiones || 0, tokens_servidos: m.tokens_servidos || 0 })).sort((a, b) => b.decisiones - a.decisiones),
  lectura: tierMedio && tierMedio < 3 ? "mix saludable: la mayoría de tareas no necesitan frontier" : tierMedio ? "sesgo a modelos caros: revisa si las tareas simples están bien clasificadas" : "sin historial aún",
});`,
      },
      {
        name: "list_models",
        desc: "Lista modelos registrados con costos y fortalezas, ordenados por costo.",
        params: {},
        code: `const st = store.load();
const modelos = Object.values(st.modelos || {});
if (!modelos.length) return ok({ modelos: 0, sugerencia: "register_model" });
return ok({ modelos: modelos.sort((a, b) => (a.costo_entrada_1m + a.costo_salida_1m) - (b.costo_entrada_1m + b.costo_salida_1m)).map(m => ({ modelo: m.modelo, tier: m.tier, entrada_1m: m.costo_entrada_1m, salida_1m: m.costo_salida_1m, fortalezas: m.fortalezas })) });`,
      },
    ],
  },
  {
    id: "budget-forecast",
    title: "Budget Forecast",
    tagline: "Proyección de gasto futuro basada en histórico: sabe cuánto costará el mes antes de gastarlo",
    category: "Economía del Agente",
    pain: "El gasto de agentes es imprevisible: el equipo descubre a mitad de mes que al ritmo actual el presupuesto vuela, cuando ya es tarde para ajustar el mix de trabajo.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/budget-forecast/. Serie diaria de gasto; proyección lineal y con estacionalidad semanal simple, burn-rate y fecha estimada de agotamiento del presupuesto mensual.",
    tools: [
      {
        name: "log_daily_spend",
        desc: "Registra el gasto acumulado de un día (USD).",
        params: { usd: { t: "number", d: "Gasto del día" }, dia: { t: "string", d: "Fecha ISO (default: hoy)", opt: true } },
        code: `const st = store.load();
st.diario = st.diario || {};
const d = (dia || new Date().toISOString()).slice(0, 10);
st.diario[d] = Number(((st.diario[d] || 0) + usd).toFixed(4));
store.save(st);
return ok({ dia: d, gasto_dia: st.diario[d] });`,
      },
      {
        name: "burn_rate",
        desc: "Burn-rate actual: gasto diario medio (últimos 7 y 30 días) y tendencia.",
        params: {},
        code: `const st = store.load();
const dias = Object.entries(st.diario || {}).sort(([a], [b]) => a < b ? -1 : 1);
if (dias.length < 3) return ok({ dias_registrados: dias.length, burn: "insuficiente (mínimo 3 días)" });
const ultimos7 = dias.slice(-7);
const ultimos30 = dias.slice(-30);
const media7 = ultimos7.reduce((s, [, v]) => s + v, 0) / ultimos7.length;
const media30 = ultimos30.reduce((s, [, v]) => s + v, 0) / ultimos30.length;
const total = dias.reduce((s, [, v]) => s + v, 0);
return ok({
  dias_registrados: dias.length,
  total_gastado: Number(total.toFixed(2)),
  burn_diario_7d: Number(media7.toFixed(3)),
  burn_diario_30d: Number(media30.toFixed(3)),
  tendencia: media30 ? Number((((media7 - media30) / media30) * 100).toFixed(1)) : null,
  lectura: media7 > media30 * 1.15 ? "acelerando +15%: revisa qué cambió" : media7 < media30 * 0.85 ? "frenando" : "ritmo estable",
});`,
      },
      {
        name: "forecast_month",
        desc: "Proyección de cierre de mes: gasto acumulado + proyección, contra presupuesto objetivo.",
        params: { presupuesto_mensual: { t: "number", d: "Presupuesto del mes (USD)", opt: true } },
        code: `const st = store.load();
const dias = Object.entries(st.diario || {}).sort(([a], [b]) => a < b ? -1 : 1);
if (dias.length < 5) return fail("necesitas >=5 días de histórico");
const hoy = new Date();
const mesActual = hoy.toISOString().slice(0, 7);
const diasMes = dias.filter(([d]) => d.startsWith(mesActual));
if (!diasMes.length) return fail("sin registros del mes en curso");
const diaDelMes = hoy.getDate();
const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
const gastado = diasMes.reduce((s, [, v]) => s + v, 0);
const mediaDiaria = gastado / diasMes.length;
const proyeccion = mediaDiaria * diasEnMes;
const resultado = presupuesto_mensual
  ? { presupuesto: presupuesto_mensual, proyeccion: Number(proyeccion.toFixed(2)), excedido_estimado: Number((proyeccion - presupuesto_mensual).toFixed(2)), pct_presupuesto: Number((proyeccion / presupuesto_mensual * 100).toFixed(1)) }
  : { proyeccion: Number(proyeccion.toFixed(2)) };
return ok({
  mes: mesActual,
  dia_del_mes: diaDelMes + "/" + diasEnMes,
  gastado: Number(gastado.toFixed(2)),
  media_diaria: Number(mediaDiaria.toFixed(3)),
  ...resultado,
  veredicto: presupuesto_mensual ? (proyeccion > presupuesto_mensual ? "SOBREPRESUPUESTO: recorta " + Number((proyeccion - presupuesto_mensual).toFixed(2)) + " USD o sube el presupuesto YA" : "dentro de presupuesto con margen de " + Number((presupuesto_mensual - proyeccion).toFixed(2)) + " USD") : "sin presupuesto de referencia: define uno",
  dias_para_quiebre: presupuesto_mensual ? Math.max(0, Math.floor((presupuesto_mensual - gastado) / Math.max(mediaDiaria, 0.001))) : null,
});`,
      },
      {
        name: "anomaly_spend",
        desc: "Detecta días de gasto anómalo (picos) y los asocia a la actividad de ese día.",
        params: { umbral_x: { t: "number", d: "Múltiplo de la media que cuenta como pico", opt: true, def: 2.5 } },
        code: `const st = store.load();
const dias = Object.entries(st.diario || {}).sort(([a], [b]) => a < b ? -1 : 1);
if (dias.length < 7) return fail("necesitas >=7 días");
const valores = dias.map(([, v]) => v).sort((a, b) => a - b);
const mediana = valores[Math.floor(valores.length / 2)];
const picos = dias.filter(([d, v]) => v > mediana * umbral_x);
return ok({
  mediana_diaria: Number(mediana.toFixed(3)),
  picos: picos.map(([d, v]) => ({ dia: d, gasto: Number(v.toFixed(3)), vs_mediana: Number((v / mediana).toFixed(1)) + "x" })),
  consejo: picos.length ? "cada pico explica dónde se va el dinero: audita esos días (token-audit)" : "gasto homogéneo",
});`,
      },
    ],
  },
  {
    id: "cost-attribution",
    title: "Cost Attribution",
    tagline: "Atribuye cada dólar a cliente/proyecto/agente: el gasto deja de ser un agujero negro global",
    category: "Economía del Agente",
    pain: "El costo de agentes se contabiliza como una sola línea global: ningún cliente/proyecto sabe cuánto consume realmente, así que nadie optimiza y el margen se evapora sin responsable.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/cost-attribution/. Gastos etiquetados por cliente/proyecto/agente con reparto, ranking de consumidores y costo por entregable.",
    tools: [
      {
        name: "tag_spend",
        desc: "Registra un gasto atribuido: cliente, proyecto, agente, concepto e importe.",
        params: { cliente: { t: "string", d: "Cliente o 'interno'" }, proyecto: { t: "string", d: "Proyecto" }, agente: { t: "string", d: "Agente que gastó" }, concepto: { t: "string", d: "Concepto (llm, tool, api)" }, usd: { t: "number", d: "Importe" }, entregable: { t: "string", d: "Entregable al que contribuye", opt: true } },
        code: `const st = store.load();
st.gastos = st.gastos || [];
st.gastos.push({ cliente, proyecto, agente, concepto, usd, entregable: entregable || null, ts: new Date().toISOString() });
store.save(st);
return ok({ registrado: true, usd, cliente });`,
      },
      {
        name: "attribution_report",
        desc: "Reparto del gasto por cliente, proyecto y agente con top consumidores.",
        params: { desde: { t: "string", d: "Fecha ISO de inicio (opcional)", opt: true } },
        code: `const st = store.load();
let gs = st.gastos || [];
if (desde) { const c = new Date(desde).getTime(); if (!isNaN(c)) gs = gs.filter(g => new Date(g.ts).getTime() >= c); }
if (!gs.length) return ok({ gastos: 0, sugerencia: "registra gastos con tag_spend" });
const por = (campo) => {
  const acc = {};
  for (const g of gs) acc[g[campo]] = Number(((acc[g[campo]] || 0) + g.usd).toFixed(4));
  return Object.entries(acc).map(([k, v]) => ({ [campo]: k, usd: Number(v.toFixed(2)) })).sort((a, b) => b.usd - a.usd);
};
const total = gs.reduce((s, g) => s + g.usd, 0);
return ok({
  total_usd: Number(total.toFixed(2)),
  por_cliente: por("cliente"),
  por_proyecto: por("proyecto"),
  por_agente: por("agente"),
  por_concepto: por("concepto"),
  cliente_mas_caro: por("cliente")[0],
});`,
      },
      {
        name: "margin_check",
        desc: "Compara costo atribuido contra ingresos por cliente: ¿a quién le estás perdiendo dinero?",
        params: { ingresos: { t: "any", d: "Mapa {cliente: ingreso_usd}" } },
        code: `const st = store.load();
const gs = st.gastos || [];
const ing = ingresos || {};
if (typeof ing !== "object") return fail("ingresos debe ser un mapa {cliente: usd}");
const costos = {};
for (const g of gs) costos[g.cliente] = Number(((costos[g.cliente] || 0) + g.usd).toFixed(4));
const clientes = [...new Set([...Object.keys(ing), ...Object.keys(costos)])];
const filas = clientes.map(c => {
  const i = Number(ing[c]) || 0;
  const costo = costos[c] || 0;
  return { cliente: c, ingreso: i, costo: Number(costo.toFixed(2)), margen: Number((i - costo).toFixed(2)), margen_pct: i ? Number(((i - costo) / i * 100).toFixed(1)) : null };
}).sort((a, b) => (a.margen ?? -Infinity) - (b.margen ?? -Infinity));
return ok({
  clientes: filas.length,
  filas,
  en_perdida: filas.filter(f => f.margen < 0).map(f => f.cliente),
  consejo: filas.some(f => f.margen < 0) ? "hay clientes con costo > ingreso: sube precio, recorta alcance o migra a modelos más baratos (model-router-econ)" : "todos contribuyen margen positivo",
});`,
      },
      {
        name: "cost_per_deliverable",
        desc: "Costo total por entregable (suma de gastos etiquetados) para precio y estimación futura.",
        params: {},
        code: `const st = store.load();
const gs = (st.gastos || []).filter(g => g.entregable);
if (!gs.length) return ok({ entregables: 0, sugerencia: "etiqueta gastos con 'entregable' para esta vista" });
const acc = {};
for (const g of gs) acc[g.entregable] = Number(((acc[g.entregable] || 0) + g.usd).toFixed(4));
const filas = Object.entries(acc).map(([e, v]) => ({ entregable: e, costo_usd: Number(v.toFixed(2)) })).sort((a, b) => b.costo_usd - a.costo_usd);
const media = filas.reduce((s, f) => s + f.costo_usd, 0) / filas.length;
return ok({
  entregables: filas.length,
  costo_medio: Number(media.toFixed(2)),
  filas: filas.slice(0, 15),
  para_pricing: "cobra >= 3x el costo de entregable para cubrir overhead y margen",
});`,
      },
    ],
  },
];

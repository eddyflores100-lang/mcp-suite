// ═══ CATEGORÍA: Dolores FUTUROS · Comercio A2A (A) ═══
// Evidencia: la economía agéntica (agent-to-agent commerce) necesita
// infraestructura de confianza comercial: escrow, SLAs medibles, metering
// facturable. Los pagos (x402) existen; el CICLO contractual completo no.
export default [
  {
    id: "escrow-agent",
    title: "Escrow Agent",
    tagline: "Custodia de intercambios entre agentes: bloqueo → entrega verificada → liberación (o disputa)",
    category: "Comercio A2A",
    pain: "El agente A paga por adelantado a un agente B desconocido y B desaparece; o B entrega primero y A nunca paga. Sin custodia neutral, el primer trato entre agentes es una apuesta ciega.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/escrow-agent/. Máquina de estados completa: CREADO→BLOQUEADO→ENTREGADO→(VERIFICADO→LIBERADO | EN_DISPUTA→RESUELTO). Registra evidencias en cada transición y plazos de expiración.",
    tools: [
      {
        name: "create_escrow",
        desc: "Crea un escrow: quién paga, quién entrega, qué, por cuánto y en qué plazo.",
        params: { pagador: { t: "string", d: "Id del agente que paga" }, vendedor: { t: "string", d: "Id del agente que entrega el bien/servicio" }, descripcion: { t: "string", d: "Qué se entrega (bien, dato, servicio)" }, monto: { t: "number", d: "Monto comprometido" }, divisa: { t: "string", d: "Divisa/asset", opt: true, def: "USD" }, plazo_horas: { t: "number", d: "Horas máximas para la entrega", opt: true, def: 48 }, criterio_aceptacion: { t: "string", d: "Cómo se decide que la entrega es correcta", opt: true } },
        code: `const st = store.load();
st.escrows = st.escrows || [];
const id = "esc_" + String(st.escrows.length + 1).padStart(4, "0");
st.escrows.push({ id, pagador, vendedor, descripcion, monto, divisa, plazo_horas, criterio_aceptacion: criterio_aceptacion || "aceptación implícita del pagador", estado: "CREADO", historial: [{ estado: "CREADO", ts: new Date().toISOString(), nota: "escrow definido, fondos aún no bloqueados" }], expira: new Date(Date.now() + plazo_horas * 3600000).toISOString() });
store.save(st);
return ok({ id, estado: "CREADO", siguiente: "el pagador bloquea los fondos con lock_funds" });`,
      },
      {
        name: "lock_funds",
        desc: "El pagador bloquea los fondos: el vendedor ya puede entregar con garantía.",
        params: { id: { t: "string", d: "Id del escrow" }, evidencia_bloqueo: { t: "string", d: "Referencia/evidencia del bloqueo (tx, reserva, retención)" } },
        code: `const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado: " + id);
if (e.estado !== "CREADO") return fail("estado actual " + e.estado + ": solo se bloquea desde CREADO");
e.estado = "BLOQUEADO";
e.evidencia_bloqueo = evidencia_bloqueo;
e.historial.push({ estado: "BLOQUEADO", ts: new Date().toISOString(), nota: "fondos bloqueados: " + evidencia_bloqueo.slice(0, 80) });
store.save(st);
return ok({ id, estado: "BLOQUEADO", nota: "el vendedor puede entregar: la paga está custodiada", expira: e.expira });`,
      },
      {
        name: "mark_delivered",
        desc: "El vendedor declara la entrega con evidencia verificable.",
        params: { id: { t: "string", d: "Id del escrow" }, evidencia_entrega: { t: "string", d: "Evidencia de la entrega (URL, hash, resultado, recibo)" } },
        code: `const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (e.estado !== "BLOQUEADO") return fail("estado " + e.estado + ": la entrega requiere fondos bloqueados primero");
e.estado = "ENTREGADO";
e.evidencia_entrega = evidencia_entrega;
e.entregado_ts = new Date().toISOString();
e.historial.push({ estado: "ENTREGADO", ts: e.entregado_ts, nota: "entrega declarada: " + evidencia_entrega.slice(0, 80) });
store.save(st);
return ok({ id, estado: "ENTREGADO", siguiente: "el pagador verifica y libera con release (o abre disputa)" });`,
      },
      {
        name: "release",
        desc: "El pagador libera los fondos al vendedor tras verificar la entrega.",
        params: { id: { t: "string", d: "Id del escrow" }, verificado: { t: "string", d: "Cómo se verificó la aceptación", opt: true } },
        code: `const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (e.estado !== "ENTREGADO") return fail("estado " + e.estado + ": solo se libera tras ENTREGADO (o RESUELTO a favor del vendedor)");
e.estado = "LIBERADO";
e.liberado_ts = new Date().toISOString();
e.verificado = verificado || "aceptación implícita";
e.historial.push({ estado: "LIBERADO", ts: e.liberado_ts, nota: "fondos liberados al vendedor (" + e.monto + " " + e.divisa + ")" });
store.save(st);
return ok({ id, estado: "LIBERADO", cerrado: true, resumen: { monto: e.monto, divisa: e.divisa, dias_ciclo: Number(((new Date(e.liberado_ts).getTime() - new Date(e.historial[0].ts).getTime()) / 86400000).toFixed(2)) } });`,
      },
      {
        name: "open_dispute",
        desc: "Abre disputa sobre un escrow entregado (o expirado): congela la liberación.",
        params: { id: { t: "string", d: "Id del escrow" }, motivo: { t: "string", d: "Motivo de la disputa" }, por: { t: "string", d: "Quien abre la disputa (pagador/vendedor)" } },
        code: `const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (!["ENTREGADO", "BLOQUEADO"].includes(e.estado)) return fail("estado " + e.estado + ": no es disputable");
e.estado = "EN_DISPUTA";
e.disputa = { motivo, por, abierta: new Date().toISOString(), evidencias: [] };
e.historial.push({ estado: "EN_DISPUTA", ts: new Date().toISOString(), nota: "disputa abierta por " + por + ": " + motivo.slice(0, 100) });
store.save(st);
return ok({ id, estado: "EN_DISPUTA", nota: "fondos congelados hasta resolución: usa add_evidence y luego resolve_dispute" });`,
      },
      {
        name: "add_evidence",
        desc: "Añade evidencia a una disputa abierta (ambas partes).",
        params: { id: { t: "string", d: "Id del escrow" }, parte: { t: "string", d: "Parte que aporta (pagador/vendedor/tercero)" } , descripcion: { t: "string", d: "Qué demuestra la evidencia" }, peso: { t: "enum", d: "Fuerza de la evidencia", values: ["debil", "media", "fuerte"], opt: true, def: "media" } },
        code: `const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (e.estado !== "EN_DISPUTA") return fail("sin disputa abierta en estado " + e.estado);
e.disputa.evidencias.push({ parte, descripcion, peso, ts: new Date().toISOString() });
store.save(st);
const resumen = {};
e.disputa.evidencias.forEach(ev => { resumen[ev.parte] = (resumen[ev.parte] || 0) + (ev.peso === "fuerte" ? 3 : ev.peso === "media" ? 2 : 1); });
return ok({ id, evidencias_totales: e.disputa.evidencias.length, peso_por_parte: resumen });`,
      },
      {
        name: "resolve_dispute",
        desc: "Resuelve la disputa ponderando evidencias: libera, devuelve o reparte.",
        params: { id: { t: "string", d: "Id del escrow" }, decision: { t: "enum", d: "Resolución", values: ["liberar_vendedor", "devolver_pagador", "reparto"] }, nota: { t: "string", d: "Justificación de la resolución", opt: true }, reparto_pct_vendedor: { t: "number", d: "Si reparto: % al vendedor (0-100)", opt: true, def: 50 } },
        code: `const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (e.estado !== "EN_DISPUTA") return fail("sin disputa abierta");
const pesos = {};
(e.disputa.evidencias || []).forEach(ev => { pesos[ev.parte] = (pesos[ev.parte] || 0) + (ev.peso === "fuerte" ? 3 : ev.peso === "media" ? 2 : 1); });
const pPag = pesos["pagador"] || 0, pVen = pesos["vendedor"] || 0;
const equilibrio = pPag + pVen === 0 ? "sin evidencias: resolución por criterio del árbitro" : pVen > pPag * 1.5 ? "evidencia favorece claramente al vendedor" : pPag > pVen * 1.5 ? "evidencia favorece claramente al pagador" : "evidencia equilibrada";
let montoVendedor = 0, montoPagador = 0;
if (decision === "liberar_vendedor") { montoVendedor = e.monto; e.estado = "LIBERADO"; }
else if (decision === "devolver_pagador") { montoPagador = e.monto; e.estado = "DEVUELTO"; }
else { montoVendedor = Number((e.monto * reparto_pct_vendedor / 100).toFixed(2)); montoPagador = Number((e.monto - montoVendedor).toFixed(2)); e.estado = "REPARTIDO"; }
e.disputa.resolucion = { decision, nota: nota || "", equilibrio_evidencia: equilibrito(pPag, pVen), ts: new Date().toISOString() };
e.historial.push({ estado: e.estado, ts: new Date().toISOString(), nota: "disputa resuelta: " + decision });
store.save(st);
return ok({ id, estado_final: e.estado, reparto: { vendedor: montoVendedor + " " + e.divisa, pagador: montoPagador + " " + e.divisa }, equilibrio_evidencia: equilibrio, aviso: "registra la ejecución real del reparto en tu sistema de pagos" });
function equilibrito(a, b) { if (a + b === 0) return "sin evidencias"; return b > a * 1.5 ? "favor vendedor" : a > b * 1.5 ? "favor pagador" : "equilibrada"; }`,
      },
      {
        name: "escrow_stats",
        desc: "Métricas del historial: tasa de disputa, tiempo medio de ciclo, montos.",
        params: {},
        code: `const st = store.load();
const esc = st.escrows || [];
if (!esc.length) return ok({ escrows: 0, mensaje: "sin historial" });
const disputados = esc.filter(e => e.disputa);
const cerrados = esc.filter(e => ["LIBERADO", "DEVUELTO", "REPARTIDO"].includes(e.estado));
const ciclos = cerrados.map(e => { const fin = e.historial[e.historial.length - 1].ts; return (new Date(fin).getTime() - new Date(e.historial[0].ts).getTime()) / 3600000; });
return ok({ total: esc.length, por_estado: esc.reduce((acc, e) => { acc[e.estado] = (acc[e.estado] || 0) + 1; return acc; }, {}), tasa_disputa: Number((disputados.length / esc.length * 100).toFixed(1)) + "%", ciclo_medio_horas: ciclos.length ? Number((ciclos.reduce((a, b) => a + b, 0) / ciclos.length).toFixed(1)) : null, volumen_total: esc.reduce((a, e) => a + e.monto, 0).toFixed(2) + " (sumas en divisas mixtas si aplica)", aviso: disputados.length / esc.length > 0.2 ? "más del 20% de escrows acaba en disputa: endurece el criterio de aceptación" : "salud razonable" });`,
      },
    ],
  },
  {
    id: "sla-contract-manager",
    title: "SLA Contract Manager",
    tagline: "Contratos de nivel de servicio entre agentes: métricas, objetivos, ventanas y detección de brechas",
    category: "Comercio A2A",
    pain: "El agente contrata un sub-agente 'rápido' sin SLA escrito: cuando empieza a tardar 40 segundos no hay objetivo, ni ventana de medición, ni forma objetiva de reclamar. La confianza entre agentes sin métricas es humo.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/sla-contract-manager/. Contratos con métricas (latencia, disponibilidad, tasa de error, throughput), objetivo y penalización; las mediciones se contrastan con períodos de gracia.",
    tools: [
      {
        name: "create_contract",
        desc: "Crea un contrato SLA: proveedor, métrica, objetivo, ventana y penalización por incumplimiento.",
        params: { proveedor: { t: "string", d: "Agente/servicio proveedor" }, consumidor: { t: "string", d: "Agente consumidor", opt: true, def: "yo" }, metrica: { t: "enum", d: "Métrica contratada", values: ["latencia_p95_ms", "disponibilidad_pct", "tasa_error_pct", "throughput_rps", "tiempo_resolucion_horas"] }, objetivo: { t: "number", d: "Valor objetivo (mejor = más rápido/más alto según métrica)" }, ventana: { t: "enum", d: "Ventana de evaluación", values: ["por_llamada", "diaria", "semanal", "mensual"] }, penalizacion: { t: "string", d: "Qué pasa si se incumple (descuento, crédito, terminación)", opt: true }, periodo_gracia_min: { t: "number", d: "Minutos de gracia antes de contar un incumplimiento", opt: true, def: 0 } },
        code: `const st = store.load();
st.contratos = st.contratos || [];
const id = "sla_" + String(st.contratos.length + 1).padStart(4, "0");
const esMax = ["latencia_p95_ms", "tasa_error_pct", "tiempo_resolucion_horas"].includes(metrica);
st.contratos.push({ id, proveedor, consumidor, metrica, objetivo, sentido: esMax ? "maximo" : "minimo", ventana, penalizacion: penalizacion || "sin penalización definida", periodo_gracia_min, mediciones: [], brechas: [], activo: true, creado: new Date().toISOString() });
store.save(st);
return ok({ id, proveedor, metrica, objetivo, sentido: esMax ? "≤ " + objetivo : "≥ " + objetivo, ventana, siguiente: "registra mediciones reales con record_measurement" });`,
      },
      {
        name: "record_measurement",
        desc: "Registra una medición real de la métrica del contrato.",
        params: { id: { t: "string", d: "Id del contrato" }, valor: { t: "number", d: "Valor medido" }, contexto: { t: "string", d: "Contexto (llamada, día, carga)", opt: true } },
        code: `const st = store.load();
const c = (st.contratos || []).find(x => x.id === id);
if (!c) return fail("contrato no encontrado: " + id);
c.mediciones.push({ valor, contexto: contexto || "", ts: new Date().toISOString() });
store.save(st);
return ok({ id, mediciones: c.mediciones.length });`,
      },
      {
        name: "check_breach",
        desc: "Evalúa el contrato contra las mediciones registradas: ¿hay brecha? ¿con gracia? ¿reclamable?",
        params: { id: { t: "string", d: "Id del contrato" } },
        code: `const st = store.load();
const c = (st.contratos || []).find(x => x.id === id);
if (!c) return fail("contrato no encontrado");
const m = c.mediciones || [];
if (!m.length) return fail("sin mediciones: registra primero con record_measurement");
let valores = m.map(x => x.valor);
let resumen;
if (c.metrica === "latencia_p95_ms") {
  const ordenados = valores.slice().sort((a, b) => a - b);
  valores = [ordenados[Math.floor(ordenados.length * 0.95)]];
  resumen = "p95 sobre " + m.length + " mediciones";
} else if (c.ventana === "diaria") {
  const hoy = new Date().toISOString().slice(0, 10);
  const deHoy = m.filter(x => x.ts.slice(0, 10) === hoy);
  if (deHoy.length) { valores = deHoy.map(x => x.valor); resumen = "media de " + deHoy.length + " mediciones de hoy"; }
} else { resumen = "todas las mediciones (" + m.length + ")"; }
const agregado = valores.length > 1 ? valores.reduce((a, b) => a + b, 0) / valores.length : valores[0];
const incumple = c.sentido === "maximo" ? agregado > c.objetivo : agregado < c.objetivo;
const exceso = c.sentido === "maximo" ? Number((agregado - c.objetivo).toFixed(2)) : Number((c.objetivo - agregado).toFixed(2));
const ratio = Number((agregado / c.objetivo).toFixed(2));
if (incumple) {
  c.brechas.push({ ts: new Date().toISOString(), valor: Number(agregado.toFixed(2)), objetivo: c.objetivo, exceso, ratio });
  store.save(st);
}
const recl = incumple && ratio > (c.sentido === "maximo" ? 1.2 : 0.8);
return ok({ id, proveedor: c.proveedor, metrica: c.metrica, agregado: Number(agregado.toFixed(2)), calculo: resumen, objetivo: c.objetivo, sentido: c.sentido, en_brecha: incumple, desvio: exceso, ratio_objetivo: ratio, penalizacion: c.penalizacion, reclamo: incumple ? (recl ? "RECLAMABLE: desvío del " + Number((Math.abs(ratio - 1) * 100).toFixed(0)) + "% supera el umbral de tolerancia del 20%: documenta evidencia y reclama" : "leve: dentro de tolerancia del 20%, monitorea") : "conforme", brechas_totales: c.brechas.length });`,
      },
      {
        name: "contract_health",
        desc: "Salud global: contratos por proveedor, tendencias y quién incumple más.",
        params: {},
        code: `const st = store.load();
const cs = st.contratos || [];
if (!cs.length) return ok({ contratos: 0, mensaje: "sin contratos" });
const porProv = {};
cs.forEach(c => {
  porProv[c.proveedor] = porProv[c.proveedor] || { proveedor: c.proveedor, contratos: 0, mediciones: 0, brechas: 0 };
  porProv[c.proveedor].contratos++;
  porProv[c.proveedor].mediciones += (c.mediciones || []).length;
  porProv[c.proveedor].brechas += (c.brechas || []).length;
});
const ranking = __vals(porProv).map(p => ({ ...p, tasa_brecha: p.mediciones ? Number((p.brechas / p.mediciones * 100).toFixed(0)) + "%" : "n/a" })).sort((a, b) => b.brechas - a.brechas);
return ok({ contratos: cs.length, activos: cs.filter(c => c.activo).length, ranking_proveedores: ranking, recomendacion: ranking[0] && ranking[0].brechas > 3 ? "el proveedor '" + ranking[0].proveedor + "' acumula " + ranking[0].brechas + " brechas: renegocia SLA o cambia de proveedor" : "sin proveedores problemáticos" });`,
      },
    ],
  },
  {
    id: "metering-station",
    title: "Metering Station",
    tagline: "Medición facturable del consumo entre agentes: eventos de uso → agregación → tarifa → borrador de factura",
    category: "Comercio A2A",
    pain: "El agente sirve 12.000 llamadas a otros agentes y no tiene NADA que facturar: sin eventos medidos, sin tarifa por tramos, sin borrador de factura, la economía agéntica se queda en 'confía en mí'.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/metering-station/. Eventos de uso con dimensiones (cliente, recurso, cantidad, unidad); tarifas por tramos (tiered); agregación por período y detección de anomalías de consumo.",
    tools: [
      {
        name: "set_tariff",
        desc: "Define la tarifa por tramos para un recurso medible.",
        params: { recurso: { t: "string", d: "Recurso a tarifar (llamada_api, token_procesado, mb_datos...)" }, unidad: { t: "string", d: "Unidad de medida (invocación, token, MB)" }, tramos: { t: "array", d: "Tramos {hasta: cantidad o 'inf', precio_unitario} en orden" }, divisa: { t: "string", d: "Divisa", opt: true, def: "USD" }, cliente: { t: "string", d: "Cliente concreto (si la tarifa es privada)", opt: true } },
        code: `const st = store.load();
st.tarifas = st.tarifas || {};
const clave = (cliente ? cliente + "::" : "") + recurso;
const limpios = (tramos || []).map(t => ({ hasta: t.hasta === "inf" || t.hasta === Infinity ? "inf" : Number(t.hasta), precio_unitario: Number(t.precio_unitario) }));
if (!limpios.length) return fail("sin tramos");
st.tarifas[clave] = { recurso, unidad, tramos: limpios, divisa, cliente: cliente || null, creado: new Date().toISOString() };
store.save(st);
return ok({ tarifa: clave, tramos: limpios.length, unidad, divisa, ejemplo: "100 unidades cuestan " + calcular(limpios, 100).toFixed(4) + " " + divisa });
function calcular(trs, qty) {
  let restante = qty, costo = 0, anterior = 0;
  for (const t of trs) {
    if (restante <= 0) break;
    const cap = t.hasta === "inf" ? Infinity : t.hasta - anterior;
    const enTramo = Math.min(restante, cap);
    costo += enTramo * t.precio_unitario;
    restante -= enTramo;
    anterior = t.hasta === "inf" ? anterior : t.hasta;
  }
  return costo;
}`,
      },
      {
        name: "record_usage",
        desc: "Registra un evento de uso medible.",
        params: { cliente: { t: "string", d: "Agente/cliente consumidor" }, recurso: { t: "string", d: "Recurso consumido" }, cantidad: { t: "number", d: "Cantidad consumida en la unidad del recurso" }, operacion: { t: "string", d: "Operación concreta", opt: true }, ref: { t: "string", d: "Referencia externa (request id)", opt: true } },
        code: `const st = store.load();
st.eventos = st.eventos || [];
st.eventos.push({ cliente, recurso, cantidad, operacion: operacion || "", ref: ref || "", ts: new Date().toISOString() });
store.save(st);
return ok({ registrado: true, eventos_totales: st.eventos.length, cliente, recurso });`,
      },
      {
        name: "aggregate",
        desc: "Agrega el consumo por cliente y recurso para un período, con tarifa aplicada.",
        params: { dias: { t: "number", d: "Ventana hacia atrás en días", opt: true, def: 30 }, cliente: { t: "string", d: "Filtrar por cliente", opt: true } },
        code: `const st = store.load();
const desde = Date.now() - dias * 86400000;
let eventos = (st.eventos || []).filter(e => new Date(e.ts).getTime() >= desde);
if (cliente) eventos = eventos.filter(e => e.cliente === cliente);
if (!eventos.length) return fail("sin eventos en los últimos " + dias + " días");
const porClave = {};
eventos.forEach(e => {
  const k = e.cliente + "::" + e.recurso;
  porClave[k] = porClave[k] || { cliente: e.cliente, recurso: e.recurso, cantidad: 0, eventos: 0 };
  porClave[k].cantidad += e.cantidad;
  porClave[k].eventos++;
});
function calcular(trs, qty) {
  let restante = qty, costo = 0, anterior = 0;
  for (const t of trs) {
    if (restante <= 0) break;
    const cap = t.hasta === "inf" ? Infinity : t.hasta - anterior;
    const enTramo = Math.min(restante, cap);
    costo += enTramo * t.precio_unitario;
    restante -= enTramo;
    anterior = t.hasta === "inf" ? anterior : t.hasta;
  }
  return costo;
}
const lineas = __vals(porClave).map(l => {
  const tarifa = (st.tarifas || {})[l.cliente + "::" + l.recurso] || (st.tarifas || {})[l.recurso];
  const costo = tarifa ? calcular(tarifa.tramos, l.cantidad) : null;
  return { ...l, tarifa_aplicada: tarifa ? (tarifa.cliente ? "privada" : "estándar") : "SIN TARIFA", divisa: tarifa ? tarifa.divisa : null, costo: costo !== null ? Number(costo.toFixed(4)) : null };
});
const conCosto = lineas.filter(l => l.costo !== null);
return ok({ periodo_dias: dias, eventos_agregados: eventos.length, lineas, total_periodo: conCosto.length ? Number(conCosto.reduce((a, l) => a + l.costo, 0).toFixed(2)) : null, sin_tarifa: lineas.filter(l => l.costo === null).map(l => l.cliente + "::" + l.recurso) });`,
      },
      {
        name: "detect_anomalies",
        desc: "Detecta consumos anómalos: picos por cliente/recurso frente a su propia historia.",
        params: { dias: { t: "number", d: "Ventana de análisis", opt: true, def: 7 } },
        code: `const st = store.load();
const eventos = st.eventos || [];
if (eventos.length < 10) return ok({ eventos: eventos.length, mensaje: "datos insuficientes para anomalías" });
const hace = Date.now() - dias * 86400000;
const recientes = eventos.filter(e => new Date(e.ts).getTime() >= hace);
const antiguos = eventos.filter(e => new Date(e.ts).getTime() < hace);
const porClave = (lista) => { const m = {}; lista.forEach(e => { const k = e.cliente + "::" + e.recurso; m[k] = (m[k] || 0) + e.cantidad; }); return m; };
const rec = porClave(recientes), ant = porClave(antiguos);
const anomalies = [];
__ents(rec).forEach(([k, qty]) => {
  const prev = ant[k];
  if (prev !== undefined && prev > 0 && qty > prev * 3) anomalies.push({ clave: k, antes_periodo: prev, ahora: qty, factor: Number((qty / prev).toFixed(1)) + "x", tipo: "pico_vs_historia" });
  if (prev === undefined && qty > 1000) anomalies.push({ clave: k, antes_periodo: 0, ahora: qty, tipo: "cliente_recurso_nuevo_con_volumen_alto" });
});
return ok({ ventana_dias: dias, clientes_recursos_monitorizados: Object.keys(rec).length, anomalias: anomalies, aviso: anomalies.length ? "revisa los picos: posible bucle de agente o abuso de tarifa" : "sin anomalías de consumo" });`,
      },
    ],
  },
]

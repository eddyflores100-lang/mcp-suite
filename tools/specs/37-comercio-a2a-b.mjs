// ═══ CATEGORÍA: Dolores FUTUROS · Comercio A2A (B) ═══
// Evidencia: negociar, disputar y liquidar son fases del comercio agéntico
// sin herramientas locales: los agentes necesitan protocolos explícitos de
// oferta/contraoferta, evidencias y reconciliación de saldos.
export default [
  {
    id: "quote-negotiator",
    title: "Quote Negotiator",
    tagline: "Protocolo de oferta y contraoferta con precio de reserva, BATNA y concesiones decrecientes",
    category: "Comercio A2A",
    pain: "Dos agentes 'negocian' intercambiando números sin estructura: sin precio de reserva, sin alternativa de respaldo, sin estrategia de concesión. Uno acaba aceptando cualquier cosa o los dos en bucle infinito.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/quote-negotiator/. Modela cada parte con reserva, objetivo y BATNA; valida ofertas contra límites, propone contraofertas con concesión decreciente y detecta zona de acuerdo posible (ZOPA).",
    tools: [
      {
        name: "create_negotiation",
        desc: "Crea una negociación sobre un asunto con tus límites y tu alternativa (BATNA).",
        params: { asunto: { t: "string", d: "Qué se negocia (precio, plazo, SLA, alcance)" }, mi_reserva: { t: "number", d: "Tu límite: peor valor que aceptarías" }, mi_objetivo: { t: "number", d: "Valor ideal que buscas" }, batna: { t: "string", d: "Tu mejor alternativa si no hay acuerdo", opt: true }, direccion: { t: "enum", d: "Compras (prefieres BAJO) o vendes (prefieres ALTO)", values: ["comprador", "vendedor"] } },
        code: `const st = store.load();
st.negociaciones = st.negociaciones || [];
const id = "neg_" + String(st.negociaciones.length + 1).padStart(4, "0");
if (direccion === "comprador" && mi_objetivo > mi_reserva) return fail("como COMPRADOR tu objetivo (" + mi_objetivo + ") debe ser MENOR que tu reserva (" + mi_reserva + ")");
if (direccion === "vendedor" && mi_objetivo < mi_reserva) return fail("como VENDEDOR tu objetivo (" + mi_objetivo + ") debe ser MAYOR que tu reserva (" + mi_reserva + ")");
st.negociaciones.push({ id, asunto, mi_reserva, mi_objetivo, batna: batna || "sin alternativa declarada", direccion, ronda: 0, oferta_contrario: null, historial: [], cerrada: null, creado: new Date().toISOString() });
store.save(st);
return ok({ id, asunto, direccion, rango_util: { desde: Math.min(mi_objetivo, mi_reserva), hasta: Math.max(mi_objetivo, mi_reserva) }, batna, siguiente: "espera la oferta contraria y evalúala con evaluate_offer" });`,
      },
      {
        name: "submit_offer",
        desc: "Registra la oferta recibida de la contraparte.",
        params: { id: { t: "string", d: "Id de la negociación" }, valor: { t: "number", d: "Valor ofrecido" }, condiciones: { t: "string", d: "Condiciones adjuntas (plazo, garantías...)", opt: true } },
        code: `const st = store.load();
const n = (st.negociaciones || []).find(x => x.id === id);
if (!n) return fail("negociación no encontrada");
if (n.cerrada) return fail("negociación ya cerrada: " + n.cerrada.estado);
n.ronda++;
n.oferta_contrario = { valor, condiciones: condiciones || "", ronda: n.ronda, ts: new Date().toISOString() };
n.historial.push({ ronda: n.ronda, quien: "contrario", valor, condiciones: condiciones || "" });
store.save(st);
return ok({ id, ronda: n.ronda, oferta_recibida: valor, siguiente: "evalúala con evaluate_offer antes de responder" });`,
      },
      {
        name: "evaluate_offer",
        desc: "Evalúa la oferta contraria contra tu reserva, tu objetivo y tu BATNA con veredicto claro.",
        params: { id: { t: "string", d: "Id de la negociación" } },
        code: `const st = store.load();
const n = (st.negociaciones || []).find(x => x.id === id);
if (!n) return fail("negociación no encontrada");
const o = n.oferta_contrario;
if (!o) return fail("sin oferta contraria registrada");
const aceptable = n.direccion === "comprador" ? o.valor <= n.mi_reserva : o.valor >= n.mi_reserva;
const gananciaVsObjetivo = n.direccion === "comprador" ? Number((n.mi_objetivo - o.valor).toFixed(2)) : Number((o.valor - n.mi_objetivo).toFixed(2));
const margenVsReserva = n.direccion === "comprador" ? Number((n.mi_reserva - o.valor).toFixed(2)) : Number((o.valor - n.mi_reserva).toFixed(2));
const distanciaReserva = Math.abs(o.valor - n.mi_reserva);
const sobreMiObjetivo = Math.abs(o.valor - n.mi_objetivo);
const veredicto = aceptable && gananciaVsObjetivo >= 0 ? "ACEPTA YA: supera tu objetivo" : aceptable ? margenVsReserva > sobreMiObjetivo ? "ACEPTA: dentro de tu reserva con buen margen (" + margenVsReserva + ")" : "ACEPTABLE pero ajustado: " + margenVsReserva + " sobre tu reserva; puedes intentar una última mejora" : distanciaReserva / Math.max(Math.abs(n.mi_reserva), 1) < 0.1 ? "CERCA: a " + Number((distanciaReserva / Math.max(Math.abs(n.mi_reserva), 1) * 100).toFixed(1)) + "% de tu reserva: contraoferta estrecha puede cerrar" : "RECHAZA/CONTRAOFERTA: fuera de tu reserva por " + distanciaReserva.toFixed(2) + "; si no ceden, tu BATNA es: " + n.batna;
return ok({ id, ronda: n.ronda, oferta: o.valor, condiciones: o.condiciones, aceptable_para_mi: aceptable, margen_sobre_reserva: margenVsReserva, vs_objetivo: gananciaVsObjetivo, veredicto, batna_si_falla: n.batna });`,
      },
      {
        name: "counter_offer",
        desc: "Genera tu contraoferta con concesión decreciente según la ronda (estrategia estándar de negociación).",
        params: { id: { t: "string", d: "Id de la negociación" }, ajuste_manual: { t: "number", d: "Si prefieres fijar tú el valor, ignora la estrategia", opt: true } },
        code: `const st = store.load();
const n = (st.negociaciones || []).find(x => x.id === id);
if (!n) return fail("negociación no encontrada");
const o = n.oferta_contrario;
if (!o) return fail("sin oferta contraria: no puedes contraofertar aún");
let propuesta;
if (ajuste_manual !== undefined && ajuste_manual !== null) {
  propuesta = ajuste_manual;
  const valida = n.direccion === "comprador" ? propuesta <= n.mi_reserva : propuesta >= n.mi_reserva;
  if (!valida) return fail("tu contraoferta manual (" + propuesta + ") viola tu propia reserva (" + n.mi_reserva + "): no la envíes");
} else {
  const paso = Math.abs(n.mi_objetivo - n.mi_reserva);
  const factor = Math.pow(0.55, Math.max(0, n.ronda - 1));
  const cede = paso * factor;
  propuesta = n.direccion === "comprador" ? Math.min(n.mi_reserva, n.mi_objetivo + cede) : Math.max(n.mi_reserva, n.mi_objetivo - cede);
  propuesta = Number(propuesta.toFixed(2));
}
n.historial.push({ ronda: n.ronda + 1, quien: "yo", valor: propuesta });
store.save(st);
return ok({ id, ronda: n.ronda, contraoferta: propuesta, estrategia: ajuste_manual !== undefined && ajuste_manual !== null ? "manual (validada contra reserva)" : "concesión decreciente factor 0.55: cedes menos en cada ronda", margen_restante: Number(Math.abs(propuesta - n.mi_reserva).toFixed(2)), aviso_ronda: n.ronda >= 5 ? "ronda 5+: evalúa si tu BATNA ya es mejor que seguir cediendo" : null });`,
      },
      {
        name: "close_negotiation",
        desc: "Cierra la negociación con acuerdo (valor final) o ruptura (a BATNA).",
        params: { id: { t: "string", d: "Id de la negociación" }, resultado: { t: "enum", d: "Resultado", values: ["acuerdo", "ruptura"] }, valor_final: { t: "number", d: "Valor acordado (si acuerdo)", opt: true }, nota: { t: "string", d: "Nota de cierre", opt: true } },
        code: `const st = store.load();
const n = (st.negociaciones || []).find(x => x.id === id);
if (!n) return fail("negociación no encontrada");
if (n.cerrada) return fail("ya cerrada");
if (resultado === "acuerdo" && (valor_final === undefined || valor_final === null)) return fail("un acuerdo necesita valor_final");
const dentroReserva = resultado === "ruptura" ? null : n.direccion === "comprador" ? valor_final <= n.mi_reserva : valor_final >= n.mi_reserva;
n.cerrada = { estado: resultado, valor_final: valor_final ?? null, dentro_de_reserva: dentroReserva, rondas: n.ronda, nota: nota || "", ts: new Date().toISOString() };
store.save(st);
return ok({ id, cerrada: n.cerrada, resultado_para_mi: resultado === "acuerdo" ? (dentroReserva ? "acuerdo VÁLIDO: dentro de tu reserva" : "acuerdo PELIGROSO: violó tu reserva (" + n.mi_reserva + "), revisa por qué aceptaste") : "ruptura: activa tu BATNA -> " + n.batna, rondas_usadas: n.ronda });`,
      },
    ],
  },
  {
    id: "dispute-resolver",
    title: "Dispute Resolver",
    tagline: "Carpeta de disputas con evidencias ponderadas, posiciones enfrentadas y vías de resolución propuestas",
    category: "Comercio A2A",
    pain: "Cuando dos agentes discrepan (entrega mala, dato incorrecto, pago no reflejado) no hay dónde registrar la disputa con estructura: la 'resolución' es un pulso de quién insiste más, sin evidencia ni trazabilidad.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/dispute-resolver/. Disputas con reclamante/respondedor, pretensión, evidencias con peso, y análisis de brecha entre lo pedido y lo demostrado; propone la vía de cierre más barata.",
    tools: [
      {
        name: "open_case",
        desc: "Abre una disputa estructurada: quién, contra quién, qué se exige y bajo qué acuerdo.",
        params: { reclamante: { t: "string", d: "Agente que reclama" }, reclamado: { t: "string", d: "Agente reclamado" }, pretension: { t: "string", d: "Qué se exige exactamente (reembolso, corrección, entrega, disculpa)" }, acuerdo_violado: { t: "string", d: "Acuerdo/contrato/término supuestamente incumplido" }, monto_en_juego: { t: "number", d: "Valor económico implicado si aplica (0 si no)", opt: true, def: 0 } },
        code: `const st = store.load();
st.casos = st.casos || [];
const id = "dsp_" + String(st.casos.length + 1).padStart(4, "0");
st.casos.push({ id, reclamante, reclamado, pretension, acuerdo_violado, monto_en_juego, estado: "ABIERTO", evidencias: [], propuesta_resolucion: null, creado: new Date().toISOString() });
store.save(st);
return ok({ id, estado: "ABIERTO", siguiente: "aporta evidencia con add_evidence (ambas partes pueden)" });`,
      },
      {
        name: "add_evidence",
        desc: "Añade evidencia a la disputa: qué demuestra, quién la aporta y su fuerza.",
        params: { id: { t: "string", d: "Id de la disputa" }, parte: { t: "string", d: "Parte que la aporta" }, demuestra: { t: "string", d: "Qué hecho concreto demuestra" }, tipo: { t: "enum", d: "Naturaleza de la evidencia", values: ["documento", "log", "captura", "testimonio", "metrica", "contrato"] }, peso: { t: "enum", d: "Fuerza probatoria", values: ["debil", "media", "fuerte"], opt: true, def: "media" } },
        code: `const st = store.load();
const c = (st.casos || []).find(x => x.id === id);
if (!c) return fail("disputa no encontrada: " + id);
if (c.estado !== "ABIERTO") return fail("disputa ya resuelta");
c.evidencias.push({ parte, demuestra, tipo, peso, ts: new Date().toISOString() });
store.save(st);
return ok({ id, evidencias: c.evidencias.length, recuento_por_parte: c.evidencias.reduce((acc, e) => { acc[e.parte] = (acc[e.parte] || 0) + 1; return acc; }, {}) });`,
      },
      {
        name: "analyze_positions",
        desc: "Analiza el equilibrio probatorio: peso por parte, hechos no disputados y qué falta demostrar.",
        params: { id: { t: "string", d: "Id de la disputa" } },
        code: `const st = store.load();
const c = (st.casos || []).find(x => x.id === id);
if (!c) return fail("disputa no encontrada");
if (!c.evidencias.length) return fail("sin evidencias: añade con add_evidence");
const pesos = { fuerte: 3, media: 2, debil: 1 };
const porParte = {};
c.evidencias.forEach(e => { porParte[e.parte] = (porParte[e.parte] || 0) + (pesos[e.peso] || 2); });
const partes = [c.reclamante, c.reclamado];
const pR = porParte[c.reclamante] || 0, pD = porParte[c.reclamado] || 0;
const ventaja = pR > pD * 1.5 ? "claramente " + c.reclamante : pD > pR * 1.5 ? "claramente " + c.reclamado : "equilibrada";
const tiposPresentes = [...new Set(c.evidencias.map(e => e.tipo))];
const faltaContractual = !tiposPresentes.includes("contrato");
const faltaMetrica = c.pretension.toLowerCase().includes("reem") || c.pretension.toLowerCase().includes("monto") ? !tiposPresentes.includes("metrica") : false;
return ok({ id, peso_por_parte: porParte, ventaja_probatoria: ventaja, ratio: pR + ":" + pD, evidencias_totales: c.evidencias.length, tipos_presentes: tiposPresentes, huecos: { sin_prueba_del_acuerdo: faltaContractual ? "nadie aportó el contrato/acuerdo original: pídelo antes de decidir" : null, sin_cuantificacion: faltaMetrica ? "la pretensión es económica y no hay métrica que la cuantifique" : null }, lectura: "la pretensión '" + c.pretension.slice(0, 80) + "' requiere que " + c.reclamante + " demuestre el daño y que " + c.reclamado + " demuestre cumplimiento o fuerza mayor" });`,
      },
      {
        name: "propose_resolution",
        desc: "Propone la vía de cierre más eficiente según monto, equilibrio probatorio y coste de escalado.",
        params: { id: { t: "string", d: "Id de la disputa" } },
        code: `const st = store.load();
const c = (st.casos || []).find(x => x.id === id);
if (!c) return fail("disputa no encontrada");
const pesos = { fuerte: 3, media: 2, debil: 1 };
const pR = c.evidencias.filter(e => e.parte === c.reclamante).reduce((a, e) => a + (pesos[e.peso] || 2), 0);
const pD = c.evidencias.filter(e => e.parte === c.reclamado).reduce((a, e) => a + (pesos[e.peso] || 2), 0);
const vias = [
  { via: "acuerdo_directo", coste: 1, requiere: "ambas partes aceptan una lectura compartible de los hechos", aplica: Math.abs(pR - pD) <= 2 || c.evidencias.length <= 3 },
  { via: "mediacion_tercero", coste: 3, requiere: "un tercer agente neutral propuesto por ambos", aplica: Math.abs(pR - pD) > 2 && c.evidencias.length > 3 },
  { via: "reembolso_parcial_sin_reconocer_culpa", coste: Math.min(c.monto_en_juego * 0.5, 10), requiere: "el monto (" + c.monto_en_juego + ") hace más caro discutir que pagar", aplica: c.monto_en_juego > 0 && c.monto_en_juego < 50 },
  { via: "arbitraje_vinculante", coste: 10 + c.monto_en_juego * 0.05, requiere: "acuerdo de arbitraje previo", aplica: c.monto_en_juego >= 50 }
];
const aplicables = vias.filter(v => v.aplica).sort((a, b) => a.coste - b.coste);
if (!aplicables.length) aplicables.push({ via: "escalado_humano", coste: 999, requiere: "operador humano revisa el expediente", aplica: true });
c.propuesta_resolucion = { via_recomendada: aplicables[0].via, ts: new Date().toISOString() };
store.save(st);
return ok({ id, vias_ordenadas_por_coste: aplicables, recomendada: aplicables[0].via, razon: "coste total estimado " + Number(aplicables[0].coste.toFixed(2)) + " frente a monto en juego " + c.monto_en_juego, expediente: { evidencias: c.evidencias.length, pretension: c.pretension } });`,
      },
      {
        name: "close_case",
        desc: "Cierra la disputa con la resolución aplicada y lecciones extraídas.",
        params: { id: { t: "string", d: "Id de la disputa" }, resolucion: { t: "string", d: "Cómo se resolvió de verdad" }, satisface_a: { t: "enum", d: "Quien queda satisfecho", values: ["reclamante", "reclamado", "ambos", "ninguno"] }, leccion: { t: "string", d: "Qué cambiar para evitar repetir esta disputa", opt: true } },
        code: `const st = store.load();
const c = (st.casos || []).find(x => x.id === id);
if (!c) return fail("disputa no encontrada");
if (c.estado !== "ABIERTO") return fail("ya cerrada");
c.estado = "CERRADO";
c.cierre = { resolucion, satisface_a, leccion: leccion || "", dias_abierto: Number(((Date.now() - new Date(c.creado).getTime()) / 86400000).toFixed(2)), ts: new Date().toISOString() };
store.save(st);
const patrones = (st.casos || []).filter(x => x.cierre && x.acuerdo_violado === c.acuerdo_violado).length;
return ok({ id, cerrada: true, satisface_a, dias_abierto: c.cierre.dias_abierto, patrón_detectado: patrones > 1 ? "esta es la disputa #" + patrones + " sobre el mismo tipo de acuerdo: cambia el acuerdo de raíz" : "primera disputa de este tipo" });`,
      },
    ],
  },
  {
    id: "settlement-ledger",
    title: "Settlement Ledger",
    tagline: "Libro de liquidaciones entre agentes: pagos registrados, conciliación contra factura y saldos por contraparte",
    category: "Comercio A2A",
    pain: "El agente pagó, el otro agente dice que no; hay dos facturas por el mismo servicio y nadie concilia nada. Sin libro de liquidaciones con conciliación, la contabilidad entre agentes es una novela.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/settlement-ledger/. Asientos de liquidación con referencia; conciliación match-factura-a-pago; saldos por contraparte e informe de antigüedad de lo no conciliado.",
    tools: [
      {
        name: "record_settlement",
        desc: "Registra una liquidación real (pago emitido o recibido) con su referencia.",
        params: { contraparte: { t: "string", d: "Agente contraparte" }, direccion: { t: "enum", d: "Sentido del pago", values: ["pagado_por_mi", "recibido_por_mi"] }, monto: { t: "number", d: "Monto liquidado" }, divisa: { t: "string", d: "Divisa", opt: true, def: "USD" }, concepto: { t: "string", d: "Concepto (qué se liquida)" }, factura_ref: { t: "string", d: "Referencia de la factura/charge que cubre", opt: true }, tx_ref: { t: "string", d: "Referencia de la transacción (hash, id de pago)", opt: true } },
        code: `const st = store.load();
st.asientos = st.asientos || [];
const id = "liq_" + String(st.asientos.length + 1).padStart(4, "0");
st.asientos.push({ id, contraparte, direccion, monto, divisa, concepto, factura_ref: factura_ref || null, tx_ref: tx_ref || null, conciliado: false, match: null, ts: new Date().toISOString() });
store.save(st);
return ok({ id, contraparte, sentido: direccion, monto, divisa, conciliado: false, siguiente: "concilia con reconcile cuando tengas la factura/registro contrario" });`,
      },
      {
        name: "reconcile",
        desc: "Concilia liquidaciones contra facturas declaradas: match exacto, parcial o descuadre.",
        params: { facturas: { t: "array", d: "Facturas externas a conciliar {contraparte, factura_ref, monto, direccion_esperada}" } },
        code: `const st = store.load();
const asientos = st.asientos || [];
if (!asientos.length) return fail("libro vacío: registra liquidaciones primero");
const resultado = [];
(facturas || []).forEach(f => {
  const cand = asientos.filter(a => !a.conciliado && a.contraparte === f.contraparte && (!f.factura_ref || a.factura_ref === f.factura_ref || a.factura_ref === null));
  const exacto = cand.find(a => Math.abs(a.monto - f.monto) < 0.005);
  if (exacto) {
    exacto.conciliado = true;
    exacto.match = { tipo: "EXACTO", factura: f.factura_ref || "(sin ref)", ts: new Date().toISOString() };
    resultado.push({ factura: f.factura_ref || "(sin ref)", contraparte: f.contraparte, estado: "CONCILIADO_EXACTO", asiento: exacto.id, monto: f.monto });
  } else if (cand.length) {
    const parcial = cand.find(a => Math.abs(a.monto - f.monto) < Math.max(f.monto * 0.05, 1));
    if (parcial) {
      parcial.conciliado = true;
      parcial.match = { tipo: "APROXIMADO", diferencia: Number((f.monto - parcial.monto).toFixed(2)), factura: f.factura_ref || "(sin ref)", ts: new Date().toISOString() };
      resultado.push({ factura: f.factura_ref || "(sin ref)", contraparte: f.contraparte, estado: "CONCILIADO_CON_DESVIO", asiento: parcial.id, diferencia: Number((f.monto - parcial.monto).toFixed(2)) });
    } else {
      resultado.push({ factura: f.factura_ref || "(sin ref)", contraparte: f.contraparte, estado: "SIN_MATCH", buscado: f.monto, candidatos: cand.map(a => ({ id: a.id, monto: a.monto, concepto: a.concepto.slice(0, 40) })) });
    }
  } else {
    resultado.push({ factura: f.factura_ref || "(sin ref)", contraparte: f.contraparte, estado: "SIN_ASIENTO_POSIBLE", buscado: f.monto, alerta: "ningún asiento libre de esa contraparte: ¿falta registrar el pago o es una factura fantasma?" });
  }
});
store.save(st);
return ok({ facturas_evaluadas: (facturas || []).length, resumen: { exactos: resultado.filter(r => r.estado === "CONCILIADO_EXACTO").length, con_desvio: resultado.filter(r => r.estado === "CONCILIADO_CON_DESVIO").length, sin_match: resultado.filter(r => r.estado === "SIN_MATCH").length, sin_asiento: resultado.filter(r => r.estado === "SIN_ASIENTO_POSIBLE").length }, detalle: resultado });`,
      },
      {
        name: "balances",
        desc: "Saldos netos por contraparte: pagado vs recibido vs pendiente de conciliar.",
        params: {},
        code: `const st = store.load();
const asientos = st.asientos || [];
if (!asientos.length) return ok({ asientos: 0, mensaje: "libro vacío" });
const por = {};
asientos.forEach(a => {
  por[a.contraparte] = por[a.contraparte] || { contraparte: a.contraparte, pagado: 0, recibido: 0, sin_conciliar: 0, operaciones: 0 };
  por[a.contraparte].operaciones++;
  if (a.direccion === "pagado_por_mi") por[a.contraparte].pagado += a.monto;
  else por[a.contraparte].recibido += a.monto;
  if (!a.conciliado) por[a.contraparte].sin_conciliar += a.monto;
});
return ok({ contrapartes: __vals(por).map(p => ({ ...p, saldo_neto: Number((p.recibido - p.pagado).toFixed(2)) })).sort((a, b) => Math.abs(b.saldo_neto) - Math.abs(a.saldo_neto)), total_operaciones: asientos.length, alerta_descuadre: __vals(por).filter(p => p.sin_conciliar > 0).length + " contrapartes con movimientos sin conciliar" });`,
      },
      {
        name: "aging_report",
        desc: "Antigüedad de lo no conciliado: qué lleva días esperando match (riesgo de olvido).",
        params: {},
        code: `const st = store.load();
const abiertos = (st.asientos || []).filter(a => !a.conciliado);
if (!abiertos.length) return ok({ pendientes: 0, mensaje: "todo conciliado" });
const buckets = { "0-7_dias": 0, "8-30_dias": 0, "31-90_dias": 0, "+90_dias": 0 };
abiertos.forEach(a => {
  const dias = (Date.now() - new Date(a.ts).getTime()) / 86400000;
  if (dias <= 7) buckets["0-7_dias"]++;
  else if (dias <= 30) buckets["8-30_dias"]++;
  else if (dias <= 90) buckets["31-90_dias"]++;
  else buckets["+90_dias"]++;
});
const criticos = abiertos.filter(a => (Date.now() - new Date(a.ts).getTime()) / 86400000 > 90);
return ok({ pendientes: abiertos.length, por_antiguedad: buckets, monto_sin_conciliar: Number(abiertos.reduce((s, a) => s + a.monto, 0).toFixed(2)), criticos_90dias: criticos.map(a => ({ id: a.id, contraparte: a.contraparte, monto: a.monto, concepto: a.concepto.slice(0, 50) })), accion: criticos.length ? " reclama la documentación de los +90 días HOY: caducan pruebas y plazos" : "pendientes frescos" });`,
      },
    ],
  },
]

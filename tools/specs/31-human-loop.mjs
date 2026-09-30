// ═══ CATEGORÍA: Dolores FUTUROS · Humano en el Bucle ═══
// Evidencia: interrupciones y toma de control humano como patrón crítico
// en agentes 2026; calibración de confianza y escalamiento oportuno
// (over-trust / under-trust) como dolores de adopción.
export default [
  {
    id: "interruption-broker",
    title: "Interruption Broker",
    tagline: "Gestiona interrupciones del humano: pausa limpia, preserva estado y replanifica al reanudar",
    category: "Humano en el Bucle",
    pain: "El humano interrumpe al agente a mitad de tarea y el agente o ignora la interrupción o pierde todo el estado: no hay protocolo de pausa que preserve qué estaba haciendo y por dónde iba.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/interruption-broker/. Interrupciones con snapshot de estado (tarea, paso, siguiente acción); al reanudar devuelve el contexto + replanificación sugerida si la interrupción cambió algo.",
    tools: [
      {
        name: "interrupt",
        desc: "El humano interrumpe: graba snapshot del estado actual del agente y prioriza el nuevo pedido.",
        params: { razon: { t: "string", d: "Por qué interrumpe el humano" }, tarea_en_curso: { t: "string", d: "Qué estaba haciendo el agente" }, paso_actual: { t: "string", d: "Por dónde iba exactamente" }, siguiente_accion_prevista: { t: "string", d: "Qué iba a hacer a continuación" }, nuevo_pedido: { t: "string", d: "Lo que el humano quiere ahora", opt: true } },
        code: `const st = store.load();
st.interrupciones = st.interrupciones || [];
const int = { n: st.interrupciones.length + 1, razon, snapshot: { tarea_en_curso, paso_actual, siguiente_accion_prevista }, nuevo_pedido: nuevo_pedido || null, estado: "activa", ts: new Date().toISOString(), reanudada: null };
st.interrupciones.push(int);
store.save(st);
return ok({
  interrupcion_n: int.n,
  snapshot_preservado: true,
  prioridad: nuevo_pedido ? "atender el nuevo pedido PERO no descartes la tarea en curso sin decisión explícita" : "aclarar qué quiere el humano antes de continuar",
});`,
      },
      {
        name: "resume",
        desc: "Reanuda tras la interrupción: devuelve el snapshot y sugiere replanificación si el contexto cambió.",
        params: { interrupcion_n: { t: "number", d: "Número de la interrupción a reanudar", opt: true }, contexto_cambio: { t: "string", d: "Qué cambió durante la interrupción (si algo)", opt: true } },
        code: `const st = store.load();
const ints = st.interrupciones || [];
const int = interrupcion_n ? ints.find(i => i.n === interrupcion_n && i.estado === "activa") : [...ints].reverse().find(i => i.estado === "activa");
if (!int) return fail("no hay interrupción activa");
int.estado = "reanudada";
int.reanudada = new Date().toISOString();
store.save(st);
const replanificar = !!contexto_cambio || !!int.nuevo_pedido;
return ok({
  interrupcion: int.n,
  snapshot_recuperado: int.snapshot,
  pedido_pendiente_del_humano: int.nuevo_pedido,
  minutos_pausado: Number(((new Date(int.reanudada) - new Date(int.ts)) / 60000).toFixed(1)),
  plan: replanificar
    ? ["1. integra el cambio: " + (contexto_cambio || int.nuevo_pedido), "2. decide explícitamente si la tarea en curso sigue siendo válida (scope-guard)", "3. recalcula pasos restantes antes de ejecutar"]
    : ["1. re-valida que el paso actual sigue siendo correcto", "2. continúa desde: " + int.snapshot.siguiente_accion_prevista],
});`,
      },
      {
        name: "pending_interruptions",
        desc: "Lista interrupciones activas (sin reanudar) con su antigüedad.",
        params: {},
        code: `const st = store.load();
const activas = (st.interrupciones || []).filter(i => i.estado === "activa");
return ok({
  activas: activas.length,
  pendientes: activas.map(i => ({ n: i.n, razon: i.razon.slice(0, 70), tarea_congelada: i.snapshot.tarea_en_curso.slice(0, 60), minutos: Number(((Date.now() - new Date(i.ts)) / 60000).toFixed(0)) })),
  aviso: activas.length > 2 ? "3+ tareas congeladas: el humano está frenando trabajo: pregunta si priorizar o cancelar" : null,
});`,
      },
      {
        name: "interruption_stats",
        desc: "Estadísticas: frecuencia de interrupciones por sesión y motivo dominante.",
        params: {},
        code: `const st = store.load();
const ints = st.interrupciones || [];
if (!ints.length) return ok({ interrupciones: 0 });
const motivos = {};
for (const i of ints) {
  const k = /error|mal|fallo/i.test(i.razon) ? "corrección de rumbo" : /prioridad|urgente|antes/i.test(i.razon) ? "cambio de prioridad" : /pregunta|duda|aclar/i.test(i.razon) ? "consulta" : /idea|mejor|cambio de plan/i.test(i.razon) ? "idea nueva" : "otro";
  motivos[k] = (motivos[k] || 0) + 1;
}
return ok({
  interrupciones: ints.length,
  reanudadas: ints.filter(i => i.estado === "reanudada").length,
  abandonadas: ints.filter(i => i.estado !== "activa" && i.estado !== "reanudada").length,
  por_motivo: motivos,
  lectura: Object.entries(motivos).sort((a, b) => b[1] - a[1])[0][0] + " domina: si es corrección de rumbo, el agente no entendió el objetivo inicial (spec-clarifier)",
});`,
      },
    ],
  },
  {
    id: "takeover-request",
    title: "Takeover Request",
    tagline: "Solicita toma de control humano con el contexto mínimo suficiente: sin volcar todo el historial",
    category: "Humano en el Bucle",
    pain: "Cuando el agente se atasca pide ayuda volcando todo el historial o no pide nada y decide solo. El punto medio —un paquete de takeover con lo justo— no existe.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/takeover-request/. Paquetes de takeover: situación, lo intentado, el punto exacto de decisión, opciones con trade-offs y qué se necesita del humano. Mide tiempo de respuesta.",
    tools: [
      {
        name: "request_takeover",
        desc: "Construye un paquete de takeover: contexto mínimo, opciones con trade-offs y la pregunta concreta al humano.",
        params: { situacion: { t: "string", d: "Situación en 2-3 frases" }, intentado: { t: "array", d: "Lo que ya se intentó y falló" }, punto_decision: { t: "string", d: "La decisión exacta que no puede tomar solo" }, opciones: { t: "array", d: "Opciones viables con trade-offs" }, pregunta_al_humano: { t: "string", d: "La pregunta concreta y cerrada" }, urgencia: { t: "enum", d: "Urgencia", values: ["baja", "media", "alta"], opt: true, def: "media" } },
        code: `const st = store.load();
st.solicitudes = st.solicitudes || [];
if (!opciones || opciones.length < 2) return fail("sin >=2 opciones no hay decisión que tomar: investiga más o decide solo");
const paquete = {
  id: "tk_" + Date.now().toString(36),
  situacion, intentado: intentado || [], punto_decision, opciones: (opciones || []).map(String), pregunta_al_humano, urgencia,
  estado: "pendiente", creado: new Date().toISOString(), respondido: null,
};
st.solicitudes.push(paquete);
store.save(st);
return ok({
  takeover_id: paquete.id, urgencia,
  paquete_para_el_humano: [
    "SITUACIÓN: " + situacion,
    ...(intentado || []).map((i, x) => "INTENTO " + (x + 1) + ": " + i),
    "DECISIÓN PENDIENTE: " + punto_decision,
    ...opciones.map((o, x) => "OPCIÓN " + (x + 1) + ": " + o),
    "PREGUNTA: " + pregunta_al_humano,
  ],
  regla: "el humano decide la OPCIÓN, no re-deriva todo el análisis",
});`,
      },
      {
        name: "respond",
        desc: "Registra la respuesta del humano y mide el tiempo que tomó.",
        params: { takeover_id: { t: "string", d: "ID de la solicitud" }, decision: { t: "string", d: "Qué decidió el humano (opción o instrucción)" }, notas: { t: "string", d: "Matices del humano", opt: true } },
        code: `const st = store.load();
const s = (st.solicitudes || []).find(x => x.id === takeover_id);
if (!s) return fail("solicitud no encontrada");
if (s.estado !== "pendiente") return fail("ya respondida");
s.estado = "respondida";
s.decision = { decision, notas: notas || null };
s.respondido = new Date().toISOString();
store.save(st);
return ok({
  decision,
  minutos_para_responder: Number(((new Date(s.respondido) - new Date(s.creado)) / 60000).toFixed(1)),
  proximo_paso: "continúa la tarea aplicando la decisión y registra la lección si la decisión sorprendió (lesson-library)",
});`,
      },
      {
        name: "pending_requests",
        desc: "Solicitudes pendientes ordenadas por urgencia y antigüedad.",
        params: {},
        code: `const st = store.load();
const pend = (st.solicitudes || []).filter(s => s.estado === "pendiente");
if (!pend.length) return ok({ pendientes: 0 });
const peso = { alta: 0, media: 1, baja: 2 };
return ok({
  pendientes: pend.length,
  solicitudes: pend.map(s => ({ id: s.id, urgencia: s.urgencia, pregunta: s.pregunta_al_humano.slice(0, 80), minutos_esperando: Number(((Date.now() - new Date(s.creado)) / 60000).toFixed(0)) })).sort((a, b) => (peso[a.urgencia] - peso[b.urgencia]) || b.minutos_esperando - a.minutos_esperando),
});`,
      },
      {
        name: "takeover_stats",
        desc: "Estadísticas: cuánto decide el humano, tiempo medio de respuesta y decisiones que más se repiten.",
        params: {},
        code: `const st = store.load();
const ss = st.solicitudes || [];
if (!ss.length) return ok({ solicitudes: 0 });
const respondidas = ss.filter(s => s.respondido);
const tiempos = respondidas.map(s => (new Date(s.respondido) - new Date(s.creado)) / 60000);
const porPunto = {};
for (const s of ss) { const k = s.punto_decision.split(/\\s+/).slice(0, 3).join(" "); porPunto[k] = (porPunto[k] || 0) + 1; }
return ok({
  solicitudes: ss.length, respondidas: respondidas.length, pendientes: ss.length - respondidas.length,
  tiempo_respuesta_medio_min: tiempos.length ? Number((tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(1)) : null,
  decisiones_recurrentes: Object.entries(porPunto).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 2).map(([k, v]) => ({ punto: k, veces: v, sugerencia: "automatiza esta decisión con una política (escalación-policy)" })),
});`,
      },
    ],
  },
  {
    id: "trust-calibrator",
    title: "Trust Calibrator",
    tagline: "Calibra la confianza humano→agente por dominio: dónde te dejan solo y dónde exigen revisión",
    category: "Humano en el Bucle",
    pain: "La confianza es global, no calibrada: el humano revisa todo lo que el agente ya domina (desperdicio) O deja pasar lo que el agente still rompe (desastre). Falta trust por dominio con evidencia.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/trust-calibrator/. Nivel de confianza por dominio (0-4) con historial de aciertos/errores que lo justifica; recomienda subir/bajar el nivel según evidencia reciente.",
    tools: [
      {
        name: "set_trust",
        desc: "Establece el nivel de confianza del humano en un dominio (0=ninguna, 4=autonomía total) con justificación.",
        params: { dominio: { t: "string", d: "Dominio de trabajo (ej: sql, redaccion, pagos)" }, nivel: { t: "number", d: "0-4: 0 revisar todo, 1 asistir, 2 proponer, 3 ejecutar e informar, 4 autónomo" }, justificacion: { t: "string", d: "Por qué este nivel" } },
        code: `if (nivel < 0 || nivel > 4) return fail("nivel 0-4");
const st = store.load();
st.trust = st.trust || {};
st.trust[dominio] = { dominio, nivel, justificacion, exitos: st.trust[dominio]?.exitos || 0, fallos: st.trust[dominio]?.fallos || 0, ajustes: st.trust[dominio]?.ajustes || [], seteado: new Date().toISOString() };
store.save(st);
return ok({ dominio, nivel, descripcion: ["revisar TODO lo que haga", "asistir: solo tareas guiadas", "proponer: ejecuta tras aprobación", "ejecutar e informar después", "autónomo sin revisiones"][nivel] });`,
      },
      {
        name: "record_outcome",
        desc: "Registra un acierto o fallo del agente en el dominio: alimenta la recalibración.",
        params: { dominio: { t: "string", d: "Dominio" }, exito: { t: "boolean", d: "¿Salió bien sin intervención?" }, detalle: { t: "string", d: "Qué pasó", opt: true } },
        code: `const st = store.load();
const t = (st.trust || {})[dominio];
if (!t) return fail("dominio sin trust definido: usa set_trust");
if (exito) t.exitos++; else t.fallos++;
t.historial = t.historial || [];
t.historial.push({ exito, detalle: detalle || null, ts: new Date().toISOString() });
store.save(st);
return ok({ dominio, exitos: t.exitos, fallos: t.fallos, tasa: Number((t.exitos / (t.exitos + t.fallos)).toFixed(2)) });`,
      },
      {
        name: "recalibrate",
        desc: "Recomienda ajustar el nivel de trust según la evidencia acumulada (con histórico de ajustes).",
        params: {},
        code: `const st = store.load();
const dominios = Object.values(st.trust || {});
if (!dominios.length) return ok({ dominios: 0, sugerencia: "set_trust primero" });
const recomendaciones = dominios.map(t => {
  const total = t.exitos + t.fallos;
  let sugerido = null;
  if (total >= 8) {
    const tasa = t.exitos / total;
    if (tasa >= 0.95 && t.nivel < 4) sugerido = t.nivel + 1;
    else if (tasa < 0.7 && t.nivel > 0) sugerido = t.nivel - 1;
  }
  return {
    dominio: t.dominio, nivel_actual: t.nivel, exitos: t.exitos, fallos: t.fallos,
    tasa: total ? Number((t.exitos / total).toFixed(2)) : null,
    nivel_sugerido: sugerido,
    accion: sugerido === null ? "mantener" : sugerido > t.nivel ? "SUBIR: la evidencia justifica más autonomía (propón al humano)" : "BAJAR: demasiados fallos para este nivel de autonomía",
  };
});
return ok({
  dominios: recomendaciones.length,
  recomendaciones,
  subibles: recomendaciones.filter(r => r.nivel_sugerido !== null && r.nivel_sugerido > r.nivel_actual).map(r => r.dominio),
  bajables: recomendaciones.filter(r => r.nivel_sugerido !== null && r.nivel_sugerido < r.nivel_actual).map(r => r.dominio),
});`,
      },
      {
        name: "trust_map",
        desc: "Mapa de confianza completo: qué puede hacer solo el agente hoy, resumido.",
        params: {},
        code: `const st = store.load();
const dominios = Object.values(st.trust || {});
if (!dominios.length) return ok({ dominios: 0 });
const porNivel = {};
for (const t of dominios) porNivel[t.nivel] = (porNivel[t.nivel] || 0) + 1;
return ok({
  por_nivel: porNivel,
  autonomia_total: dominios.filter(t => t.nivel === 4).map(t => t.dominio),
  revision_total: dominios.filter(t => t.nivel === 0).map(t => t.dominio),
  balance: dominios.filter(t => t.nivel >= 3).length + " de " + dominios.length + " dominios con autonomía alta",
});`,
      },
    ],
  },
  {
    id: "escalation-policy",
    title: "Escalation Policy",
    tagline: "Política de escalamiento: cuándo molestar al humano y con qué paquete — ni spam ni silencio",
    category: "Humano en el Bucle",
    pain: "Sin política de escalamiento el agente o molesta al humano cada 5 minutos (spam) o se calla problemas hasta el desastre. Decidir cuándo escalar es LA política que ningún agente trae.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/escalation-policy/. Reglas (condición → acción: continuar, log, preguntar, abortar) con ventana anti-spam (cooldown) y presupuesto de interrupciones por día.",
    tools: [
      {
        name: "add_rule",
        desc: "Añade una regla de escalamiento: condición evaluable y acción a tomar.",
        params: { nombre: { t: "string", d: "Nombre de la regla" }, condicion: { t: "string", d: "Condición observable (ej: 'error 3 veces seguidas')" }, accion: { t: "enum", d: "Qué hacer", values: ["continuar", "registrar", "preguntar_humano", "abortar"] }, cooldown_minutos: { t: "number", d: "Minutos mínimos entre escalos de esta regla", opt: true, def: 60 } },
        code: `const st = store.load();
st.reglas = st.reglas || [];
if (st.reglas.some(r => r.nombre === nombre)) return fail("regla existente");
st.reglas.push({ nombre, condicion, accion, cooldown_minutos: cooldown_minutos ?? 60, disparos: 0, ultimo: null, creado: new Date().toISOString() });
store.save(st);
return ok({ regla: nombre, accion, cooldown: cooldown_minutos ?? 60 });`,
      },
      {
        name: "evaluate",
        desc: "Evalúa una situación contra las reglas: devuelve la acción a tomar respetando cooldowns.",
        params: { situacion: { t: "string", d: "Descripción de la situación actual" }, intentos_fallidos: { t: "number", d: "Intentos fallidos consecutivos", opt: true, def: 0 } },
        code: `const st = store.load();
const reglas = st.reglas || [];
if (!reglas.length) return fail("sin reglas: añade con add_rule");
const ahora = Date.now();
let accion = "continuar";
let reglaGanadora = null;
const evaluadas = [];
for (const r of reglas) {
  const t = String(situacion).toLowerCase() + " " + intentos_fallidos + " fallos";
  const dispara = /error|fallo|excepción|excepcion/i.test(r.condicion) && intentos_fallidos >= 3
    || /\\d+\\s*(veces|intentos)/i.test(r.condicion) && new RegExp(r.condicion.match(/\\d+/)?.[0] || "999").test(String(intentos_fallidos))
    || t.includes(r.condicion.toLowerCase().split(/\\s+/).slice(0, 3).join(" "));
  const enCooldown = r.ultimo && (ahora - new Date(r.ultimo).getTime()) < r.cooldown_minutos * 60000;
  evaluadas.push({ regla: r.nombre, dispara, en_cooldown: enCooldown });
  if (dispara && !enCooldown) {
    const orden = { continuar: 0, registrar: 1, preguntar_humano: 2, abortar: 3 };
    if (orden[r.accion] > orden[accion]) { accion = r.accion; reglaGanadora = r; }
  } else if (dispara && enCooldown && r.accion === "preguntar_humano") {
    accion = accion === "abortar" ? accion : "registrar";
    reglaGanadora = reglaGanadora || { ...r, nota: "suprimido por cooldown" };
  }
}
if (reglaGanadora && !reglaGanadora.nota) { reglaGanadora.disparos++; reglaGanadora.ultimo = new Date().toISOString(); store.save(st); }
return ok({
  accion_recomendada: accion,
  regla_que_dispara: reglaGanadora?.nombre || null,
  suprimidas_por_cooldown: evaluadas.filter(e => e.dispara && e.en_cooldown).map(e => e.regla),
  significado: { continuar: "sigue sin molestar a nadie", registrar: "anota y sigue (observabilidad)", preguntar_humano: "arma paquete de takeover (takeover-request)", abortar: "detén y preserva estado (checkpoint-undo)" }[accion],
});`,
      },
      {
        name: "interruption_budget",
        desc: "Presupuesto de interrupciones al humano hoy: respétalo o serás silenciado.",
        params: { max_por_dia: { t: "number", d: "Máximo de interrupciones diarias acordado", opt: true, def: 5 } },
        code: `const st = store.load();
const reglas = st.reglas || [];
const hoy = new Date().toISOString().slice(0, 10);
st.calendario = st.calendario || {};
st.calendario[hoy] = st.calendario[hoy] || 0;
const usadas = st.calendario[hoy];
const restantes = Math.max(0, max_por_dia - usadas);
return ok({
  fecha: hoy,
  interrupciones_usadas: usadas,
  presupuesto: max_por_dia,
  restantes: restantes,
  estado: restantes === 0 ? "AGOTADO: agrupa pendientes en UNA sola interrupción con prioridades" : restantes <= 1 ? "queda 1: úsala solo para bloqueante real" : "con margen",
  consejo: "si siempre agotas el presupuesto: tus reglas escalan demasiado pronto (sube cooldown o baja acción)",
});`,
      },
      {
        name: "count_interruption",
        desc: "Consume una interrupción del presupuesto diario (llámalo solo al preguntar de verdad al humano).",
        params: { motivo: { t: "string", d: "Por qué interrumpiste" } },
        code: `const st = store.load();
const hoy = new Date().toISOString().slice(0, 10);
st.calendario = st.calendario || {};
st.calendario[hoy] = (st.calendario[hoy] || 0) + 1;
st.log_interrupciones = st.log_interrupciones || [];
st.log_interrupciones.push({ dia: hoy, motivo, ts: new Date().toISOString() });
store.save(st);
return ok({ interrupciones_hoy: st.calendario[hoy], motivo });`,
      },
      {
        name: "policy_report",
        desc: "Reporte de la política: reglas, disparos y motivos de interrupción del período.",
        params: {},
        code: `const st = store.load();
const reglas = st.reglas || [];
const logs = st.log_interrupciones || [];
if (!reglas.length) return ok({ reglas: 0 });
return ok({
  reglas: reglas.map(r => ({ nombre: r.nombre, accion: r.accion, disparos: r.disparos, cooldown: r.cooldown_minutos })),
  interrupciones_registradas: logs.length,
  ultimos_motivos: logs.slice(-8).map(l => l.motivo.slice(0, 70)),
  reglas_muertas: reglas.filter(r => r.disparos === 0).map(r => r.nombre),
  consejo: reglas.filter(r => r.disparos === 0).length > reglas.length / 2 ? "la mitad de reglas nunca disparó: la condición es inalcanzable, revísala" : "política activa",
});`,
      },
    ],
  },
  {
    id: "explain-decision",
    title: "Explain Decision",
    tagline: "Explica decisiones post-hoc con evidencia: qué sabía, qué opciones descartó y por qué eligió",
    category: "Humano en el Bucle",
    pain: "El agente no puede explicar por qué hizo algo: no conserva qué información tenía, qué alternativas consideró ni qué criterio aplicó. Sin explicación, no hay confianza ni auditoría posible.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/explain-decision/. Decisión = situación + evidencia disponible + opciones consideradas + criterio + elegida + resultado esperado; reconstructible a posteriori.",
    tools: [
      {
        name: "record_decision",
        desc: "Registra una decisión con su contexto completo (evidencia, opciones, criterio, elegida).",
        params: { decision: { t: "string", d: "Decisión tomada" }, situacion: { t: "string", d: "Situación que la motivó" }, evidencia: { t: "array", d: "Datos/hechos en los que se basó" }, opciones_consideradas: { t: "array", d: "Alternativas evaluadas" }, criterio: { t: "string", d: "Criterio de elección" }, elegida_porque: { t: "string", d: "Por qué ganó la elegida" }, resultado_esperado: { t: "string", d: "Qué se espera que ocurra" } },
        code: `const st = store.load();
st.decisiones = st.decisiones || [];
const d = {
  id: "dc_" + Date.now().toString(36),
  decision, situacion, evidencia: evidencia || [], opciones: opciones_consideradas || [], criterio, elegida_porque, resultado_esperado,
  resultado_real: null, ts: new Date().toISOString(),
};
st.decisiones.push(d);
if (st.decisiones.length > 500) st.decisiones = st.decisiones.slice(-300);
store.save(st);
return ok({ decision_id: d.id, registrada: true, verificable: "registra el resultado real luego para calibrar el criterio" });`,
      },
      {
        name: "explain",
        desc: "Reconstruye la explicación completa de una decisión (para auditoría o pregunta del humano).",
        params: { decision_id: { t: "string", d: "ID de la decisión" } },
        code: `const st = store.load();
const d = (st.decisiones || []).find(x => x.id === decision_id);
if (!d) return fail("decisión no encontrada");
return ok({
  explicacion: [
    "DECISIÓN: " + d.decision,
    "SITUACIÓN: " + d.situacion,
    "EVIDENCIA QUE TENÍA: " + (d.evidencia.length ? d.evidencia.map((e, i) => (i + 1) + ". " + e).join("; ") : "(sin evidencia explícita registrada)") ,
    "OPCIONES CONSIDERADAS: " + (d.opciones.length ? d.opciones.join(" | ") : "(solo una camino considerado)"),
    "CRITERIO: " + d.criterio,
    "POR QUÉ LA ELEGIDA: " + d.elegida_porque,
    "RESULTADO ESPERADO: " + d.resultado_esperado,
    "RESULTADO REAL: " + (d.resultado_real || "pendiente de registrar"),
  ],
  bandera_auditoria: d.evidencia.length < 2 ? "DECISIÓN CON EVIDENCIA DÉBIL (menos de 2 soportes): era una corazonada" : d.opciones.length < 2 ? "SIN ALTERNATIVAS EVALUADAS: se tomó el primer camino" : "decisión bien soportada",
});`,
      },
      {
        name: "record_outcome",
        desc: "Registra el resultado real de la decisión y califica el criterio (acertó o no).",
        params: { decision_id: { t: "string", d: "ID de la decisión" }, resultado_real: { t: "string", d: "Qué pasó realmente" }, acierto: { t: "boolean", d: "¿El criterio acertó?" } },
        code: `const st = store.load();
const d = (st.decisiones || []).find(x => x.id === decision_id);
if (!d) return fail("decisión no encontrada");
d.resultado_real = resultado_real;
d.acierto = acierto;
store.save(st);
return ok({ decision: d.id, acierto });`,
      },
      {
        name: "decision_audit",
        desc: "Auditoría de decisiones: tasa de acierto del criterio y patrones de decisiones mal soportadas.",
        params: {},
        code: `const st = store.load();
const ds = st.decisiones || [];
if (!ds.length) return ok({ decisiones: 0 });
const evaluadas = ds.filter(d => d.acierto !== null && d.acierto !== undefined);
return ok({
  decisiones: ds.length, evaluadas: evaluadas.length,
  tasa_acierto_criterio: evaluadas.length ? Number((evaluadas.filter(d => d.acierto).length / evaluadas.length).toFixed(2)) : null,
  mal_soportadas: ds.filter(d => d.evidencia.length < 2).length,
  sin_alternativas: ds.filter(d => d.opciones.length < 2).length,
  sin_desenlace: ds.length - evaluadas.length,
  veredicto: ds.filter(d => d.evidencia.length < 2).length > ds.length * 0.4 ? "40%+ de decisiones con evidencia débil: exige 2+ soportes antes de decidir" : "disciplina decisional sana",
});`,
      },
    ],
  },
];

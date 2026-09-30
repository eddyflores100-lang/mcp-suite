// ═══ CATEGORÍA: Dolores FUTUROS · Pre-Vuelo de Acciones (B) ═══
// Evidencia: la taxonomía clásica de acciones (reversible / compensable /
// irreversible) no llega a los agentes: ejecutan sin clasificar y sin
// puntos de control. Un precondition-gate explícito evita arranques fallidos.
export default [
  {
    id: "reversibility-planner",
    title: "Reversibility Planner",
    tagline: "Clasifica cada acción del plan en reversible / compensable / irreversible y decide dónde poner checkpoints",
    category: "Pre-Vuelo",
    pain: "El agente encadena 20 acciones sin darse cuenta de que la número 7 era irreversible: cuando el resultado final no gusta, ya no hay vuelta atrás. Nadie le enseñó a clasificar reversibilidad ANTES de empezar.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/reversibility-planner/. Reglas configurables por verbo/recurso; genera planes de compensación (en vez de reversión) para lo irreversible-compensable y decide dónde capturar snapshots.",
    tools: [
      {
        name: "classify_action",
        desc: "Clasifica una acción por reglas (verbos, recursos, cantidad de afectados) en reversible/compensable/irreversible con explicación.",
        params: { accion: { t: "string", d: "Descripción de la acción a clasificar" }, recurso: { t: "string", d: "Recurso principal que toca", opt: true }, afectados: { t: "number", d: "Número de registros/usuarios afectados", opt: true, def: 1 } },
        code: `const texto = accion.toLowerCase();
const patrones = [
  { re: /\\b(drop|truncate|delete|borrar|eliminar|purge|shred|destruir)\\b/, clase: "irreversible", porque: "verbo destructivo: el dato deja de existir" },
  { re: /\\b(send|enviar|publicar|publish|post|tweet|email|notificar|facturar|pagar|transferir)\\b/, clase: "compensable", porque: "efecto externo ya emitido: no se deshace, se compensa (disculpa, abono, corrección)" },
  { re: /\\b(update|modificar|actualizar|cambiar|set)\\b/, clase: "reversible", porque: "sobrescribe estado previo: se revierte restaurando el valor anterior" },
  { re: /\\b(create|crear|insert|añadir|registrar)\\b/, clase: "reversible", porque: "añadir sin romper: se revierte eliminando lo creado" },
  { re: /\\b(grant|permiso|acceso|credencial|rol)\\b/, clase: "compensable", porque: "permiso otorgado puede ser revocado, pero el uso hecho mientras tanto no" },
  { re: /\\b(merge|fusionar|comprimir|compactar|migrar)\\b/, clase: "irreversible", porque: "colapsa información distinguishable: restaurar exige reconstrucción externa" }
];
let hit = patrones.find(p => p.re.test(texto));
let clase = hit ? hit.clase : "revisar_manualmente";
let porque = hit ? hit.porque : "ningún patrón de la taxonomía encaja: clasifícalo manualmente con teach_rule";
if (afectados > 1000 && clase === "reversible") { clase = "compensable"; porque = porque + " (escala de " + afectados + " afectados: la reversión técnica es posible pero el impacto ya ocurrió)"; }
return ok({ accion, recurso: recurso || "(no indicado)", afectados, clase, porque, recomendacion: clase === "irreversible" ? "PIDE APROBACIÓN + snapshot previo + dry-run obligatorio" : clase === "compensable" ? "registra efecto en side-effect-ledger y prepara la compensación ANTES de ejecutar" : "captura el valor previo para revertir en un paso" });`,
      },
      {
        name: "teach_rule",
        desc: "Enseña una regla de clasificación permanente (persiste entre sesiones).",
        params: { patron: { t: "string", d: "Patrón (texto o verbo) que dispara la regla" }, clase: { t: "enum", d: "Clase de reversibilidad", values: ["reversible", "compensable", "irreversible", "revisar_manualmente"] }, porque: { t: "string", d: "Razón de la regla" } },
        code: `const st = store.load();
st.reglas = st.reglas || [];
const yaExiste = st.reglas.some(r => r.patron === patron);
if (yaExiste) return fail("regla ya existente para ese patrón");
st.reglas.push({ patron: patron.toLowerCase(), clase, porque, creada: new Date().toISOString() });
store.save(st);
return ok({ regla: patron, clase, total_reglas: st.reglas.length });`,
      },
      {
        name: "compensation_plan",
        desc: "Para acciones compensables/irreversibles: genera esqueleto de plan de compensación con partes obligatorias.",
        params: { accion: { t: "string", d: "Acción a compensar" }, afectados: { t: "string", d: "Quién/qué resultó afectado", opt: true }, canal: { t: "string", d: "Canal del daño (email, público, datos, dinero)", opt: true } },
        code: `const st = store.load();
const clase = classifyLocal(accion);
function classifyLocal(a) {
  const t = a.toLowerCase();
  const reglas = (st.reglas || []);
  for (const r of reglas) if (t.includes(r.patron)) return r.clase;
  if (/\\b(pagar|transfer|factur|abon)\\w*/.test(t)) return "compensable";
  if (/\\b(delete|drop|borrar|eliminar)\\w*/.test(t)) return "irreversible";
  return "compensable";
}
const esDinero = /pagar|transfer|factur|abon|refund|dinero|pago/i.test(accion + " " + (canal || ""));
const esPublico = /public|tweet|post|anunci|email|notific/i.test(accion + " " + (canal || ""));
const partes = [
  { parte: "contención", obligatoria: true, acciones: ["detén la acción que sigue emitiendo efectos", "congela el estado actual para evitar más daño"] },
  { parte: "evaluación", obligatoria: true, acciones: ["cuantifica el daño real (" + (afectados || "afectados por identificar") + ")", "clasifica severidad: cosmético / funcional / financiero / reputacional"] },
  esDinero ? { parte: "restitución económica", obligatoria: true, acciones: ["calcula el importe exacto por afectado", "emite abono/reembolso con referencia del error", "verifica la entrada contable"] } : null,
  esPublico ? { parte: "comunicación", obligatoria: true, acciones: ["redacta corrección breve y factual (sin excusas largas)", "publícala por el mismo canal del daño original", "deja registro de alcance de la corrección"] } : null,
  { parte: "prevención", obligatoria: false, acciones: ["añade precondition que habría detectado esto", "clasifica la acción raíz con teach_rule para no repetirla"] }
].filter(Boolean);
return ok({ accion, clase_actual: clase, plan_compensacion: partes, nota: "la compensación NO borra el efecto: lo contrarresta. Ejecuta contención hoy, evaluación antes de comunicar." });`,
      },
      {
        name: "checkpoint_decision",
        desc: "Dado un plan (lista de clases de acción), decide en qué puntos capturar snapshots: solo antes de puntos de no-retorno.",
        params: { plan: { t: "string", d: "Nombre del plan" }, secuencia: { t: "array", d: "Acciones del plan en orden (texto libre)" } },
        code: `const st = store.load();
const pasos = (secuencia || []).map(String);
if (!pasos.length) return fail("secuencia vacía");
let puntosNoRetorno = 0;
const decisiones = pasos.map((a, i) => {
  const t = a.toLowerCase();
  const irreversible = /\\b(drop|delete|truncate|borrar|eliminar|merge|fusionar|migrar)\\b/.test(t) || (st.reglas || []).some(r => r.clase === "irreversible" && t.includes(r.patron));
  const compensable = /\\b(enviar|send|publicar|pagar|notificar|grant)\\b/.test(t) || (st.reglas || []).some(r => r.clase === "compensable" && t.includes(r.patron));
  if (irreversible) puntosNoRetorno++;
  return { paso: i + 1, accion: a.slice(0, 60), checkpoint: irreversible || compensable ? "SI: snapshot ANTES de este paso" : "no", razon: irreversible ? "punto de no-retorno" : compensable ? "efecto externo: captura evidencia previa" : "reversible: el snapshot previo cercano cubre" };
});
const costeSnapshot = 1;
return ok({ plan, pasos: pasos.length, puntos_de_no_retorno: puntosNoRetorno, checkpoints_recomendados: decisiones.filter(d => d.checkpoint !== "no").length, decisiones, presupuesto: "con snapshots selectivos pagas " + decisiones.filter(d => d.checkpoint !== "no").length * costeSnapshot + " unidades vs " + pasos.length + " si fotografiaras todo" });`,
      },
    ],
  },
  {
    id: "precondition-checker",
    title: "Precondition Checker",
    tagline: "Puerta de arranque: todas las precondiciones del plan verificadas con evidencia antes de gastar un solo token",
    category: "Pre-Vuelo",
    pain: "El agente arranca una tarea de 40 pasos y en el 35 descubre que le faltaba una credencial que se pide en el paso 1: media hora y un montón de tokens tirados a la basura por no chequear antes.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/precondition-checker/. Cada tarea declara checks (estado, permiso, dato, conexión); el gate evalúa cada uno con evidencia y emite GO / NO-GO / GO-CON-RIESGO.",
    tools: [
      {
        name: "define_checks",
        desc: "Declara las precondiciones de una tarea: qué verificar y cómo se comprueba.",
        params: { tarea: { t: "string", d: "Tarea/plan que quieres ejecutar" }, checks: { t: "array", d: "Checks {nombre, tipo: estado|permiso|dato|conexion|tiempo, como_verificar}" } },
        code: `const st = store.load();
st.tareas = st.tareas || {};
const limpios = (checks || []).map((c, i) => ({ nombre: String(c.nombre || ("check_" + (i + 1))), tipo: String(c.tipo || "estado"), como_verificar: String(c.como_verificar || "verificar manualmente"), estado: "pendiente" }));
if (!limpios.length) return fail("sin checks declarados");
st.tareas[tarea] = { tarea, checks: limpios, creado: new Date().toISOString(), gates: 0 };
store.save(st);
return ok({ tarea, checks: limpios.length, por_tipo: limpios.reduce((acc, c) => { acc[c.tipo] = (acc[c.tipo] || 0) + 1; return acc; }, {}), siguiente: "ejecuta check_all con las observaciones reales" });`,
      },
      {
        name: "check_all",
        desc: "Evalúa cada check con tu observación real y emite el veredicto de arranque (GO/NO-GO/GO-CON-RIESGO).",
        params: { tarea: { t: "string", d: "Tarea a evaluar" }, resultados: { t: "array", d: "Resultados {nombre, observado, cumple: true|false|desconocido}" } },
        code: `const st = store.load();
const t = (st.tareas || {})[tarea];
if (!t) return fail("tarea no definida: " + tarea + " (usa define_checks primero)");
t.gates = (t.gates || 0) + 1;
const obsMap = new Map((resultados || []).map(r => [String(r.nombre), r]));
const evaluados = t.checks.map(c => {
  const r = obsMap.get(c.nombre);
  if (!r) return { ...c, estado: "sin_evaluar", evidencia: null };
  const cumple = r.cumple === true ? "pasa" : r.cumple === false ? "falla" : "desconocido";
  return { ...c, estado: cumple, evidencia: String(r.observado || "").slice(0, 120), verificado_ts: new Date().toISOString() };
});
const fallan = evaluados.filter(e => e.estado === "falla");
const desconocidos = evaluados.filter(e => e.estado === "desconocido" || e.estado === "sin_evaluar");
const bloqueantes = fallan.filter(e => e.tipo === "permiso" || e.tipo === "conexion" || e.tipo === "estado");
const veredicto = bloqueantes.length ? "NO-GO: hay checks bloqueantes en rojo. Arrancar garantiza fallo a mitad de camino" : fallan.length === 0 && desconocidos.length === 0 ? "GO: todas las precondiciones verificadas" : desconocidos.length > evaluados.length / 3 ? "NO-GO-INFO: más de un tercio sin evaluar: verifica antes de arrancar" : "GO-CON-RIESGO: hay fallas no bloqueantes (" + fallan.length + ") y desconocidos (" + desconocidos.length + "): el plan puede avanzar con contingencias";
t.checks = evaluados;
t.ultimo_gate = { veredicto, ts: new Date().toISOString(), fallan: fallan.length, desconocidos: desconocidos.length };
store.save(st);
return ok({ tarea, gate_numero: t.gates, resumen: { total: evaluados.length, pasan: evaluados.filter(e => e.estado === "pasa").length, fallan: fallan.length, desconocidos: desconocidos.length }, checks: evaluados, veredicto });`,
      },
      {
        name: "gate_report",
        desc: "Último gate de una tarea: estado consolidado y qué camino tomar.",
        params: { tarea: { t: "string", d: "Tarea" } },
        code: `const st = store.load();
const t = (st.tareas || {})[tarea];
if (!t) return fail("tarea no definida");
const g = t.ultimo_gate;
if (!g) return ok({ tarea, gates: 0, mensaje: "nunca se ha corrido el gate: corre check_all" });
return ok({ tarea, gates_corridos: t.gates, ultimo_veredicto: g.veredicto, cuando: g.ts, pendientes_arreglar: t.checks.filter(c => c.estado === "falla").map(c => c.nombre), camino: g.veredicto.startsWith("NO-GO") ? "corrige los checks en rojo y re-corre el gate: no arrancques" : g.veredicto === "GO-CON-RIESGO" ? "arranca con plan de contingencia documentado para los checks amarillos" : "arranca" });`,
      },
      {
        name: "fail_stats",
        desc: "Estadística de qué precondiciones fallan más: dónde poner automatización.",
        params: {},
        code: `const st = store.load();
const tareas = __vals(st.tareas || {});
const todas = [];
tareas.forEach(t => (t.checks || []).forEach(c => todas.push({ tarea: t.tarea, nombre: c.nombre, tipo: c.tipo, estado: c.estado })));
if (!todas.length) return ok({ checks: 0, mensaje: "sin datos aún" });
const porNombre = {};
todas.forEach(c => { porNombre[c.nombre] = porNombre[c.nombre] || { nombre: c.nombre, tipo: c.tipo, fallas: 0, total: 0 }; porNombre[c.nombre].total++; if (c.estado === "falla") porNombre[c.nombre].fallas++; });
const ranking = __vals(porNombre).map(x => ({ ...x, tasa_fallo: Number((x.fallas / x.total * 100).toFixed(0)) + "%" })).sort((a, b) => b.fallas - a.fallas);
const peor = ranking[0];
return ok({ checks_evaluados: todas.length, top_fallidos: ranking.slice(0, 5), recomendacion: peor && peor.tasa_fallo === "100%" ? "el check '" + peor.nombre + "' falla SIEMPRE: automatízalo o elimínalo de la definición" : "monitoriza los checks con mayor tasa de fallo" });`,
      },
    ],
  },
  {
    id: "action-limiter",
    title: "Action Limiter",
    tagline: "Cinturón de seguridad del agente: limita frecuencia y volumen de acciones destructivas aunque el modelo insista",
    category: "Pre-Vuelo",
    pain: "El agente entra en bucle y repite la llamada destructiva 47 veces porque 'el error dice que reintentes'. Sin limitador local, ni el prompt ni el buen propósito frenan la máquina.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/action-limiter/. Políticas por verbo+objetivo: máx por ventana, máx por sesión, y escala (avisar → exigir confirmación humana → bloquear). El contador es local: el agente no puede negociarlo.",
    tools: [
      {
        name: "set_policy",
        desc: "Define el límite para una clase de acciones (verbo sobre objetivo).",
        params: { verbo: { t: "string", d: "Verbo de la acción (delete, send, update, create...)" }, objetivo: { t: "string", d: "Patrón del objetivo (archivo:*, tabla:*, api:*)", opt: true, def: "*" }, max_por_hora: { t: "number", d: "Máximo permitido por hora (0 = ilimitado)", opt: true, def: 0 }, max_por_sesion: { t: "number", d: "Máximo por sesión (0 = ilimitado)", opt: true, def: 0 }, escala: { t: "enum", d: "Qué hacer al superarlo", values: ["avisar", "confirmar_humano", "bloquear"], opt: true, def: "bloquear" } },
        code: `const st = store.load();
st.politicas = st.politicas || {};
const clave = verbo.toLowerCase() + "::" + (objetivo || "*");
st.politicas[clave] = { verbo: verbo.toLowerCase(), objetivo: objetivo || "*", max_por_hora, max_por_sesion, escala, creado: new Date().toISOString() };
store.save(st);
return ok({ politica: clave, max_por_hora, max_por_sesion, escala, politicas_totales: Object.keys(st.politicas).length });`,
      },
      {
        name: "check_action",
        desc: "Pregunta ANTES de ejecutar: ¿esta acción está dentro de límite? Devuelve PERMITIDO / AVISADO / CONFIRMAR_HUMANO / BLOQUEADO con motivo.",
        params: { verbo: { t: "string", d: "Verbo de la acción" }, objetivo: { t: "string", d: "Objetivo concreto (ej: tabla:usuarios)" }, sesion: { t: "string", d: "Sesión/agente que ejecuta", opt: true, def: "default" } },
        code: `const st = store.load();
st.eventos = st.eventos || [];
const politicas = __vals(st.politicas || {});
const v = verbo.toLowerCase();
const politica = politicas.filter(p => p.verbo === v).sort((a, b) => (b.objetivo === "*" ? 0 : 1) - (a.objetivo === "*" ? 0 : 1)).find(p => p.objetivo === "*" || (objetivo || "").startsWith(p.objetivo.replace(/\\*$/, "")) || (objetivo || "").includes(p.objetivo));
if (!politica) return ok({ decision: "PERMITIDO", motivo: "sin política para " + v + ": define una si es destructivo", politica: null });
const ahora = Date.now();
st.eventos = st.eventos.filter(e => ahora - new Date(e.ts).getTime() < 3600000);
const propios = st.eventos.filter(e => e.verbo === politica.verbo && e.sesion === sesion);
const mismosObjetivo = propios.filter(e => (objetivo || "").includes(e.objetivo.slice(0, 20)));
const enVentana = propios.filter(e => true);
const porHora = politica.max_por_hora > 0 ? enVentana.length >= politica.max_por_hora : false;
const porSesion = politica.max_por_sesion > 0 ? propios.length >= politica.max_por_sesion : false;
let decision = "PERMITIDO";
let motivo = "dentro de límites (" + enVentana.length + "/h, " + propios.length + "/sesión)";
if (porHora || porSesion) {
  if (politica.escala === "avisar") { decision = "AVISADO"; motivo = "límite superado (" + (porHora ? enVentana.length + "/" + politica.max_por_hora + " por hora" : propios.length + "/" + politica.max_por_sesion + " por sesión") + "): puede continuar pero el exceso queda registrado"; }
  else if (politica.escala === "confirmar_humano") { decision = "CONFIRMAR_HUMANO"; motivo = "límite superado: requiere confirmación humana explícita para continuar"; }
  else { decision = "BLOQUEADO"; motivo = "límite superado (" + (porHora ? "ventana horaria" : "sesión") + ") y la política manda bloquear: NIEGA la acción al agente"; }
}
return ok({ decision, motivo, politica: { verbo: politica.verbo, objetivo: politica.objetivo, max_por_hora: politica.max_por_hora, max_por_sesion: politica.max_por_sesion, escala: politica.escala }, uso_actual: { ultima_hora: enVentana.length, sesion: propios.length, mismo_objetivo: mismosObjetivo.length }, siguiente: decision === "PERMITIDO" ? "ejecuta y luego registra con register_action" : "obedece la decisión: el limitador es inapelable" });`,
      },
      {
        name: "register_action",
        desc: "Registra la ejecución real de la acción (alimenta los contadores).",
        params: { verbo: { t: "string", d: "Verbo ejecutado" }, objetivo: { t: "string", d: "Objetivo" }, resultado: { t: "string", d: "exito | error | parcial", opt: true, def: "exito" }, sesion: { t: "string", d: "Sesión", opt: true, def: "default" } },
        code: `const st = store.load();
st.eventos = st.eventos || [];
st.eventos.push({ verbo: verbo.toLowerCase(), objetivo, resultado, sesion, ts: new Date().toISOString() });
store.save(st);
return ok({ registrado: true, eventos_totales: st.eventos.length });`,
      },
      {
        name: "usage_report",
        desc: "Consumo por verbo/objetivo en la última hora y estado frente a cada política.",
        params: {},
        code: `const st = store.load();
const ahora = Date.now();
const eventos = (st.eventos || []).filter(e => ahora - new Date(e.ts).getTime() < 3600000);
const porVerbo = {};
eventos.forEach(e => { const k = e.verbo + "::" + e.objetivo.slice(0, 30); porVerbo[k] = (porVerbo[k] || 0) + 1; });
const politicas = __vals(st.politicas || {}).map(p => {
  const uso = eventos.filter(e => e.verbo === p.verbo).length;
  return { politica: p.verbo + "::" + p.objetivo, limite_hora: p.max_por_hora, uso_ultima_hora: uso, estado: p.max_por_hora > 0 ? (uso >= p.max_por_hora ? "EN LÍMITE" : uso >= p.max_por_hora * 0.7 ? "ACERCÁNDOSE" : "holgado") : "sin límite horario" };
});
return ok({ eventos_ultima_hora: eventos.length, por_verbo_objetivo: porVerbo, politicas, errores_repetidos: eventos.filter(e => e.resultado === "error").length });`,
      },
    ],
  },
]

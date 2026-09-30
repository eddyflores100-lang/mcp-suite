// ═══ CATEGORÍA: Dolores FUTUROS · Especificación y Requisitos ═══
// Evidencia: "Most multi-agent LLM systems fail from spec ambiguity and
// coordination gaps, not infrastructure" (Why Multi-Agent AI Systems Fail,
// sep-2025). La ambigüedad de especificación es la causa raíz #1.
export default [
  {
    id: "spec-clarifier",
    title: "Spec Clarifier",
    tagline: "Detecta ambigüedad en especificaciones y genera las preguntas de clarificación correctas",
    category: "Especificación y Requisitos",
    pain: "El humano escribe specs vagas ('hazlo bonito', 'mejora el rendimiento') y el agente adivina. La causa raíz #1 de fallo multi-agente es la ambigüedad de especificación, no la infraestructura.",
    persistent: false,
    notes: "Análisis léxico-heurístico sin LLM: detecta vaguedad (adverbios blandos), cuantificadores ausentes, referencias sin definición, requisitos contradictorios y missing NFRs. Genera preguntas listas para enviar al humano.",
    tools: [
      {
        name: "analyze_spec",
        desc: "Analiza una especificación y devuelve ambigüedades concretas clasificadas (vaguedad, cuantificación, referencia, contradicción) y score de claridad.",
        params: { spec: { t: "string", d: "Texto de la especificación" } },
        code: `const VAGOS = ["bonito", "rápido", "rapido", "mejor", "mejorar", "óptimo", "optimo", "adecuado", "apropiado", "moderno", "robusto", "escalable", "eficiente", "user-friendly", "sencilillo", "sencillo", "ligero", "flexible", "potente", "genérico", "generico", "intuitivo", "nítido", "nítido"];
const INTENSIFICADORES = ["muy", "bastante", "algo", "quizá", "quizas", "tal vez", "más o menos", "mas o menos", "lo más posible", "lo mejor posible", "eventualmente", "idealmente", "si es posible", "cuando puedas"];
const hallazgos = [];
const texto = spec;
const bajo = texto.toLowerCase();
for (const v of VAGOS) {
  let idx = bajo.indexOf(v);
  while (idx !== -1) {
    hallazgos.push({ tipo: "vaguedad", palabra: v, contexto: texto.slice(Math.max(0, idx - 40), idx + v.length + 40), fix: "define operacionalmente: ¿cómo se MIDE que es '" + v + "'?" });
    idx = bajo.indexOf(v, idx + 1);
    if (hallazgos.filter(h => h.palabra === v).length >= 3) break;
  }
}
for (const i of INTENSIFICADORES) if (bajo.includes(i)) hallazgos.push({ tipo: "intensificador_blando", palabra: i, fix: "sustituye por umbral concreto (número, %, segundos)" });
const CUANTIFICABLES = ["debe ser", "tiene que ser", "necesita", "requiere", "soporta", "máximo", "maximo", "mínimo", "minimo", "al menos", "hasta", "límite", "limite", "tiempo", "usuarios", "concurrente", "latencia"];
let sinNumero = 0;
for (const c of CUANTIFICABLES) {
  let idx = bajo.indexOf(c);
  while (idx !== -1) {
    const ventana = texto.slice(idx, idx + 80);
    if (!/\\d/.test(ventana)) { sinNumero++; hallazgos.push({ tipo: "cuantificacion_ausente", palabra: c, contexto: ventana.slice(0, 70), fix: "añade la cifra: '" + c + "' sin número no es verificable" }); break; }
    idx = bajo.indexOf(c, idx + 1);
  }
}
const articulos = texto.match(/\\b(el|la|los|las|este|esta|eso|esa)\\s+\\w+/gi) || [];
const referencias = articulos.filter(a => {
  const sust = a.split(/\\s+/)[1].toLowerCase();
  return !["sistema", "usuario", "usuarios", "agente", "proyecto", "cliente", "datos", "servicio", "aplicacion", "aplicación"].includes(sust) && (texto.toLowerCase().split(/\\s+/).filter(w => w === sust).length === 1);
}).slice(0, 5);
for (const r of referencias) hallazgos.push({ tipo: "referencia_ambigua", palabra: r, fix: "'" + r + "' aparece una sola vez: ¿a qué se refiere exactamente?" });
const score = Math.max(0, 100 - hallazgos.length * 7 - sinNumero * 4);
return ok({
  claridad_score: score + "/100",
  total_hallazgos: hallazgos.length,
  por_tipo: hallazgos.reduce((acc, h) => { acc[h.tipo] = (acc[h.tipo] || 0) + 1; return acc; }, {}),
  hallazgos: hallazgos.slice(0, 15),
  veredicto: score >= 80 ? "especificación operable" : score >= 50 ? "ambigüedad media: clarifica antes de construir" : "demasiado ambigua: NO construyas todavía, pregunta primero",
});`,
      },
      {
        name: "generate_questions",
        desc: "Genera la lista de preguntas de clarificación priorizadas (bloqueantes primero) listas para enviar al humano.",
        params: { spec: { t: "string", d: "Especificación original" }, max_preguntas: { t: "number", d: "Límite de preguntas", opt: true, def: 8 } },
        code: `const PLANTILLAS = [
  { cond: (s) => /(crear|hacer|construir|desarrollar)\\b/i.test(s), q: "¿Qué EXACTAMENTE incluye el resultado y qué queda explícitamente fuera?" },
  { cond: (s) => /(usuario|cliente|audiencia)/i.test(s), q: "¿Quién es el usuario objetivo y cuál es su nivel técnico?" },
  { cond: (s) => /(rápido|rapido|rendimiento|latencia|velocidad)/i.test(s), q: "¿Qué cifra concreta de rendimiento es aceptable (ej: <200ms p95)?" },
  { cond: (s) => /(formato|estilo|diseño|bonito)/i.test(s), q: "¿Hay un ejemplo visual o referencia que pueda imitar?" },
  { cond: (s) => /(integr|conect|api)/i.test(s), q: "¿Qué sistemas hay que integrar y con qué prioridad?" },
  { cond: (s) => /(seguridad|privacidad|datos)/i.test(s), q: "¿Qué datos son sensibles y qué nivel de protección exige el contexto?" },
  { cond: (s) => /(deadline|plazo|fecha|urgente)/i.test(s), q: "¿Cuál es la fecha límite dura y qué se sacrifica si no llega (calidad o alcance)?" },
  { cond: (s) => /(escala|crecimiento|futuro)/i.test(s), q: "¿Para qué volumen debe funcionar el día 1 y en 6 meses?" },
];
const base = PLANTILLAS.filter(p => p.cond(spec)).map(p => p.q);
const genericas = [
  "¿Cómo se verifica que el resultado es correcto? Dame 1-2 ejemplos de entrada→salida esperada.",
  "Si dos requisitos chocan, ¿cuál gana?",
  "¿Qué pasa si esto falla en producción: cuál es el peor escenario aceptable?",
];
const preguntas = [...base, ...genericas].slice(0, Math.max(1, Math.min(max_preguntas, 10)));
return ok({
  preguntas_bloqueantes: preguntas.slice(0, Math.ceil(preguntas.length / 2)),
  preguntas_importantes: preguntas.slice(Math.ceil(preguntas.length / 2)),
  protocolo: "envía las bloqueantes primero: no empieces hasta tener respuesta",
});`,
      },
      {
        name: "operationalize",
        desc: "Convierte una frase vaga en una definición operacional medible (plantillas por tipo de vaguedad).",
        params: { frase: { t: "string", d: "Frase vaga (ej: 'debe ser rápido')" }, dominio: { t: "string", d: "Contexto (web, api, datos, ux)", opt: true } },
        code: `const f = frase.toLowerCase();
const MAPA = [
  { pat: /(rápido|rapido|veloz|rendimiento)/, dom: { web: "carga < 2s y TTI < 3s en 4G", api: "p95 < 200ms bajo carga nominal", datos: "query < 500ms en dataset objetivo" }, gen: "latencia p95 < X ms medida con [herramienta] bajo [carga]" },
  { pat: /(bonito|diseño|estético|estetico)/, dom: {}, gen: "se ajusta al design system [X] con contraste AA y sin elementos fuera de grid" },
  { pat: /(seguro|robusto|estable)/, dom: {}, gen: "pasa [lista de casos extremos] sin corromper estado ni filtrar datos" },
  { pat: /(escalable|escala)/, dom: {}, gen: "soporta [N] usuarios concurrentes con degradación lineal < [Y]%" },
  { pat: /(fácil|facil|sencillo|sencilillo|intuitivo)/, dom: {}, gen: "un usuario nuevo completa la tarea en < [N] min sin ayuda (test de [k] usuarios)" },
  { pat: /(completo|exhaustivo)/, dom: {}, gen: "cubre los [N] casos listados en [fuente] y declara explícitamente los excluidos" },
];
for (const m of MAPA) {
  if (m.pat.test(f)) {
    return ok({
      frase_original: frase,
      definicion_operacional: m.dom[dominio || ""] || m.gen,
      como_verificarlo: "define la métrica, el umbral, la herramienta de medida y las condiciones de carga ANTES de construir",
      ejemplo: frase.replace(/debe ser|tiene que ser|que sea/gi, "").trim() + " → medible con umbral y herramienta",
    });
  }
}
return ok({ frase_original: frase, definicion_operacional: null, consejo: "patrón no reconocido: define métrica + umbral + herramienta de medida a mano" });`,
      },
      {
        name: "contradiction_check",
        desc: "Detecta requisitos contradictorios o incompatibles entre sí dentro de la spec.",
        params: { requisitos: { t: "array", d: "Lista de requisitos en texto" } },
        code: `const reqs = (requisitos || []).map(String).filter(Boolean);
if (reqs.length < 2) return fail("necesitas >=2 requisitos");
const PARES = [
  { a: /(simple|sencillo|minimal)/i, b: /(completo|exhaustivo|todas las)/i, msg: "simplicidad vs exhaustividad" },
  { a: /(gratis|sin costo|económico)/i, b: /(premium|alta disponibilidad|24\\/7)/i, msg: "costo cero vs disponibilidad alta" },
  { a: /(inmediato|ya|mismo día)/i, b: /(revisado|aprobado|verificado|calidad)/i, msg: "inmediatez vs control de calidad" },
  { a: /(privado|confidencial|local)/i, b: /(compartido|público|publico|nube|social)/i, msg: "privacidad vs exposición" },
  { a: /(personalizado|a medida)/i, b: /(estándar|estandar|genérico|generico)/i, msg: "a medida vs estándar" },
  { a: /(automático|automatico|sin intervención)/i, b: /(aprobación|aprobacion|revisión|revision|humano)/i, msg: "autonomía total vs human-in-the-loop" },
];
const choques = [];
for (let i = 0; i < reqs.length; i++) for (let j = i + 1; j < reqs.length; j++) {
  for (const par of PARES) {
    if ((par.a.test(reqs[i]) && par.b.test(reqs[j])) || (par.b.test(reqs[i]) && par.a.test(reqs[j]))) {
      choques.push({ req_a: reqs[i].slice(0, 90), req_b: reqs[j].slice(0, 90), tension: par.msg, resolucion: "pide prioridad explícita: ¿cuál gana cuando choquen?" });
    }
  }
}
return ok({ requisitos: reqs.length, contradicciones: choques.length, choques: choques.slice(0, 8), veredicto: choques.length ? "HAY tensiones sin resolver: aclara prioridades antes de construir" : "sin contradicciones evidentes" });`,
      },
      {
        name: "nfr_checklist",
        desc: "Checklist de requisitos no funcionales que la spec omite (rendimiento, seguridad, accesibilidad, datos...).",
        params: { spec: { t: "string", d: "Especificación a auditar" } },
        code: `const NFRS = [
  { nombre: "rendimiento", pat: /(rendimiento|latencia|velocidad|rápido|rapido|p95|ms|segundos)/i, pregunta: "¿umbral de latencia/throughput y condiciones de medida?" },
  { nombre: "seguridad", pat: /(seguridad|auth|permiso|token|encript|cifrad)/i, pregunta: "¿quién puede hacer qué y cómo se autentica?" },
  { nombre: "privacidad_datos", pat: /(privacidad|pii|gdpr|datos personales|anonimiz)/i, pregunta: "¿qué datos se guardan, dónde y con qué retención?" },
  { nombre: "accesibilidad", pat: /(accesibilidad|a11y|contraste|lector de pantalla|wcag)/i, pregunta: "¿nivel WCAG objetivo y cómo se verifica?" },
  { nombre: "disponibilidad", pat: /(disponibilidad|uptime|24\\/7|sla|redundancia)/i, pregunta: "¿SLA objetivo y comportamiento ante caída?" },
  { nombre: "observabilidad", pat: /(logs|métricas|metricas|monitoreo|monitoriz|trazas|alertas)/i, pregunta: "¿qué se registra y qué alerta dispara?" },
  { nombre: "compatibilidad", pat: /(navegador|móvil|movil|versión|version|compatib|soporta)/i, pregunta: "¿matriz de compatibilidad mínima?" },
  { nombre: "internacionalizacion", pat: /(idioma|i18n|locale|español|inglés|ingles|traducc)/i, pregunta: "¿idiomas soportados y formato de fechas/números?" },
  { nombre: "mantenibilidad", pat: /(tests|cobertura|documentación|documentacion|mantenimiento)/i, pregunta: "¿tests exigidos y documentación mínima?" },
];
const bajo = spec.toLowerCase();
const omitidos = NFRS.filter(n => !n.pat.test(spec));
const cubiertos = NFRS.filter(n => n.pat.test(spec));
return ok({
  cubiertos: cubiertos.map(c => c.nombre),
  omitidos: omitidos.map(o => ({ nfr: o.nombre, pregunta_para_el_humano: o.pregunta })),
  prioridad: omitidos.filter(o => ["seguridad", "privacidad_datos", "rendimiento"].includes(o.nombre)).length > 0 ? "estos NFRs omitidos suelen explotar en producción: pregunta por ellos primero" : "omite NFRs de segundo orden si el plazo aprieta",
});`,
      },
    ],
  },
  {
    id: "acceptance-criteria",
    title: "Acceptance Criteria",
    tagline: "Convierte requests en criterios GIVEN/WHEN/THEN verificables con prioridad y trazabilidad",
    category: "Especificación y Requisitos",
    pain: "Los 'definition of done' del agente son difusos: dice 'listo' cuando compiló, no cuando cumple criterios verificables que el humano podría auditar.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/acceptance-criteria/. Convierte cada requerimiento en criterios GIVEN/WHEN/THEN priorizados (MoSCoW) con estado de verificación y evidencia.",
    tools: [
      {
        name: "add_requirement",
        desc: "Registra un requerimiento y genera su borrador de criterios de aceptación GIVEN/WHEN/THEN.",
        params: { requerimiento: { t: "string", d: "Texto del requerimiento" }, prioridad: { t: "enum", d: "MoSCoW", values: ["must", "should", "could", "wont"], opt: true, def: "must" }, contexto: { t: "string", d: "Contexto adicional", opt: true } },
        code: `const st = store.load();
st.reqs = st.reqs || [];
const id = "rq_" + Date.now().toString(36);
const acciones = ["mostrar", "mostrará", "listar", "devolver", "crear", "guardar", "procesar", "calcular", "validar", "enviar", "notificar", "buscar", "filtrar", "generar"];
const entidadesGuess = requerimiento.split(/\\s+/).slice(0, 4).join(" ");
st.reqs.push({
  id, requerimiento, prioridad, contexto: contexto || null,
  criterios: [
    { GIVEN: "el sistema en estado normal", WHEN: "solicito: " + entidadesGuess, THEN: "obtengo el resultado descrito sin errores" },
    { GIVEN: "datos de entrada inválidos o vacíos", WHEN: "solicito: " + entidadesGuess, THEN: "recibo error explícito y el estado no se corrompe" },
    { GIVEN: "el resultado anterior", WHEN: "reviso la salida", THEN: "cumple el requerimiento literal: '" + requerimiento.slice(0, 90) + "'" },
  ].map((c, i) => ({ n: i + 1, ...c, estado: "pendiente", evidencia: null })),
  creado: new Date().toISOString(),
});
store.save(st);
return ok({ requerimiento_id: id, prioridad, criterios_borrador: 3, aviso: "edita/refina los criterios con refine_criterion: el borrador es el punto de partida" });`,
      },
      {
        name: "refine_criterion",
        desc: "Refina un criterio concreto (GIVEN/WHEN/THEN exactos) para hacerlo objetivamente verificable.",
        params: { requerimiento_id: { t: "string", d: "ID del requerimiento" }, n: { t: "number", d: "Número del criterio" }, given: { t: "string", d: "Contexto previo exacto" }, when: { t: "string", d: "Acción concreta" }, then: { t: "string", d: "Resultado observable y medible" } },
        code: `const st = store.load();
const r = (st.reqs || []).find(x => x.id === requerimiento_id);
if (!r) return fail("requerimiento no encontrado");
const c = r.criterios.find(x => x.n === n);
if (!c) return fail("criterio inexistente");
const problemas = [];
if (/\\d/.test(then) === false && /(tiempo|segundos|ms|elementos|resultados)/i.test(then)) problemas.push("THEN menciona magnitud sin número");
if (then.split(/\\s+/).length < 5) problemas.push("THEN demasiado corto para ser observable");
if (when.split(/\\s+/).length < 3) problemas.push("WHEN demasiado vago: ¿qué acción exacta?");
c.GIVEN = given; c.WHEN = when; c.THEN = then; c.refinado = true;
store.save(st);
return ok({ criterio: n, actualizado: true, problemas_estilo: problemas, estado: problemas.length ? "mejorable" : "verificable" });`,
      },
      {
        name: "verify_criterion",
        desc: "Marca un criterio como verificado (o fallido) con evidencia: la definición objetiva de 'listo'.",
        params: { requerimiento_id: { t: "string", d: "ID del requerimiento" }, n: { t: "number", d: "Número del criterio" }, pasado: { t: "boolean", d: "¿Verificado?" }, evidencia: { t: "string", d: "Cómo se verificó (test, revisión, salida)" } },
        code: `const st = store.load();
const r = (st.reqs || []).find(x => x.id === requerimiento_id);
if (!r) return fail("requerimiento no encontrado");
const c = r.criterios.find(x => x.n === n);
if (!c) return fail("criterio inexistente");
if (!evidencia) return fail("sin evidencia no hay verificación: ¿cómo lo comprobaste?");
c.estado = pasado ? "verificado" : "fallido";
c.evidencia = evidencia;
c.verificado_ts = new Date().toISOString();
store.save(st);
const verificados = r.criterios.filter(x => x.estado === "verificado").length;
return ok({ criterio: n, estado: c.estado, progreso: verificados + "/" + r.criterios.length, listo: verificados === r.criterios.length });`,
      },
      {
        name: "ready_check",
        desc: "¿Se puede declarar 'listo'? Solo si todos los must están verificados; lista lo que falta.",
        params: {},
        code: `const st = store.load();
const reqs = st.reqs || [];
if (!reqs.length) return ok({ requerimientos: 0 });
const faltantes = [];
for (const r of reqs) {
  if (r.prioridad !== "must") continue;
  for (const c of r.criterios) if (c.estado !== "verificado") faltantes.push({ req: r.id, texto: r.requerimiento.slice(0, 70), criterio: c.n, when: c.WHEN, estado: c.estado });
}
const musts = reqs.filter(r => r.prioridad === "must");
return ok({
  requerimientos: reqs.length, musts: musts.length,
  LISTO: faltantes.length === 0 && musts.length > 0,
  criterios_must_pendientes: faltantes.length,
  faltantes: faltantes.slice(0, 12),
  veredicto: faltantes.length === 0 ? "todos los must verificados: puedes declarar 'listo' con evidencia" : "NO declares listo: faltan " + faltantes.length + " criterios must",
});`,
      },
      {
        name: "coverage_matrix",
        desc: "Matriz requerimiento × criterios con estado, para auditoría rápida del avance.",
        params: {},
        code: `const st = store.load();
const reqs = st.reqs || [];
return ok({
  total_reqs: reqs.length,
  matriz: reqs.map(r => ({
    id: r.id, req: r.requerimiento.slice(0, 60), prioridad: r.prioridad,
    criterios: r.criterios.map(c => c.estado === "verificado" ? "V" : c.estado === "fallido" ? "F" : "·").join(" "),
    pct: Math.round(r.criterios.filter(c => c.estado === "verificado").length / r.criterios.length * 100),
  })),
});`,
      },
    ],
  },
  {
    id: "definition-of-done",
    title: "Definition of Done",
    tagline: "Checklists de completitud por tipo de entrega: código, análisis, documento, datos",
    category: "Especificación y Requisitos",
    pain: "'Ya está' significa cosas distintas para el agente y el humano: faltan tests, falta documentar, quedan TODOs. Sin checklist, el 90% se declara hecho al 70%.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/definition-of-done/. Plantillas de DoD por tipo de entrega + evaluación de entregas contra la plantilla activa.",
    tools: [
      {
        name: "get_templates",
        desc: "Devuelve las plantillas de Definition of Done incorporadas (código, análisis, documento, datos, migración) para elegir.",
        params: {},
        code: `const PLANTILLAS = {
  codigo: ["compila/interpreta sin errores", "tests del camino feliz pasando", "al menos un caso de error cubierto", "sin TODO/FIXME/placeholder", "nombres descriptivos revisados", "entrada inválida manejada sin crashear", "documento de decisiones si hubo trade-offs"],
  analisis: ["datos con fuente y fecha", "método explicado (cómo se calculó)", "supuestos declarados explícitamente", "limitaciones de validez anotadas", "conclusión accionable (no solo descriptiva)", "cifras con unidades", "comparado contra alternativa razonable"],
  documento: ["audiencia definida", "estructura con jerarquía clara", "sin secciones vacías o pendientes", "afirmaciones con fuente o marcadas como hipótesis", "resumen ejecutivo arriba", "terminología consistente", "formato solicitado respetado"],
  datos: ["esquema/documentado cada campo", "valores nulos cuantificados", "duplicados revisados", "tipos validados", "rango/límites plausibles comprobados", "muestra de filas inspeccionada visualmente", "transformaciones reversibles o registradas"],
  migracion: ["backup/rollback verificado", "plan de ejecución en pasos", "prueba en entorno no productivo", "criterio de éxito medible", "plan B si falla a mitad", "quién autoriza y quién ejecuta", "ventana de interrupción acordada"],
};
return ok({ tipos: Object.keys(PLANTILLAS), plantillas: PLANTILLAS, uso: "activa una con set_active y evalúa cada entrega con evaluate" });`,
      },
      {
        name: "set_active",
        desc: "Activa una plantilla de DoD (opcionalmente con items extra propios de la entrega).",
        params: { tipo: { t: "enum", d: "Tipo de entrega", values: ["codigo", "analisis", "documento", "datos", "migracion"] }, items_extra: { t: "array", d: "Items adicionales del contexto", opt: true, def: [] } },
        code: `const st = store.load();
const PLANTILLAS = {
  codigo: ["compila/interpreta sin errores", "tests del camino feliz pasando", "al menos un caso de error cubierto", "sin TODO/FIXME/placeholder", "nombres descriptivos revisados", "entrada inválida manejada sin crashear", "documento de decisiones si hubo trade-offs"],
  analisis: ["datos con fuente y fecha", "método explicado", "supuestos declarados", "limitaciones anotadas", "conclusión accionable", "cifras con unidades", "comparado contra alternativa"],
  documento: ["audiencia definida", "estructura jerárquica clara", "sin secciones vacías", "afirmaciones con fuente o marcadas como hipótesis", "resumen ejecutivo", "terminología consistente", "formato respetado"],
  datos: ["esquema documentado", "nulos cuantificados", "duplicados revisados", "tipos validados", "rangos plausibles", "muestra inspeccionada", "transformaciones registradas"],
  migracion: ["backup/rollback verificado", "pasos definidos", "probado en no-productivo", "criterio de éxito", "plan B", "autorización clara", "ventana acordada"],
};
st.activo = { tipo, items: [...PLANTILLAS[tipo], ...(items_extra || []).map(String)], activada: new Date().toISOString() };
store.save(st);
return ok({ activo: tipo, items: st.activo.items.length });`,
      },
      {
        name: "evaluate",
        desc: "Evalúa una entrega contra la DoD activa: marca items cumplidos y devuelve el % de done real.",
        params: { cumplidos: { t: "array", d: "Números de items cumplidos (índices 1-based)" }, notas: { t: "string", d: "Contexto de la evaluación", opt: true } },
        code: `const st = store.load();
if (!st.activo) return fail("activa una plantilla con set_active primero");
const items = st.activo.items;
const set = new Set((cumplidos || []).map(Number));
const detalle = items.map((it, i) => ({ n: i + 1, item: it, cumplido: set.has(i + 1) }));
const pct = Math.round(set.size / items.length * 100);
st.historial = st.historial || [];
st.historial.push({ tipo: st.activo.tipo, pct, notas: notas || null, faltantes: detalle.filter(d => !d.cumplido).map(d => d.item), ts: new Date().toISOString() });
store.save(st);
return ok({
  pct_done: pct + "%",
  cumplidos: set.size + "/" + items.length,
  faltan: detalle.filter(d => !d.cumplido).map(d => d.n + ". " + d.item),
  veredicto: pct === 100 ? "DONE de verdad: puedes entregar" : pct >= 80 ? "casi: cierra los items bloqueantes antes de entregar" : "NO está listo: declararlo 'hecho' ahora es mentir al cliente",
});`,
      },
      {
        name: "done_history",
        desc: "Historial de honestidad: % de done declarado por entrega y tendencia (¿mejora la disciplina?).",
        params: {},
        code: `const st = store.load();
const h = st.historial || [];
if (!h.length) return ok({ evaluaciones: 0 });
return ok({
  evaluaciones: h.length,
  done_medio: Number((h.reduce((s, x) => s + x.pct, 0) / h.length).toFixed(1)),
  entregas_prematuras: h.filter(x => x.pct < 80).length,
  tendencia: h.length >= 3 ? (h[h.length - 1].pct - h[0].pct > 0 ? "mejorando" : h[h.length - 1].pct - h[0].pct < 0 ? "empeorando: presión de plazo comiendo calidad" : "estable") : "insuficiente",
  ultimas: h.slice(-8).map(x => ({ tipo: x.tipo, pct: x.pct, faltaban: x.faltantes.length })),
});`,
      },
    ],
  },
  {
    id: "spec-diff-impact",
    title: "Spec Diff Impact",
    tagline: "Cambia la spec en mitad de la ejecución y calcula el impacto: qué trabajo se invalida y qué sobrevive",
    category: "Especificación y Requisitos",
    pain: "El humano cambia la spec cuando ya llevas 3 horas construyendo: el agente no sabe qué de lo hecho sirve, qué hay que tirar y qué hay que rehacer, así que lo rehace TODO (o nada).",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/spec-diff-impact/. Guarda la spec viva (requisitos numerados), calcula diffs semánticos entre versiones y estima trabajo invalidado/reutilizable con su costo.",
    tools: [
      {
        name: "save_version",
        desc: "Guarda una versión de la spec (requisitos como lista) y devuelve el diff contra la anterior si existe.",
        params: { requisitos: { t: "array", d: "Lista de requisitos de esta versión" }, version_label: { t: "string", d: "Etiqueta (v1, post-feedback...)", opt: true } },
        code: `const st = store.load();
st.versiones = st.versiones || [];
const reqs = (requisitos || []).map(String).filter(Boolean);
const prev = st.versiones[st.versiones.length - 1];
const tokens = (s) => new Set(String(s).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
const v: any = { n: st.versiones.length + 1, label: version_label || "v" + (st.versiones.length + 1), requisitos: reqs, ts: new Date().toISOString() };
if (prev) {
  v.diff = { añadidos: [], modificados: [], eliminados: [] };
  const prevSets = prev.requisitos.map(r => tokens(r));
  const nuevosSets = reqs.map(r => tokens(r));
  const usados = new Array(prev.requisitos.length).fill(false);
  for (let i = 0; i < reqs.length; i++) {
    let mejor = -1, mejorScore = 0;
    for (let j = 0; j < prev.requisitos.length; j++) {
      if (usados[j]) continue;
      const inter = [...nuevosSets[i]].filter(w => prevSets[j].has(w)).length;
      const score = inter / new Set([...nuevosSets[i], ...prevSets[j]]).size;
      if (score > mejorScore) { mejorScore = score; mejor = j; }
    }
    if (mejor === -1 || mejorScore < 0.25) v.diff.añadidos.push({ req: reqs[i] });
    else if (mejorScore < 0.85) { v.diff.modificados.push({ antes: prev.requisitos[mejor], ahora: reqs[i], similitud: Number(mejorScore.toFixed(2)) }); usados[mejor] = true; }
    else usados[mejor] = true;
  }
  for (let j = 0; j < prev.requisitos.length; j++) if (!usados[j]) v.diff.eliminados.push({ req: prev.requisitos[j] });
}
st.versiones.push(v);
store.save(st);
return ok({ version: v.n, label: v.label, requisitos: reqs.length, diff: v.diff || "primera versión (sin anterior)" });`,
      },
      {
        name: "impact_analysis",
        desc: "Dado el último cambio de spec y el trabajo hecho (lista de entregables), estima qué se invalida y qué sobrevive.",
        params: { trabajo_hecho: { t: "array", d: "Entregables/artefactos producidos hasta ahora (texto)" }, horas_invertidas: { t: "number", d: "Horas totales invertidas", opt: true } },
        code: `const st = store.load();
if (st.versiones?.length < 2) return fail("necesitas >=2 versiones de spec (save_version)");
const prev = st.versiones[st.versiones.length - 2];
const cur = st.versiones[st.versiones.length - 1];
const diff = cur.diff;
if (!diff) return fail("el diff no se calculó");
const tokens = (s) => new Set(String(s).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
const items = (trabajo_hecho || []).map(String).filter(Boolean);
const eliminadosTokens = diff.eliminados.map(e => tokens(e.req));
const modificadosTokens = diff.modificados.map(m => tokens(m.antes));
const evaluacion = items.map(item => {
  const it = tokens(item);
  const pisaEliminado = eliminadosTokens.some(et => [...et].filter(w => it.has(w)).length >= Math.max(1, Math.floor(et.size * 0.3)));
  const pisaModificado = modificadosTokens.some(mt => [...mt].filter(w => it.has(w)).length >= Math.max(1, Math.floor(mt.size * 0.3)));
  const estado = pisaEliminado ? "INVALIDADO" : pisaModificado ? "REVISAR" : "SOBREVIVE";
  return { entregable: item.slice(0, 80), estado, razon: pisaEliminado ? "depende de requisito eliminado" : pisaModificado ? "requisito que sirve cambió de forma" : "no depende de nada que cambió" };
});
const pctInvalido = evaluacion.length ? evaluacion.filter(e => e.estado === "INVALIDADO").length / evaluacion.length : 0;
const horasPerdidas = horas_invertidas ? Number((horas_invertidas * pctInvalido).toFixed(1)) : null;
return ok({
  cambios: { añadidos: diff.añadidos.length, modificados: diff.modificados.length, eliminados: diff.eliminados.length },
  entregables: evaluacion,
  resumen: { invalidados: evaluacion.filter(e => e.estado === "INVALIDADO").length, revisar: evaluacion.filter(e => e.estado === "REVISAR").length, sobreviven: evaluacion.filter(e => e.estado === "SOBREVIVE").length },
  horas_estimadas_perdidas: horasPerdidas,
  consejo: "pRESUPUESTA el rework ANTES de aceptar el cambio de scope: " + (horasPerdidas ?? "calcula horas") + "h se pierden por requisitos eliminados",
});`,
      },
      {
        name: "version_history",
        desc: "Historial completo de versiones de la spec con sus diffs resumidos.",
        params: {},
        code: `const st = store.load();
const vs = st.versiones || [];
if (!vs.length) return ok({ versiones: 0 });
return ok({
  versiones: vs.map(v => ({
    n: v.n, label: v.label, requisitos: v.requisitos.length, ts: v.ts,
    cambio: v.diff ? "+ " + v.diff.añadidos.length + " / ~ " + v.diff.modificados.length + " / - " + v.diff.eliminados.length : "inicial",
  })),
});`,
      },
      {
        name: "churn_alert",
        desc: "Analiza el churn de spec: frecuencia de cambios y si el cambio reciente es patrón (tercera vez que se pide lo mismo).",
        params: {},
        code: `const st = store.load();
const vs = st.versiones || [];
if (vs.length < 3) return ok({ versiones: vs.length, churn: "insuficiente para analizar" });
const cambios = vs.slice(1).map(v => v.diff.añadidos.length + v.diff.modificados.length + v.diff.eliminados.length);
const churnMedio = cambios.reduce((a, b) => a + b, 0) / cambios.length;
const ventanas = [];
for (let i = 0; i + 2 <= vs.length; i++) ventanas.push(Number(((new Date(vs[i + 1].ts) - new Date(vs[i].ts)) / 3600000).toFixed(1)));
return ok({
  versiones: vs.length, cambios_por_version: cambios,
  churn_medio: Number(churnMedio.toFixed(1)),
  horas_entre_versiones: ventanas,
  veredicto: churnMedio > 4 ? "CHURN ALTO: la spec no está madura: congela cambios y pide una reunión de requisitos" : churnMedio > 2 ? "churn moderado: versiona menos y agrupa feedback" : "spec estable",
});`,
      },
    ],
  },
  {
    id: "requirements-matrix",
    title: "Requirements Matrix",
    tagline: "Trazabilidad requisito → tarea → evidencia: nada se pierde entre lo pedido y lo entregado",
    category: "Especificación y Requisitos",
    pain: "Sin trazabilidad, requisitos se pierden en el camino: el agente los olvida, las tareas derivan y al final nadie puede demostrar que cada requisito pedido tiene evidencia de cumplimiento.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/requirements-matrix/. Matriz R-T-E: requisito ↔ tareas ligadas ↔ evidencia de cumplimiento. Detecta requisitos huérfanos, tareas sin requisito y cobertura global.",
    tools: [
      {
        name: "add_requirement",
        desc: "Añade un requisito rastrible al backlog de la misión.",
        params: { requisito: { t: "string", d: "Texto del requisito" }, fuente: { t: "string", d: "Quién lo pidió y cuándo", opt: true } },
        code: `const st = store.load();
st.reqs = st.reqs || [];
const id = "R" + (st.reqs.length + 1).toString().padStart(3, "0");
st.reqs.push({ id, requisito, fuente: fuente || null, tareas: [], evidencia: null, estado: "abierto", creado: new Date().toISOString() });
store.save(st);
return ok({ requisito_id: id, total: st.reqs.length });`,
      },
      {
        name: "link_task",
        desc: "Liga una tarea a un requisito (la tarea sirve a ese requisito).",
        params: { requisito_id: { t: "string", d: "ID del requisito (R001)" }, tarea: { t: "string", d: "Descripción de la tarea" } },
        code: `const st = store.load();
const r = (st.reqs || []).find(x => x.id === requisito_id);
if (!r) return fail("requisito no encontrado: " + requisito_id);
r.tareas.push({ tarea, estado: "pendiente", ts: new Date().toISOString() });
store.save(st);
return ok({ requisito: r.id, tareas_ligadas: r.tareas.length });`,
      },
      {
        name: "complete_task",
        desc: "Marca una tarea ligada como hecha; avanza el estado del requisito.",
        params: { requisito_id: { t: "string", d: "ID del requisito" }, tarea: { t: "string", d: "Texto (prefijo) de la tarea a cerrar" } },
        code: `const st = store.load();
const r = (st.reqs || []).find(x => x.id === requisito_id);
if (!r) return fail("requisito no encontrado");
const t = r.tareas.find(x => x.tarea.startsWith(tarea.slice(0, 30)) && x.estado !== "hecha");
if (!t) return fail("tarea no encontrada o ya hecha");
t.estado = "hecha";
t.hecha_ts = new Date().toISOString();
store.save(st);
return ok({ tarea: t.tarea.slice(0, 70), restantes: r.tareas.filter(x => x.estado !== "hecha").length });`,
      },
      {
        name: "attach_evidence",
        desc: "Adjunta evidencia de cumplimiento a un requisito y márcalo cubierto.",
        params: { requisito_id: { t: "string", d: "ID del requisito" }, evidencia: { t: "string", d: "Evidencia (test, URL, salida, revisión)" } },
        code: `const st = store.load();
const r = (st.reqs || []).find(x => x.id === requisito_id);
if (!r) return fail("requisito no encontrado");
if (r.tareas.length === 0) return ok({ advertencia: "requisito SIN tareas: la evidencia no tiene trabajo trazado detrás", requisito: r.id });
r.evidencia = evidencia;
r.estado = "cubierto";
store.save(st);
return ok({ requisito: r.id, estado: "cubierto", evidencia: evidencia.slice(0, 90) });`,
      },
      {
        name: "trace_report",
        desc: "Reporte de trazabilidad: cobertura, huérfanos (requisito sin tarea, tarea sin requisito) y % verificado.",
        params: {},
        code: `const st = store.load();
const reqs = st.reqs || [];
if (!reqs.length) return ok({ requisitos: 0 });
const huerfanosReq = reqs.filter(r => r.tareas.length === 0);
const cubiertos = reqs.filter(r => r.estado === "cubierto");
return ok({
  requisitos: reqs.length,
  cubiertos_con_evidencia: cubiertos.length,
  cobertura_pct: Math.round(cubiertos.length / reqs.length * 100),
  requisitos_huerfanos_sin_tareas: huerfanosReq.map(r => ({ id: r.id, requisito: r.requisito.slice(0, 70) })),
  requisitos_sin_evidencia: reqs.filter(r => r.estado !== "cubierto" && r.tareas.length > 0).map(r => ({ id: r.id, tareas_hechas: r.tareas.filter(t => t.estado === "hecha").length + "/" + r.tareas.length })),
  tareas_totales: reqs.reduce((s, r) => s + r.tareas.length, 0),
  veredicto: cubiertos.length === reqs.length ? "trazabilidad completa: cada requisito tiene evidencia" : "faltan " + (reqs.length - cubiertos.length) + " requisitos por evidenciar",
});`,
      },
      {
        name: "audit_question",
        desc: "Responde la pregunta de auditoría: '¿dónde está la evidencia del requisito X?'.",
        params: { requisito_id: { t: "string", d: "ID o texto parcial del requisito" } },
        code: `const st = store.load();
const reqs = st.reqs || [];
const r = reqs.find(x => x.id.toLowerCase() === String(requisito_id).toLowerCase()) || reqs.find(x => x.requisito.toLowerCase().includes(String(requisito_id).toLowerCase()));
if (!r) return fail("requisito no encontrado");
return ok({
  requisito: r.id, texto: r.requisito, fuente: r.fuente,
  tareas_trazadas: r.tareas.map(t => ({ tarea: t.tarea.slice(0, 70), estado: t.estado })),
  evidencia: r.evidencia || "SIN EVIDENCIA: no se puede auditar el cumplimiento",
});`,
      },
    ],
  },
];

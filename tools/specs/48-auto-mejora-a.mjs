// ═══ CATEGORÍA: Dolores FUTUROS · Auto-Mejora (A) ═══
// Evidencia: los agentes repiten errores idénticos porque sus fallos nunca se
// agrupan (taxonomía), nunca se excavan (5-whys) ni se destilan (reflexión).
// El postmortem existe en ops; el agente no tiene el hábito de hacer el suyo.
export default [
  {
    id: "error-taxonomy",
    title: "Error Taxonomy",
    tagline: "Agrupa los errores del agente en familias con firma común: el error 47 y el 3 son el MISMO error, ahora lo verás",
    category: "Auto-Mejora",
    pain: "El agente acumula 200 errores registrados como 200 eventos únicos: sin clustering por similitud, el patrón que se repite 40 veces es invisible y cada 'arreglo' ataca el síntoma de la semana.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/error-taxonomy/. Ingiere errores con contexto; clustering por similitud Jaccard de tokens + tipo de operación; las familias se nombran y se cuenta su recurrencia real.",
    tools: [
      {
        name: "ingest_errors",
        desc: "Ingiere una tanda de errores con su contexto (operación, mensaje, fase).",
        params: { errores: { t: "array", d: "Errores {mensaje, operacion?, fase?, severidad?}" } },
        code: `const st = store.load();
st.errores = st.errores || [];
const limpios = (errores || []).filter(e => e && e.mensaje).map(e => ({ mensaje: String(e.mensaje).slice(0, 200), operacion: String(e.operacion || ""), fase: String(e.fase || ""), severidad: String(e.severidad || "media"), ts: new Date().toISOString() }));
if (!limpios.length) return fail("sin errores con mensaje");
st.errores.push(...limpios);
if (st.errores.length > 3000) st.errores = st.errores.slice(-2500);
store.save(st);
return ok({ ingeridos: limpios.length, total_historico: st.errores.length, siguiente: "agrupa con cluster" });`,
      },
      {
        name: "cluster",
        desc: "Agrupa los errores en familias por similitud de firma (tokens del mensaje + operación).",
        params: { umbral_similitud: { t: "number", d: "Similitud Jaccard mínima para agrupar (0.3-0.6 recomendado)", opt: true, def: 0.45 } },
        code: `const st = store.load();
const errores = st.errores || [];
if (errores.length < 5) return fail("con menos de 5 errores no hay patrón que descubrir");
const firma = (e) => new Set(String(e.mensaje).toLowerCase().split(/[^a-z0-9áéíóúñ%]+/).filter(w => w.length > 2 && !/\\d/.test(w)).concat(e.operacion ? [e.operacion.toLowerCase()] : []));
const jaccard = (a, b) => { const inter = [...a].filter(x => b.has(x)).length; const uni = a.size + b.size - inter; return uni ? inter / uni : 0; };
const familias = [];
const asignados = new Array(errores.length).fill(false);
errores.forEach((e, i) => {
  if (asignados[i]) return;
  const familia = [i];
  asignados[i] = true;
  for (let j = i + 1; j < errores.length; j++) {
    if (asignados[j]) continue;
    if (jaccard(firma(errores[i]), firma(errores[j])) >= umbral_similitud) { familia.push(j); asignados[j] = true; }
  }
  const miembros = familia.map(idx => errores[idx]);
  const palabras = {};
  firma(errores[i]).forEach(w => { palabras[w] = 0; });
  miembros.forEach(m => { const f = firma(m); Object.keys(palabras).forEach(w => { if (f.has(w)) palabras[w]++; }); });
  const topPalabras = Object.keys(palabras).sort((a, b) => palabras[b] - palabras[a]).slice(0, 4);
  familias.push({
    familia: "F" + (familias.length + 1),
    recurrencia: miembros.length,
    firma_comun: topPalabras.join(" · "),
    ejemplo_representativo: miembros[0].mensaje.slice(0, 90),
    operaciones_involucradas: [...new Set(miembros.map(m => m.operacion).filter(Boolean))].slice(0, 3),
    severidad_dominante: miembros.filter(m => m.severidad === "alta").length > miembros.length / 2 ? "alta" : "media/baja",
    primera_vez: miembros[0].ts,
    ultima_vez: miembros[miembros.length - 1].ts
  });
});
familias.sort((a, b) => b.recurrencia - a.recurrencia);
st.familias = familias;
store.save(st);
return ok({ errores_analizados: errores.length, familias: familias.length, top_familias: familias.slice(0, 8), lectura: familias[0] && familias[0].recurrencia > errores.length * 0.3 ? "la familia " + familias[0].familia + " agrupa el " + Number((familias[0].recurrencia / errores.length * 100).toFixed(0)) + "% de TODOS los errores: arregla esto y tu fiabilidad cambia de escala" : "error repartido: arregla las 2-3 familias de arriba" });`,
      },
      {
        name: "name_cluster",
        desc: "Bautiza una familia con su causa probable (convierte el patrón en diagnóstico).",
        params: { familia: { t: "string", d: "Id de familia (F1)" }, nombre: { t: "string", d: "Nombre diagnóstico (ej: timeouts-por-reintentos-en-cadena)" }, causa_probable: { t: "string", d: "Qué la causa realmente" } },
        code: `const st = store.load();
const f = (st.familias || []).find(x => x.familia === familia);
if (!f) return fail("familia no encontrada: " + familia + " (corre cluster primero)");
f.nombre_diagnostico = nombre;
f.causa_probable = causa_probable;
store.save(st);
return ok({ familia, nombre_diagnostico: nombre, causa_probable, recurrencia: f.recurrencia, siguiente: "registra la causa raíz con root-cause-tree de otro MCP y cruza" });`,
      },
      {
        name: "taxonomy_report",
        desc: "Reporte de la taxonomía: familias nombradas vs anónimas, cobertura y foco de arreglo.",
        params: {},
        code: `const st = store.load();
const familias = st.familias || [];
if (!familias.length) return ok({ familias: 0, mensaje: "corre cluster primero" });
const nombradas = familias.filter(f => f.nombre_diagnostico);
const anonimas = familias.filter(f => !f.nombre_diagnostico);
const totalErrores = familias.reduce((a, f) => a + f.recurrencia, 0) || 1;
const concentracion = Number((familias.slice(0, 3).reduce((a, f) => a + f.recurrencia, 0) / totalErrores * 100).toFixed(0));
return ok({ familias: familias.length, errores_total: totalErrores, nombradas: nombradas.map(f => f.familia + " = " + f.nombre_diagnostico + " (" + f.recurrencia + "x)"), anonimas: anonimas.length + " familias sin nombre: no puedes arreglar lo que no sabes nombrar", concentracion_top3: concentracion + "% de los errores viven en las 3 familias principales", estrategia: concentracion > 60 ? "arregla las 3 de arriba y cierra la mayoría del problema: el 80/20 se cumple" : "error disperso: revisa si hay una causa sistémica común (contexto corrupto, datos sucios)" });`,
      },
    ],
  },
  {
    id: "root-cause-tree",
    title: "Root Cause Tree",
    tagline: "Cinco porqués disciplinados: cada porqué debe responder al anterior o el árbol se corta antes de la raíz",
    category: "Auto-Mejora",
    pain: "El agente hace 'análisis de causa raíz' en un párrafo: los porqués no se encadenan, saltan de tema y la 'raíz' es en realidad el tercer síntoma. Sin disciplina estructural, el RCA es literatura.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/root-cause-tree/. Árboles de porqués encadenados; valida que cada respuesta responda a la pregunta anterior (coherencia textual), detecta paradas prematuras y separa causa raíz de factores contribuyentes.",
    tools: [
      {
        name: "start_tree",
        desc: "Abre un árbol de análisis con el problema observable.",
        params: { problema: { t: "string", d: "El problema visible (síntoma, no causa)" } },
        code: `const st = store.load();
st.arboles = st.arboles || [];
const id = "rct_" + String(st.arboles.length + 1).padStart(4, "0");
st.arboles.push({ id, problema, niveles: [], raiz_declarada: null, factores: [], creado: new Date().toISOString() });
store.save(st);
return ok({ id, problema: problema.slice(0, 100), regla: "cada porqué debe responder EXACTAMENTE al nivel anterior: si cambia de tema, es un árbol nuevo" });`,
      },
      {
        name: "add_why",
        desc: "Añade un nivel de porqué respondiendo al nivel anterior.",
        params: { id: { t: "string", d: "Id del árbol" }, respuesta: { t: "string", d: "Respuesta al porqué actual" }, evidencia: { t: "string", d: "Qué te hace creer esa respuesta", opt: true } },
        code: `const st = store.load();
const a = (st.arboles || []).find(x => x.id === id);
if (!a) return fail("árbol no encontrado");
if (a.raiz_declarada) return fail("árbol ya cerrado con raíz: abre otro para explorar más");
const nivel = a.niveles.length + 1;
if (nivel > 7) return fail("más de 7 porqués: el problema está mal delimitado o estás dando vueltas");
a.niveles.push({ nivel, respuesta: respuesta.slice(0, 200), evidencia: evidencia || "", ts: new Date().toISOString() });
store.save(st);
return ok({ id, nivel, respuesta: respuesta.slice(0, 80), profundidad_recomendada: nivel < 5 ? "sigue preguntando: aún en zona de síntomas" : "zona de raíz: valida antes de profundizar más", siguiente: nivel >= 3 ? "valida la coherencia con validate_chain" : "añade el siguiente porqué" });`,
      },
      {
        name: "validate_chain",
        desc: "Valida que la cadena de porqués es coherente: cada respuesta trata sobre la anterior.",
        params: { id: { t: "string", d: "Árbol" } },
        code: `const st = store.load();
const a = (st.arboles || []).find(x => x.id === id);
if (!a) return fail("árbol no encontrado");
const n = a.niveles.length;
if (n < 2) return fail("necesitas al menos 2 niveles");
const tokens = (x) => new Set(String(x).toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 3));
const problemas = [];
for (let i = 1; i < n; i++) {
  const ant = tokens(a.niveles[i - 1].respuesta);
  const act = tokens(a.niveles[i].respuesta);
  const solape = [...ant].filter(w => act.has(w)).length;
  const ratio = solape / Math.max(ant.size, 1);
  if (ratio < 0.08) problemas.push({ entre_niveles: [i, i + 1], tipo: "SALTO_DE_TEMA", detalle: "la respuesta " + (i + 1) + " no menciona nada del nivel " + i + ": probablemente cambiaste de problema a mitad de cadena" });
  if (ratio > 0.85) problemas.push({ entre_niveles: [i, i + 1], tipo: "TAUTOLOGÍA", detalle: "la respuesta " + (i + 1) + " repite el nivel " + i + " casi igual: estás girando en el sitio" });
}
const sinEvidencia = a.niveles.filter(x => !x.evidencia).length;
return ok({ id, niveles: n, problemas_de_cadena: problemas, niveles_sin_evidencia: sinEvidencia, veredicto: problemas.length ? "cadena ROTA: corrige los saltos antes de declarar raíz (una raíz alcanzada por una cadena rota es una raíz imaginaria)" : "cadena coherente" + (n >= 5 ? " y profunda" : " pero CORTA: con " + n + " niveles sueles parar en síntomas intermedios"), aviso_evidencia: sinEvidencia > n / 2 ? "más de la mitad de los niveles son conjetura sin evidencia: la raíz será una hipótesis, no un hallazgo" : null });`,
      },
      {
        name: "declare_root",
        desc: "Declara la causa raíz (con validación de profundidad y factores contribuyentes).",
        params: { id: { t: "string", d: "Árbol" }, causa_raiz: { t: "string", d: "La causa raíz identificada" }, tipo_causa: { t: "enum", d: "Naturaleza de la raíz", values: ["proceso", "conocimiento", "herramienta", "datos", "incentivo", "humana"] }, factores_contribuyentes: { t: "array", d: "Factores que empeoraron sin causar", opt: true } },
        code: `const st = store.load();
const a = (st.arboles || []).find(x => x.id === id);
if (!a) return fail("árbol no encontrado");
if (a.raiz_declarada) return fail("raíz ya declarada");
const n = a.niveles.length;
if (n < 3) return fail("con " + n + " niveles has parado demasiado arriba: esa no es raíz, es el síntoma disfrazado");
a.raiz_declarada = { causa_raiz, tipo_causa, niveles_excavados: n, declarada: new Date().toISOString() };
a.factores = (factores_contribuyentes || []).map(String);
store.save(st);
return ok({ id, causa_raiz: causa_raiz.slice(0, 120), tipo_causa, niveles_excavados: n, factores_contribuyentes: a.factores, correccion_esperada: tipo_causa === "proceso" ? "cambia el PROCESO (checklist, gate): el 'ten más cuidado' no arregla procesos" : tipo_causa === "herramienta" ? "cambia la HERRAMIENTA o su configuración" : tipo_causa === "conocimiento" ? "añade el conocimiento al sistema (doc recuperable, lección en lesson-library)" : tipo_causa === "datos" ? "arregla los DATOS en origen y añade validación de entrada" : tipo_causa === "incentivo" ? "los incentivos hacen que el error sea racional: sin cambiarlos, el error volverá" : "causa humana: simplifica la tarea, no blames al humano" });`,
      },
    ],
  },
  {
    id: "reflection-journal",
    title: "Reflection Journal",
    tagline: "Diario de reflexión del agente: qué funcionó, qué no, qué sorprendió — y las lecciones destiladas al final del período",
    category: "Auto-Mejora",
    pain: "El agente termina 30 tareas y no extrae NADA: las sorpresas de la semana pasada se repiten esta semana porque nunca hubo un momento estructurado de mirar atrás. Sin reflexión, la experiencia no se convierte en aprendizaje.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/reflection-journal/. Entradas de reflexión (funcionó/falló/sorpresa/lección candidata); revisión de período que cruza entradas y promueve lecciones candidatas con ≥2 apariciones a lecciones confirmadas.",
    tools: [
      {
        name: "new_reflection",
        desc: "Registra una reflexión post-tarea: lo que funcionó, lo que falló y lo que sorprendió.",
        params: { tarea: { t: "string", d: "Tarea/Contexto de la reflexión" }, funciono: { t: "string", d: "Qué táctica/decisión funcionó y por qué crees que sí" }, fallo: { t: "string", d: "Qué falló o costó de más" }, sorpresa: { t: "string", d: "Qué te sorprendió (lo no anticipado)", opt: true }, leccion_candidata: { t: "string", d: "Regla extraíble de esta experiencia", opt: true } },
        code: `const st = store.load();
st.reflexiones = st.reflexiones || [];
st.reflexiones.push({ tarea, funciono, fallo, sorpresa: sorpresa || "", leccion_candidata: leccion_candidata || "", promovida: false, ts: new Date().toISOString() });
store.save(st);
return ok({ registrada: true, reflexiones_totales: st.reflexiones.length, calidad: sorpresa && leccion_candidata ? "ALTA: sorpresa + lección, la materia prima del aprendizaje" : sorpresa ? "media: hay sorpresa pero no lección: ¿qué harías distinto?" : "baja: reflexión descriptiva, extrae la regla" });`,
      },
      {
        name: "review_period",
        desc: "Revisa el período: patrones entre reflexiones y lecciones candidatas que se repiten.",
        params: { dias: { t: "number", d: "Ventana hacia atrás", opt: true, def: 14 } },
        code: `const st = store.load();
const desde = Date.now() - dias * 86400000;
const recientes = (st.reflexiones || []).filter(r => new Date(r.ts).getTime() >= desde);
if (!recientes.length) return fail("sin reflexiones en los últimos " + dias + " días");
const tokens = (x) => new Set(String(x).toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 3));
const lecciones = recientes.filter(r => r.leccion_candidata);
const repetidas = [];
const vistas = new Set();
lecciones.forEach(l => {
  const clave = [...tokens(l.leccion_candidata)].slice(0, 5).sort().join("|");
  if (vistas.has(clave)) { const existente = repetidas.find(r => r.clave === clave); if (existente) existente.veces++; else repetidas.push({ clave, leccion: l.leccion_candidata.slice(0, 90), veces: 2 }); }
  vistas.add(clave);
});
const sorpresas = recientes.filter(r => r.sorpresa);
const fallosRecurrentes = [];
recientes.forEach(r => { const t = [...tokens(r.fallo)]; fallosRecurrentes.push(t); });
const conteoPalabras = {};
fallosRecurrentes.forEach(t => t.forEach(w => { conteoPalabras[w] = (conteoPalabras[w] || 0) + 1; }));
const topFallos = Object.keys(conteoPalabras).sort((a, b) => conteoPalabras[b] - conteoPalabras[a]).slice(0, 5).map(w => w + " (" + conteoPalabras[w] + "x)");
return ok({ periodo_dias: dias, reflexiones: recientes.length, con_leccion: lecciones.length, con_sorpresa: sorpresas.length, lecciones_repetidas: repetidas.sort((a, b) => b.veces - a.veces), temas_de_fallo_dominantes: topFallos, accion: repetidas.length ? "las lecciones repetidas van a lesson-library como REGLAS confirmadas: " + repetidas.slice(0, 3).map(r => r.leccion.slice(0, 50)).join(" / ") : "sin repetición aún: sigue registrando, el patrón aparece" });`,
      },
      {
        name: "extract_lessons",
        desc: "Extrae las lecciones confirmables: candidatas que aparecen 2+ veces o con sorpresa fuerte.",
        params: {},
        code: `const st = store.load();
const rs = st.reflexiones || [];
if (!rs.length) return fail("sin reflexiones");
const tokens = (x) => new Set(String(x).toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 3));
const buckets = {};
rs.forEach((r, i) => {
  if (!r.leccion_candidata || r.promovida) return;
  const clave = [...tokens(r.leccion_candidata)].slice(0, 5).sort().join("|");
  buckets[clave] = buckets[clave] || { leccion: r.leccion_candidata, indices: [], conSorpresa: false };
  buckets[clave].indices.push(i);
  if (r.sorpresa) buckets[clave].conSorpresa = true;
});
const confirmables = Object.keys(buckets).filter(k => buckets[k].indices.length >= 2 || buckets[k].conSorpresa).map(k => ({ leccion: buckets[k].leccion.slice(0, 110), apariciones: buckets[k].indices.length, respaldada_por_sorpresa: buckets[k].conSorpresa, estado: buckets[k].indices.length >= 3 ? "REGLA (3+ apariciones): incorporated al comportamiento" : "candidata sólida: pendiente de una aparición más" }));
return ok({ reflexiones: rs.length, lecciones_confirmables: confirmables, no_promover: Object.keys(buckets).length - confirmables.length + " candidatas únicas sin repetición: aún anecdóticas, no las promuevas" });`,
      },
    ],
  },
]

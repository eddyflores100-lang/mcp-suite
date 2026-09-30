// ═══ CATEGORÍA: Dolores FUTUROS · Razonamiento Estructurado (A) ═══
// Evidencia: los LLM argumentan con fluidez pero sin estructura verificable:
// sin mapa de Toulmin no se ve el warrant faltante; sin actualización bayesiana
// las creencias no se mueven con evidencia; la escalera de causalidad se
// confunde en cada respuesta.
export default [
  {
    id: "argument-cartographer",
    title: "Argument Cartographer",
    tagline: "Mapas de argumento estilo Toulmin: afirmación, garantía, respaldo y refutación — con los huecos visibles",
    category: "Razonamiento",
    pain: "El argumento del agente SUENA sólido pero le falta la garantía que conecta datos con conclusión: nadie dibuja el mapa, así que el agujero lógico queda invisible hasta que un humano lo destapa en producción.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/argument-cartographer/. Modela argumentos Toulmin (claim/grounds/warrant/backing/qualifier/rebuttal); detecta componentes faltantes, evalúa fuerza y expone superficie de ataque.",
    tools: [
      {
        name: "map_argument",
        desc: "Mapea un argumento completo en componentes Toulmin.",
        params: { nombre: { t: "string", d: "Nombre del argumento" }, claim: { t: "string", d: "La afirmación principal" }, grounds: { t: "string", d: "Los datos/evidencia que la apoyan" }, warrant: { t: "string", d: "La regla que conecta grounds con claim (¿por qué esos datos implican esa conclusión?)", opt: true }, backing: { t: "string", d: "Qué respalda la garantía (estudio, norma, experiencia)", opt: true }, qualifier: { t: "string", d: "Matiz del claim (probablemente, en general, salvo...)", opt: true }, rebuttal: { t: "string", d: "Condiciones bajo las que el claim cae", opt: true } },
        code: `const st = store.load();
st.argumentos = st.argumentos || {};
if (st.argumentos[nombre]) return fail("argumento ya mapeado: " + nombre);
st.argumentos[nombre] = { nombre, claim, grounds, warrant: warrant || null, backing: backing || null, qualifier: qualifier || null, rebuttal: rebuttal || null, mapeado: new Date().toISOString(), ataques_recibidos: [] };
store.save(st);
return ok({ nombre, componentes: { claim: "OK", grounds: "OK", warrant: warrant ? "OK" : "FALTA", backing: backing ? "OK" : "FALTA", qualifier: qualifier ? "OK" : "FALTA (afirmación absoluta sin matiz)", rebuttal: rebuttal ? "OK" : "FALTA (no se contempla cuándo fallaría)" }, siguiente: "audita con find_gaps" });`,
      },
      {
        name: "find_gaps",
        desc: "Detecta los huecos lógicos del argumento: componentes faltantes y conexiones débiles.",
        params: { nombre: { t: "string", d: "Argumento" } },
        code: `const st = store.load();
const a = (st.argumentos || {})[nombre];
if (!a) return fail("argumento no encontrado: " + nombre);
const huecos = [];
if (!a.warrant) huecos.push({ componente: "warrant", severidad: "ALTA", detalle: "no existe la regla que conecte los datos con la conclusión: el argumento es una yuxtaposición, no una inferencia", remedio: "escribe explícitamente: 'SI " + a.grounds.slice(0, 40) + "... ENTONCES " + a.claim.slice(0, 40) + "... PORQUE __'" });
if (!a.backing && a.warrant) huecos.push({ componente: "backing", severidad: a.warrant.length < 40 ? "ALTA" : "media", detalle: "la garantía no tiene respaldo: ¿por qué confiar en esa regla?", remedio: "cita la fuente que valida el warrant" });
if (!a.rebuttal) huecos.push({ componente: "rebuttal", severidad: "media", detalle: "no se contempla ninguna condición de fallo: argumento blindado = argumento dogmático", remedio: "enumera al menos un escenario donde el claim no se sostenga" });
if (!a.qualifier && /\\b(todos|todas|siempre|nunca|jamás|ninguno)\\b/i.test(a.claim)) huecos.push({ componente: "qualifier", severidad: "ALTA", detalle: "claim ABSOLUTO sin matiz y sin excepciones contempladas", remedio: "sustituye el universal por 'la mayoría/en este contexto/salvo X'" });
const groundsVagos = /\\b(muchos|varios|algunos|mucho|bastante|abundante)\\b/i.test(a.grounds || "");
if (groundsVagos) huecos.push({ componente: "grounds", severidad: "media", detalle: "evidencia con cuantificadores vagos ('" + (a.grounds.match(/\\b(muchos|varios|algunos|mucho|bastante)\\b/i) || ["vago"])[0] + "'): sin números no hay falsabilidad", remedio: "cuantifica: cuántos, de qué población, en qué período" });
return ok({ nombre, huecos_totales: huecos.length, huecos, solidez_base: huecos.filter(h => h.severidad === "ALTA").length === 0 ? "estructura completa: la fuerza depende de la verdad de los grounds" : "estructura COJA: corrige los huecos ALTO antes de fiarte de la conclusión" });`,
      },
      {
        name: "attack_surface",
        desc: "Calcula la superficie de ataque: por dónde caería el argumento primero.",
        params: { nombre: { t: "string", d: "Argumento" } },
        code: `const st = store.load();
const a = (st.argumentos || {})[nombre];
if (!a) return fail("argumento no encontrado");
const vectores = [];
if (a.warrant) vectores.push({ vector: "negar el warrant", como: "cuestionar la regla '" + a.warrant.slice(0, 60) + "': buscar un contraejemplo de la misma regla con distinto resultado", resistencia: a.backing ? "media (hay backing)" : "BAJA (sin respaldo)" });
if (a.grounds) vectores.push({ vector: "negar los grounds", como: "atacar la veracidad o la representatividad de: '" + a.grounds.slice(0, 60) + "'", resistencia: /\\d/.test(a.grounds) ? "media-alta (hay cifras)" : "BAJA (evidencia no cuantificada)" });
if (!a.rebuttal) vectores.push({ vector: "presentar la rebuttal que falta", como: "encontrar UN caso donde el claim falle: el argumento no contempla excepciones y cae entero", resistencia: "BAJA" });
vectores.push({ vector: "incluir el claim en otro contexto", como: "trasplantar la afirmación a un dominio donde no aplique y mostrar el absurdo", resistencia: a.qualifier ? "media (hay qualifier que acota)" : "BAJA" });
const masDebil = vectores.filter(v => v.resistencia.startsWith("BAJA"));
return ok({ nombre, vectores_de_ataque: vectores, vectores_sin_defensa: masDebil.map(v => v.vector), refuerza_primero: masDebil[0] ? masDebil[0].vector : "ningún vector está indefenso: argumento robusto (no por ello correcto)" });`,
      },
      {
        name: "strength_score",
        desc: "Puntúa la solidez estructural del argumento (0-100) con desglose.",
        params: { nombre: { t: "string", d: "Argumento" } },
        code: `const st = store.load();
const a = (st.argumentos || {})[nombre];
if (!a) return fail("argumento no encontrado");
const partes = [
  { parte: "claim matizado", pts: a.qualifier ? 15 : /\\b(todos|siempre|nunca)\\b/i.test(a.claim) ? 0 : 8, nota: a.qualifier ? "qualifier presente" : "sin qualifier" },
  { parte: "grounds cuantificados", pts: /\\d/.test(a.grounds || "") ? 25 : 10, nota: /\\d/.test(a.grounds || "") ? "evidencia con cifras" : "evidencia cualitativa" },
  { parte: "warrant explícito", pts: a.warrant ? 25 : 0, nota: a.warrant ? "regla de inferencia presente" : "inferencia implícita: el eslabón perdido" },
  { parte: "backing del warrant", pts: a.backing ? 15 : 0, nota: a.backing ? "respaldo citado" : "warrant en el aire" },
  { parte: "rebuttal contemplada", pts: a.rebuttal ? 20 : 5, nota: a.rebuttal ? "excepciones previstas" : "blindado al fracaso" }
];
const total = partes.reduce((s, p) => s + p.pts, 0);
a.ultimo_score = { total, ts: new Date().toISOString() };
store.save(st);
return ok({ nombre, score_estructural: total + "/100", desglose: partes, nivel: total >= 80 ? "SÓLIDO: sobrevive auditoría" : total >= 55 ? "MEJORABLE: refuerza los puntos flojos antes de decidir con él" : "FRÁGIL: este argumento no debe sostener ninguna decisión" });`,
      },
    ],
  },
  {
    id: "bayesian-updater",
    title: "Bayesian Updater",
    tagline: "Cree con números: hipótesis con prior, evidencias con verosimilitud y posteriores que se actualizan con traza explicada",
    category: "Razonamiento",
    pain: "El agente dice 'ahora estoy más seguro' sin números: sin prior ni verosimilitud, la 'actualización de creencia' es teatro. Cuando llega evidencia contradictoria no sabe si reforzar o abandonar la hipótesis.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/bayesian-updater/. Hipótesis con probabilidad a priori; cada evidencia aplica su likelihood ratio en espacio log-odds; la traza explica cada salto y detecta evidencia doblemente contada.",
    tools: [
      {
        name: "define_hypothesis",
        desc: "Define una hipótesis con su probabilidad a priori y justificación.",
        params: { hipotesis: { t: "string", d: "Enunciado de la hipótesis" }, prior: { t: "number", d: "Probabilidad inicial 0-1" }, justificacion_prior: { t: "string", d: "Por qué ese prior (base rate, historia, intuición experta)" } },
        code: `const st = store.load();
st.hipotesis = st.hipotesis || {};
const clave = hipotesis.toLowerCase().slice(0, 80);
if (st.hipotesis[clave]) return fail("hipótesis ya registrada");
if (prior <= 0 || prior >= 1) return fail("prior debe estar entre 0 y 1 (exclusivo)");
st.hipotesis[clave] = { hipotesis, prior, posterior: prior, justificacion_prior, evidencias: [], traza: [{ evento: "prior", p: prior, ts: new Date().toISOString() }] };
store.save(st);
return ok({ hipotesis: clave, prior, en_log_odds: Number(Math.log(prior / (1 - prior)).toFixed(3)), justificacion: justificacion_prior });`,
      },
      {
        name: "apply_evidence",
        desc: "Aplica una evidencia con su verosimilitud P(E|H) vs P(E|no H) y actualiza el posterior.",
        params: { hipotesis: { t: "string", d: "Hipótesis a actualizar" }, evidencia: { t: "string", d: "Descripción de la evidencia observada" }, p_e_dado_h: { t: "number", d: "P(E | hipótesis cierta) 0-1" }, p_e_dado_no_h: { t: "number", d: "P(E | hipótesis falsa) 0-1" }, fuente: { t: "string", d: "De dónde viene la evidencia", opt: true } },
        code: `const st = store.load();
const clave = hipotesis.toLowerCase().slice(0, 80);
const h = (st.hipotesis || {})[clave];
if (!h) return fail("hipótesis no registrada: usa define_hypothesis");
if (p_e_dado_h <= 0 || p_e_dado_h > 1 || p_e_dado_no_h <= 0 || p_e_dado_no_h > 1) return fail("verosimilitudes deben estar en (0, 1]");
const duplicada = h.evidencias.some(e => e.evidencia.toLowerCase().slice(0, 40) === evidencia.toLowerCase().slice(0, 40));
if (duplicada) return fail("evidencia sospechosamente duplicada (mismo texto): NO cuentes dos veces la misma observación, es el error bayesiano clásico");
const lr = p_e_dado_h / p_e_dado_no_h;
const oddsAntes = h.posterior / (1 - h.posterior);
const oddsDespues = oddsAntes * lr;
const nuevo = oddsDespues / (1 + oddsDespues);
h.evidencias.push({ evidencia, p_e_dado_h, p_e_dado_no_h, lr: Number(lr.toFixed(3)), fuente: fuente || "", ts: new Date().toISOString() });
h.posterior = nuevo;
h.traza.push({ evento: "evidencia: " + evidencia.slice(0, 50), lr: Number(lr.toFixed(3)), p: Number(nuevo.toFixed(4)), ts: new Date().toISOString() });
store.save(st);
return ok({ hipotesis: clave, evidencia: evidencia.slice(0, 80), likelihood_ratio: Number(lr.toFixed(3)) + (lr > 1 ? " (refuerza)" : lr < 1 ? " (debilita)" : " (neutra)"), posterior_antes: Number((oddsAntes / (1 + oddsAntes)).toFixed(4)), posterior_ahora: Number(nuevo.toFixed(4)), salto: nuevo > h.posterior ? "" : "", en_palabras: lr >= 10 ? "evidencia MUY FUERTE a favor" : lr >= 2 ? "evidencia moderada a favor" : lr > 0.5 ? "evidencia leve en contra" : lr > 0.1 ? "evidencia moderada en contra" : "evidencia MUY FUERTE en contra" });`,
      },
      {
        name: "posterior_view",
    desc: "Ranking de todas las hipótesis por posterior actual, con su historial de evidencias.",
        params: {},
        code: `const st = store.load();
const hs = __vals(st.hipotesis || {});
if (!hs.length) return ok({ hipotesis: 0, mensaje: "sin hipótesis registradas" });
const ranking = hs.map(h => ({ hipotesis: h.hipotesis, prior: h.prior, posterior: Number(h.posterior.toFixed(4)), confianza: h.posterior > 0.9 ? "MUY ALTA" : h.posterior > 0.7 ? "alta" : h.posterior > 0.3 ? "incierta" : h.posterior > 0.1 ? "baja" : "MUY BAJA", evidencias: h.evidencias.length, fuerza_neta: Number(h.evidencias.reduce((s, e) => s + Math.log(e.lr), 0).toFixed(2)) + " log-LR acumulado" })).sort((a, b) => b.posterior - a.posterior);
return ok({ hipotesis: ranking.length, ranking, lider: ranking[0], cobertura_total: Number(ranking.reduce((s, h) => s + h.posterior, 0).toFixed(2)) + " (si >> 1 hay hipótesis solapadas; si << 1 falta la hipótesis correcta)" });`,
      },
      {
        name: "explain_update",
        desc: "Explica la evolución completa de una hipótesis: cada salto, su evidencia y su dirección.",
        params: { hipotesis: { t: "string", d: "Hipótesis" } },
        code: `const st = store.load();
const clave = hipotesis.toLowerCase().slice(0, 80);
const h = (st.hipotesis || {})[clave];
if (!h) return fail("hipótesis no registrada");
const pasos = [];
let p = h.prior;
h.evidencias.forEach(e => {
  const odds = p / (1 - p);
  const nuevo = (odds * e.lr) / (1 + odds * e.lr);
  pasos.push({ desde: Number(p.toFixed(3)), hasta: Number(nuevo.toFixed(3)), direccion: e.lr > 1 ? "SUBE" : "BAJA", evidencia: e.evidencia.slice(0, 70), lr: e.lr, fuente: e.fuente });
  p = nuevo;
});
return ok({ hipotesis: h.hipotesis, prior_inicial: h.prior, posterior_final: Number(h.posterior.toFixed(4)), total_evidencias: h.evidencias.length, camino: pasos, lectura: h.evidencias.filter(e => e.lr > 2).length > h.evidencias.filter(e => e.lr < 0.5).length ? "la corriente de evidencia empuja a favor" : h.evidencias.filter(e => e.lr < 0.5).length > h.evidencias.filter(e => e.lr > 2).length ? "la corriente de evidencia empuja en contra: plantea la hipótesis alternativa YA" : "evidencia mixta: la hipótesis está mal formulada o falta discriminar", aviso_conteo_doble: h.evidencias.length > 8 ? "8+ evidencias: revisa que ninguna sea derivada de otra (correlación no es doble evidencia)" : null });`,
      },
    ],
  },
  {
    id: "counterfactual-lab",
    title: "Counterfactual Lab",
    tagline: "Laboratorio de contrafactuales: cambia UNA variable del pasado y compara mundos con el conjunto mínimo de cambios",
    category: "Razonamiento",
    pain: "El agente razona 'si hubiéramos hecho X habría pasado Y' por pura narrativa: cambia cinco cosas a la vez, atribuye el resultado a la que le conviene y la lección aprendida es ficción retrospectiva.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/counterfactual-lab/. Registra hechos del mundo real; cada contrafactual cambia el mínimo conjunto de variables (ceteris paribus); compara consecuencias propagadas y mide la distancia entre mundos.",
    tools: [
      {
        name: "register_facts",
        desc: "Registra la línea de hechos del mundo real (secuencia causal).",
        params: { escenario: { t: "string", d: "Nombre del escenario a estudiar" }, hechos: { t: "array", d: "Hechos en orden {que_paso, causa?, efecto?}" } },
        code: `const st = store.load();
st.escenarios = st.escenarios || {};
if (st.escenarios[escenario]) return fail("escenario ya registrado: " + escenario);
const limpios = (hechos || []).map((h, i) => ({ idx: i + 1, que_paso: String(h.que_paso || ""), causa: String(h.causa || ""), efecto: String(h.efecto || "") })).filter(h => h.que_paso);
if (limpios.length < 2) return fail("necesitas al menos 2 hechos encadenados");
st.escenarios[escenario] = { escenario, hechos: limpios, contrafactuales: {}, registrado: new Date().toISOString() };
store.save(st);
return ok({ escenario, hechos: limpios.length, cadena: limpios.map(h => h.idx + ". " + h.que_paso.slice(0, 60)), siguiente: "crea el contrafactual con run_counterfactual" });`,
      },
      {
        name: "run_counterfactual",
        desc: "Cambia hechos desde un punto y calcula el conjunto mínimo de consecuencias que se alteran.",
        params: { escenario: { t: "string", d: "Escenario base" }, desde_hecho: { t: "number", d: "Número de hecho donde se inyecta el cambio" }, cambio: { t: "string", d: "Qué pasa distinto a partir de ahí" } },
        code: `const st = store.load();
const e = (st.escenarios || {})[escenario];
if (!e) return fail("escenario no registrado");
if (desde_hecho < 1 || desde_hecho > e.hechos.length) return fail("hecho inexistente: hay " + e.hechos.length);
const afectados = e.hechos.filter(h => h.idx >= desde_hecho);
const nombre = "cf-" + desde_hecho + "-" + cambio.toLowerCase().slice(0, 20).replace(/[^a-z0-9]+/g, "-");
e.contrafactuales[nombre] = { desde_hecho, cambio, hechos_reescritos: afectados.length, creado: new Date().toISOString() };
store.save(st);
const minimos = afectados.filter(h => h.causa && afectados.some(o => o.efecto && o.causa.includes(h.que_paso.slice(0, 20))) || h.idx === desde_hecho);
return ok({ contrafactual: nombre, escenario, punto_de_bifurcacion: "hecho #" + desde_hecho + ": " + e.hechos[desde_hecho - 1].que_paso.slice(0, 70), cambio_inyectado: cambio, hechos_afectados_desde_el_punto: afectados.length, conjunto_minimo_a_revisar: minimos.length, regla_ceteris_paribus: "todo lo ANTERIOR a #" + desde_hecho + " permanece igual: si tu análisis requiere tocarlo, no es un contrafactual limpio", hechos_a_reescribir: afectados.map(h => ({ idx: h.idx, original: h.que_paso.slice(0, 60), pendiente: "reescribe este hecho asumiendo que '" + cambio + "' ocurrió" })) });`,
      },
      {
        name: "compare_worlds",
        desc: "Compara mundo real vs contrafactual: qué cambia, qué permanece y dónde diverge la narrativa.",
        params: { escenario: { t: "string", d: "Escenario" }, contrafactual: { t: "string", d: "Contrafactual registrado" }, hechos_alternativos: { t: "array", d: "Hechos reescritos del mundo contrafactual {idx, que_paso}" } },
        code: `const st = store.load();
const e = (st.escenarios || {})[escenario];
if (!e) return fail("escenario no encontrado");
const cf = e.contrafactuales[contrafactual];
if (!cf) return fail("contrafactual no encontrado: disponibles " + Object.keys(e.contrafactuales).join(", "));
const alt = new Map((hechos_alternativos || []).map(h => [Number(h.idx), String(h.que_paso)]));
if (!alt.size) return fail("sin hechos alternativos: reescribe los hechos afectados");
const distintos = [];
const iguales = [];
e.hechos.forEach(h => {
  const a = alt.get(h.idx);
  if (a === undefined) iguales.push({ idx: h.idx, hecho: h.que_paso.slice(0, 50), estado: "intacto (anterior al punto de bifurcación)" });
  else if (a.trim() === h.que_paso.trim()) iguales.push({ idx: h.idx, hecho: h.que_paso.slice(0, 50), estado: "idéntico pese a estar después del cambio: sospechoso" });
  else distintos.push({ idx: h.idx, real: h.que_paso.slice(0, 60), contrafactual: a.slice(0, 60) });
});
const sospechosos = iguales.filter(i => i.estado.startsWith("idéntico"));
return ok({ escenario, contrafactual, cambian: distintos.length, permanecen: iguales.length, tabla_de_mundos: { divergencias: distintos, permanencias: iguales }, distancia_entre_mundos: Number((distintos.length / e.hechos.length).toFixed(2)) + " del escenario reescrito", alerta: sospechosos.length ? "hay hechos POSTERIORES al cambio que quedaron idénticos: o son verdaderamente independientes (verifícalo) o el contrafactual está mal construido" : "consistencia razonable", leccion_candidata: distintos.length ? "la diferencia de desenlace se atribuye al ÚNICO cambio inyectado: '" + cf.cambio.slice(0, 60) + "'" : "sin divergencias: el cambio no alteró el desenlace, no le atribuyas mérito ni culpa" });`,
      },
    ],
  },
  {
    id: "causal-ladder",
    title: "Causal Ladder",
    tagline: "Escalera de Pearl aplicada: clasifica tu pregunta (asociación/intervención/contrafactual) y exige el método que le corresponde",
    category: "Razonamiento",
    pain: "El agente responde '¿qué pasa si intervenimos?' con datos observacionales: mezcla los peldaños de la escalera causal y entrega correlación disfrazada de causalidad. Nadie le exige el método que cada pregunta merece.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/causal-ladder/. Clasifica preguntas por peldaño (1 asociación, 2 intervención, 3 contrafactual); valida que el método propuesto pertenece al peldaño correcto y sugiere el método adecuado.",
    tools: [
      {
        name: "classify_question",
        desc: "Clasifica una pregunta en el peldaño correcto de la escalera causal.",
        params: { pregunta: { t: "string", d: "La pregunta analítica" } },
        code: `const p = pregunta.toLowerCase();
const patronR3 = /\\b(si hubi|si no hubi|habría pasado|habria pasado|contrafactual|en lugar de|si en vez de|qué habría)\\b/;
const patronR2 = /\\b(qué pasa si|que pasa si|si hacemos|si aplicamos|efecto de|impacto de|interven|debemos|mejor opción|causa)\\b/;
const patronR1 = /\\b(cómo se relaciona|correlaci|asociad|qué predice|que predice|patrón|tendencia|está asociado)\\b/;
let peldano = null, razon = "";
if (patronR3.test(p)) { peldano = 3; razon = "formula un mundo alternativo al ocurrido"; }
else if (patronR2.test(p)) { peldano = 2; razon = "pregunta por el efecto de una intervención o acción"; }
else if (patronR1.test(p)) { peldano = 1; razon = "pregunta por relaciones observadas en los datos"; }
if (!peldano) { peldano = 2; razon = "sin marcadores claros: por defecto asume intervención (el peldaño de decisión), verifica"; }
const descripciones = {
  1: { nombre: "ASOCIACIÓN (ver)", que_responde: "¿qué se ve junto con qué?", metodo_correcto: "correlaciones, regresión observacional, minería de patrones", prohibido: "NO interpretes los coeficientes como efectos causales" },
  2: { nombre: "INTERVENCIÓN (hacer)", que_responde: "¿qué pasa si hacemos X?", metodo_correcto: "experimento controlado, A/B, variables instrumentales, do-calculus, diff-in-diff", prohibido: "NO respondas esto con solo datos observacionales sin ajuste" },
  3: { nombre: "CONTRAFACTUAL (imaginar)", que_responde: "¿qué habría pasado si...?", metodo_correcto: "modelos causales estructurales, abducción+intervención+predicción, simulación del mundo alternativo", prohibido: "NO respondas esto con A/B: el A/B responde peldaño 2" }
};
return ok({ pregunta, peldano, nombre: descripciones[peldano].nombre, razon_de_clasificacion: razon, que_responde: descripciones[peldano].que_responde, metodo_que_exige: descripciones[peldano].metodo_correcto, advertencia: descripciones[peldano].prohibido });`,
      },
      {
        name: "check_method",
        desc: "Verifica que el método elegido puede responder la pregunta clasificada.",
        params: { pregunta: { t: "string", d: "La pregunta" }, metodo: { t: "string", d: "El método con el que piensas responderla" } },
        code: `const p = pregunta.toLowerCase();
const m = metodo.toLowerCase();
const patronR3 = /\\b(si hubi|habría|habria|contrafactual|en lugar de|si en vez de)\\b/;
const patronR2 = /\\b(qué pasa si|que pasa si|si hacemos|si aplicamos|efecto de|impacto de|interven|debemos)\\b/;
const peldano = patronR3.test(p) ? 3 : patronR2.test(p) ? 2 : 1;
const metodos = {
  1: ["correlacion", "correlación", "regresion", "regresión", "asociacion", "asociación", "patron", "patrón", "tendencia", "cluster", "predictivo"],
  2: ["a/b", "ab test", "experimento", "controlado", "aleatoriz", "randomiz", "instrumental", "diff-in-diff", "diferencias", "do-calculus", "intervencion", "intervención", "prueba controlada"],
  3: ["contrafactual", "estructural", "simulacion", "simulación", "abduccion", "abducción", "modelo causal", "scm", "mundo alternativo", "counterfactual"]
};
const tiene = (arr) => arr.some(x => m.includes(x));
const metodoPeldano = tiene(metodos[3]) ? 3 : tiene(metodos[2]) ? 2 : tiene(metodos[1]) ? 1 : 0;
const escaleraOk = metodoPeldano >= peldano && metodoPeldano !== 0;
return ok({ pregunta, peldano_requerido: peldano, peldano_del_metodo: metodoPeldano || "no identificado", veredicto: metodoPeldano === 0 ? "MÉTODO NO RECONOCIDO: clasifica manualmente qué peldaño cubre" : escaleraOk ? "VÁLIDO: el método alcanza el peldaño exigido" : "SUBORDINADO: tu método responde un peldaño MÁS BAJO que la pregunta: la respuesta será correlación disfrazada de causalidad", corregir_a: !escaleraOk ? metodos[peldano].slice(0, 4).join(" / ") : null });`,
      },
      {
        name: "ladder_report",
        desc: "Auditoría de un análisis completo: qué peldaños cubre y dónde salta sin permiso.",
        params: { analisis: { t: "string", d: "Descripción del análisis (pregunta + método + conclusión)" } },
        code: `const a = analisis.toLowerCase();
const hallazgos = [];
const saltos = [];
if (/correlaci|asociad|relaci[oó]n/.test(a) && /\\b(causa\\w*|provoc\\w*|produc\\w*|efecto\\w*|impacto\\w*)/.test(a)) saltos.push({ desde: "asociación", hacia: "causalidad", detalle: "el texto calcula correlación y concluye efecto: salto del peldaño 1 al 2 sin control ni experimento" });
if (/\\b(a\\/b|experimento|aleatoriz)\\b/.test(a) && /\\b(habría|habria|si no hubi|contrafactual|en vez de)\\b/.test(a)) saltos.push({ desde: "intervención", hacia: "contrafactual", detalle: "el A/B dice qué pasa si intervenimos, no qué habría pasado sin la intervención en ESTE caso: para eso, peldaño 3" });
if (/\\b(si hubi|habría|habria)\\b/.test(a) && !/\\b(modelo causal|estructural|simulaci|contrafactual)\\b/.test(a)) hallazgos.push({ tipo: "contrafactual sin método", detalle: "se formulan mundos alternativos sin modelo causal que los genere: narrativa retrospectiva" });
if (/\\b(una? causa clara|la causa es|obviamente causa)\\b/.test(a)) hallazgos.push({ tipo: "causalidad por adjetivo", detalle: "'clara/obvia' no es evidencia: la causalidad se demuestra con método, no con énfasis" });
return ok({ saltos_de_peldano: saltos, hallazgos, veredicto_general: saltos.length + hallazgos.length === 0 ? "análisis coherente con su peldaño" : saltos.length + hallazgos.length <= 1 ? "una deslizadera causal: corrígela" : "múltiples saltos causales: la conclusión no es defendible, reestructura el análisis" });`,
      },
    ],
  },
]

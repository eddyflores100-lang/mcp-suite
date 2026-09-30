// ═══ CATEGORÍA: Dolores FUTUROS · Razonamiento Estructurado (B) ═══
// Evidencia: las analogías estructurales (no superficiales), las fronteras
// de Pareto para decisiones multi-objetivo y la navaja de Occam cuantificada
// son herramientas de decisión que los agentes improvisan sin estructura.
export default [
  {
    id: "analogy-finder",
    title: "Analogy Finder",
    tagline: "Analogías ESTRUCTURALES: mapea relaciones entre dominios (no palabras sueltas) y delimita qué se transfiere y qué no",
    category: "Razonamiento",
    pain: "El agente razona por analogía superficial: 'esto es como Netflix' porque ambas cosas tienen suscripciones, y transfiere conclusiones de un dominio a otro sin comprobar que las RELACIONES se corresponden. La analogía falsa es la falacia más productiva que existe.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/analogy-finder/. Casos con entidades y relaciones tipadas; el matching estructural exige correspondencia de relaciones (no de nombres); la validación separa lo que se transfiere de lo que no.",
    tools: [
      {
        name: "register_case",
        desc: "Registra un caso/dominio con sus entidades y relaciones internas.",
        params: { caso: { t: "string", d: "Nombre del caso/dominio" }, entidades: { t: "array", d: "Entidades principales {nombre, rol}" }, relaciones: { t: "array", d: "Relaciones {desde, tipo, hacia} — el tipo ES la estructura (pagar, competir, depender...)" }, desenlace: { t: "string", d: "Cómo terminó ese caso (si se sabe)", opt: true } },
        code: `const st = store.load();
st.casos = st.casos || {};
if (st.casos[caso]) return fail("caso ya registrado: " + caso);
const ents = (entidades || []).filter(e => e && e.nombre).map(e => ({ nombre: String(e.nombre), rol: String(e.rol || "sin rol") }));
const rels = (relaciones || []).filter(r => r && r.desde && r.hacia && r.tipo).map(r => ({ desde: String(r.desde), tipo: String(r.tipo).toLowerCase(), hacia: String(r.hacia) }));
if (ents.length < 2 || rels.length < 1) return fail("necesitas al menos 2 entidades y 1 relación");
st.casos[caso] = { caso, entidades: ents, relaciones: rels, desenlace: desenlace || "desconocido", registrado: new Date().toISOString() };
store.save(st);
return ok({ caso, entidades: ents.length, relaciones: rels.length, estructura: rels.map(r => r.desde + " --" + r.tipo + "--> " + r.hacia), aviso: "define relaciones por su TIPO funcional (paga, depende, compite) y no por su etiqueta superficial" });`,
      },
      {
        name: "find_analogy",
        desc: "Busca el caso registrado cuya ESTRUCTURA relacional coincide con tu situación actual.",
        params: { entidades_actuales: { t: "array", d: "Entidades de tu situación {nombre, rol}" }, relaciones_actuales: { t: "array", d: "Relaciones {desde, tipo, hacia}" } },
        code: `const st = store.load();
const casos = __vals(st.casos || {});
if (!casos.length) return fail("sin casos registrados");
const misRels = (relaciones_actuales || []).filter(r => r && r.tipo).map(r => ({ desde: String(r.desde), tipo: String(r.tipo).toLowerCase(), hacia: String(r.hacia) }));
if (!misRels.length) return fail("sin relaciones actuales: sin estructura no hay analogía, solo parecido de palabras");
const scores = casos.map(c => {
  let matches = 0;
  const detalles = [];
  c.relaciones.forEach(rc => {
    const rm = misRels.find(x => x.tipo === rc.tipo && (x.desde === rc.desde || x.hacia === rc.hacia));
    const rmTipo = misRels.find(x => x.tipo === rc.tipo);
    if (rm) { matches += 2; detalles.push({ relacion: rc.desde + " --" + rc.tipo + "--> " + rc.hacia, correspondencia: "exacta (tipo y actores)" }); }
    else if (rmTipo) { matches += 1; detalles.push({ relacion: rc.desde + " --" + rc.tipo + "--> " + rc.hacia, correspondencia: "solo tipo (actores distintos)" }); }
  });
  const cobertura = matches / (c.relaciones.length * 2);
  const rolesParecidos = (entidades_actuales || []).filter(e => c.entidades.some(ce => ce.rol && e.rol && String(ce.rol).toLowerCase() === String(e.rol).toLowerCase())).length;
  return { caso: c.caso, score_estructural: Number(cobertura.toFixed(2)), relaciones_cubiertas: detalles.length + "/" + c.relaciones.length, detalle: detalles, roles_alineados: rolesParecidos, desenlace: c.desenlace };
}).sort((a, b) => b.score_estructural - a.score_estructural);
const mejor = scores[0];
return ok({ mejor_analogia: mejor, otras_candidatas: scores.slice(1, 4), advertencia_superficialidad: mejor.score_estructural < 0.4 ? "NINGUNA analogía estructural fuerte: la similitud que percibes es superficial (nombres parecidos); NO transfieras conclusiones" : mejor.score_estructural < 0.7 ? "analogía PARCIAL: transfiere solo lo marcado como correspondencia exacta" : "analogía estructural sólida: la transferencia es defendible" });`,
      },
      {
        name: "map_transfer",
        desc: "Para una analogía concreta: qué conocimiento se transfiere y qué se queda en casa.",
        params: { caso: { t: "string", d: "Caso análogo registrado" }, correspondencias: { t: "array", d: "Mapeo declarado {entidad_o_relacion_del_caso, equivalente_actual}" } },
        code: `const st = store.load();
const c = (st.casos || {})[caso];
if (!c) return fail("caso no registrado: " + caso);
const mapa = (correspondencias || []).filter(x => x && x.entidad_o_relacion_del_caso);
if (!mapa.length) return fail("sin correspondencias declaradas");
const cubiertas = new Set(mapa.map(x => String(x.entidad_o_relacion_del_caso)));
const sinMapear = c.relaciones.filter(r => !cubiertas.has(r.desde + " --" + r.tipo + "--> " + r.hacia) && !cubiertas.has(r.desde) && !cubiertas.has(r.hacia));
return ok({ caso, mapeo: mapa, relaciones_del_caso_sin_equivalente: sinMapear.map(r => r.desde + " --" + r.tipo + "--> " + r.hacia), cobertura: Number(((c.relaciones.length - sinMapear.length) / Math.max(c.relaciones.length, 1) * 100).toFixed(0)) + "%", se_transfiere: mapa.map(x => "lo aprendido sobre '" + x.entidad_o_relacion_del_caso + "' APLICA a '" + x.equivalente_actual + "'"), NO_se_transfiere: sinMapear.length ? sinMapear.map(r => "el mecanismo '" + r.tipo + "' entre " + r.desde + " y " + r.hacia + " NO existe en tu situación: las conclusiones que dependan de él quedan fuera") : ["todo el caso tiene equivalente: transferencia completa"], desenlace_del_caso: c.desenlace, condicional: c.desenlude !== "desconocido" ? null : "el desenlace del caso es desconocido: la analogía orienta pero no predice" });`,
      },
    ],
  },
  {
    id: "pareto-tradeoff",
    title: "Pareto Tradeoff",
    tagline: "Frontera de Pareto para decisiones multi-objetivo: qué opciones son dominadas y cuál es el punto de equilibrio",
    category: "Razonamiento",
    pain: "El agente elige 'la mejor opción' cuando había 3 incomparables: sin calcular la frontera de Pareto no distingue las opciones dominadas de las trade-off reales, y recomienda la que más le gusta narrativamente.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/pareto-tradeoff/. Opciones con vectores de objetivos (todos maximizar o minimizar normalizados); cálculo de dominancia, frontera de Pareto y punto rodilla (knee) por distancia normalizada.",
    tools: [
      {
        name: "add_option",
        desc: "Añade una opción al problema de decisión con sus valores en cada objetivo.",
        params: { decision: { t: "string", d: "Nombre de la decisión" }, opcion: { t: "string", d: "Nombre de la opción" }, objetivos: { t: "any", d: "Valores {objetivo: valor numérico}" }, direccion: { t: "any", d: "Por objetivo: 'max' o 'min' {objetivo: 'max'} (default max)", opt: true } },
        code: `const st = store.load();
st.decisiones = st.decisiones || {};
st.decisiones[decision] = st.decisiones[decision] || { decision, opciones: {}, direccion: {} };
const d = st.decisiones[decision];
if (d.opciones[opcion]) return fail("opción ya registrada: " + opcion);
const obj = objetivos || {};
const claves = Object.keys(obj).filter(k => typeof obj[k] === "number" && isFinite(obj[k]));
if (!claves.length) return fail("sin objetivos numéricos");
claves.forEach(k => { if (!d.direccion[k]) d.direccion[k] = (direccion && direccion[k]) || "max"; });
d.opciones[opcion] = { opcion, objetivos: obj };
store.save(st);
return ok({ decision, opcion, objetivos: claves.map(k => k + " (" + d.direccion[k] + ")"), opciones_totales: Object.keys(d.opciones).length, siguiente: "con 2+ opciones, ejecuta compute_frontier" });`,
      },
      {
        name: "compute_frontier",
        desc: "Calcula la frontera de Pareto: opciones dominadas fuera, incomparables dentro, con ranking por cobertura.",
        params: { decision: { t: "string", d: "Decisión" } },
        code: `const st = store.load();
const d = (st.decisiones || {})[decision];
if (!d) return fail("decisión no encontrada");
const nombres = Object.keys(d.opciones);
if (nombres.length < 2) return fail("necesitas al menos 2 opciones");
const objetivos = [...new Set(nombres.flatMap(n => Object.keys(d.opciones[n].objetivos)))];
if (!objetivos.length) return fail("sin objetivos");
const valor = (n, o) => {
  const v = d.opciones[n].objetivos[o];
  if (v === undefined) return null;
  return d.direccion[o] === "min" ? -v : v;
};
const domina = (a, b) => objetivos.every(o => { const va = valor(a, o), vb = valor(b, o); return va === null || vb === null ? true : va >= vb; }) && objetivos.some(o => { const va = valor(a, o), vb = valor(b, o); return va !== null && vb !== null && va > vb; });
const frontera = nombres.filter(n => !nombres.some(m => m !== n && domina(m, n)));
const dominadas = nombres.filter(n => !frontera.includes(n)).map(n => {
  const dominantes = nombres.filter(m => m !== n && domina(m, n));
  return { opcion: n, dominada_por: dominantes, objetivo_perdido: dominantes.length ? "sin ganar en nada a " + dominantes[0] : null };
});
const cobertura = frontera.map(n => ({ opcion: n, objetivos_alcanzados: objetivos.filter(o => valor(n, o) !== null && valor(n, o) >= Math.max(...nombres.map(m => valor(m, o)).filter(v => v !== null))).length, deficit_maximo: Number(Math.max(...objetivos.map(o => { const mejor = Math.max(...nombres.map(m => valor(m, o)).filter(v => v !== null)); const propio = valor(n, o); return propio === null || mejor === null ? 0 : Math.abs(mejor - propio); }))) }));
return ok({ decision, objetivos, direccion: d.direccion, opciones: nombres.length, frontera_de_pareto: frontera, opciones_dominadas: dominadas, trade_off_real: frontera.length > 1 ? "hay " + frontera.length + " opciones INCOMPARABLES: no existe 'la mejor' sin ponderar prioridades: usa knee_point o decide tus pesos" : "una sola opción domina: es la ganadora clara", detalle_frontera: cobertura });`,
      },
      {
        name: "knee_point",
        desc: "Encuentra el punto rodilla de la frontera: la opción con mejor equilibrio sin normalizar al respecto.",
        params: { decision: { t: "string", d: "Decisión" } },
        code: `const st = store.load();
const d = (st.decisiones || {})[decision];
if (!d) return fail("decisión no encontrada");
const nombres = Object.keys(d.opciones);
if (nombres.length < 2) return fail("necesitas 2+ opciones");
const objetivos = [...new Set(nombres.flatMap(n => Object.keys(d.opciones[n].objetivos)))];
if (objetivos.length < 2) return fail("el punto rodilla exige al menos 2 objetivos");
const raw = (n, o) => d.opciones[n].objetivos[o];
const vals = objetivos.map(o => nombres.map(n => raw(n, o)).filter(v => typeof v === "number" && isFinite(v)));
const min = objetivos.map((o, i) => Math.min(...vals[i]));
const span = objetivos.map((o, i) => Math.max(...vals[i]) - min[i] || 1);
const norm = (n, o) => {
  const i = objetivos.indexOf(o);
  const v = raw(n, o);
  if (typeof v !== "number" || !isFinite(v)) return null;
  const x = (v - min[i]) / span[i];
  return d.direccion[o] === "min" ? 1 - x : x;
};
const puntajes = nombres.map(n => {
  const v = objetivos.map(o => norm(n, o));
  const completos = v.every(x => x !== null);
  const media = v.filter(x => x !== null).reduce((a, b) => a + b, 0) / v.filter(x => x !== null).length;
  const minimo = Math.min(...v.filter(x => x !== null));
  return { opcion: n, media_normalizada: Number(media.toFixed(3)), peor_objetivo: Number(minimo.toFixed(3)), datos_completos: completos };
});
const ideal = { media: 1, peor: 1 };
const distancias = puntajes.map(p => ({ ...p, distancia_al_ideal: Number(Math.sqrt(Math.pow(ideal.media - p.media_normalizada, 2) + Math.pow(ideal.peor - p.peor_objetivo, 2)).toFixed(3)) })).sort((a, b) => a.distancia_al_ideal - b.distancia_al_ideal);
return ok({ decision, objetivos, ideal: "media 1.0 y peor-objetivo 1.0 (imposible si hay trade-off)", candidatos: distancias, knee: distancias[0].opcion, razon: "el punto rodilla pierde lo MENOS posible en su peor objetivo manteniendo la media más alta: el equilibrio natural", alternativa_si_ponderas: "si un objetivo te importa el doble, dime los pesos y recalculo" });`,
      },
    ],
  },
  {
    id: "occam-razor",
    title: "Occam Razor",
    tagline: "Navaja de Occam cuantificada: hipótesis con entidades, supuestos y ajuste a evidencia — simplicidad que gana solo si empata",
    category: "Razonamiento",
    pain: "El agente prefiere la hipótesis más elaborada porque 'explica más': sin contar entidades ni supuestos, la complejidad extra parece virtud y no coste. La navaja sin números corta al azar.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/occam-razor/. Hipótesis con lista de entidades y supuestos independientes + ajuste a la evidencia (0-1); penalización logarítmica por complejidad; recomendación con análisis de empate técnico.",
    tools: [
      {
        name: "add_hypothesis",
        desc: "Añade una hipótesis con sus entidades y supuestos independientes.",
        params: { problema: { t: "string", d: "Problema a explicar" }, hipotesis: { t: "string", d: "Enunciado de la hipótesis" }, entidades: { t: "array", d: "Entidades/agentes/cosas que la hipótesis introduce" }, supuestos: { t: "array", d: "Supuestos independientes que da por ciertos (cada uno puede fallar solo)" } },
        code: `const st = store.load();
st.problemas = st.problemas || {};
st.problemas[problema] = st.problemas[problema] || { problema, hipotesis: {} };
const p = st.problemas[problema];
const clave = hipotesis.toLowerCase().slice(0, 60);
if (p.hipotesis[clave]) return fail("hipótesis ya registrada");
p.hipotesis[clave] = { hipotesis, entidades: (entidades || []).map(String), supuestos: (supuestos || []).map(String), ajuste: null, registrado: new Date().toISOString() };
store.save(st);
return ok({ problema, hipotesis: clave, entidades: (entidades || []).length, supuestos: (supuestos || []).length, complejidad_bruta: (entidades || []).length + (supuestos || []).length, siguiente: "califica el ajuste a la evidencia con rate_fit" });`,
      },
      {
        name: "rate_fit",
        desc: "Califica qué tan bien la hipótesis explica la evidencia observada (0 a 1).",
        params: { problema: { t: "string", d: "Problema" }, hipotesis: { t: "string", d: "Hipótesis" }, ajuste: { t: "number", d: "Ajuste a la evidencia 0-1 (1 = lo explica todo sin residuos)" }, evidencia_cubierta: { t: "string", d: "Qué evidencia cubre y cuál no", opt: true } },
        code: `const st = store.load();
const p = (st.problemas || {})[problema];
if (!p) return fail("problema no encontrado");
const clave = hipotesis.toLowerCase().slice(0, 60);
const h = p.hipotesis[clave];
if (!h) return fail("hipótesis no registrada");
if (ajuste < 0 || ajuste > 1) return fail("ajuste entre 0 y 1");
h.ajuste = ajuste;
h.evidencia_cubierta = evidencia_cubierta || "";
store.save(st);
return ok({ hipotesis: clave, ajuste, nota: ajuste < 0.5 ? "explica MENOS de la mitad de la evidencia: necesitas datos extra o una hipótesis distinta" : "ajuste registrado" });`,
      },
      {
        name: "rank",
        desc: "Ranking por navaja: penaliza complejidad y solo gana la simple si empata en ajuste.",
        params: { problema: { t: "string", d: "Problema" } },
        code: `const st = store.load();
const p = (st.problemas || {})[problema];
if (!p) return fail("problema no encontrado");
const hs = __vals(p.hipotesis);
if (hs.length < 2) return fail("necesitas 2+ hipótesis para rankear");
const sinAjuste = hs.filter(h => h.ajuste === null);
if (sinAjuste.length) return fail("sin calificar: " + sinAjuste.map(h => h.hipotesis.slice(0, 40)).join(", ") + " (usa rate_fit)");
const puntuadas = hs.map(h => {
  const complejidad = h.entidades.length + h.supuestos.length;
  const penalizacion = Math.log2(complejidad + 1);
  const score = (h.ajuste ?? 0) - 0.08 * penalizacion;
  return { hipotesis: h.hipotesis.slice(0, 80), entidades: h.entidades.length, supuestos: h.supuestos.length, complejidad, ajuste: h.ajuste, penalizacion_log: Number(penalizacion.toFixed(2)), score_naval: Number(score.toFixed(3)) };
}).sort((a, b) => b.score_naval - a.score_naval);
const mejor = puntuadas[0];
const segunda = puntuadas[1];
const empateTecnico = segunda && Math.abs(mejor.score_naval - segunda.score_naval) < 0.05;
return ok({ problema, ranking: puntuadas, ganadora: mejor.hipotesis, analisis: empateTecnico ? "EMPATE TÉCNICO con '" + segunda.hipotesis.slice(0, 50) + "': cuando dos hipótesis empatan, la navaja manda elegir la MÁS SIMPLE de las dos" : "ventaja clara de " + Number((mejor.score_naval - (segunda ? segunda.score_naval : 0)).toFixed(3)), advertencias: puntuadas.filter(h => h.entidades > 4).map(h => "la hipótesis '" + h.hipotesis.slice(0, 40) + "' introduce " + h.entidades + " entidades: cada una es una historia que sostener"), recordatorio: "la simplicidad es el DESEMPATE, no el criterio: una hipótesis simple que no encaja (ajuste bajo) sigue siendo incorrecta" });`,
      },
    ],
  },
]

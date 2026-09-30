// ═══ CATEGORÍA: Dolores de agentes · Cognición y Planificación (10) ═══
// Dolor de fondo: los agentes planifican mal, pierden tareas y no
// gestionan riesgos ni supuestos (papers de agentes: planning es #1).
export default [
  {
    id: "plan-decompose",
    title: "Plan Decompose",
    tagline: "Descompone objetivos en planes ejecutables: pasos, dependencias y estimaciones",
    category: "Cognición y Planificación",
    pain: "El agente ataca objetivos gigantes sin descomponer: pasos desordenados, sin dependencias ni criterios de salida.",
    tools: [
      {
        name: "decompose",
        desc: "Descompone un objetivo en pasos estructurados: extrae verbos de acción, ordena por dependencia lógica y añade criterios de terminación.",
        params: { objetivo: { t: "string", d: "Objetivo a descomponer" }, max_pasos: { t: "number", d: "Máximo pasos", opt: true, def: 8 } },
        code: `const acciones = ["investigar", "definir", "diseñar", "implementar", "configurar", "probar", "validar", "documentar", "publicar", "medir", "revisar", "integrar", "analizar", "extraer", "limpiar", "comparar", "instalar", "escribir", "crear", "verificar"];
const obj = objetivo.toLowerCase();
const detectadas = acciones.filter((a) => obj.includes(a));
const fases = detectadas.length >= 2 ? detectadas.slice(0, max_pasos ?? 8) : ["analizar", "implementar", "verificar", "documentar"];
const pasos = fases.map((fase, i) => ({
  n: i + 1,
  accion: fase,
  descripcion: fase.charAt(0).toUpperCase() + fase.slice(1) + " lo necesario para: " + objetivo.slice(0, 80),
  depende_de: i === 0 ? [] : [i],
  criterio_terminacion: "puedes marcarlo done cuando " + fase + " tiene entregable verificable",
  estimacion_minutos: 15 * (i + 1),
}));
return ok({ objetivo, total_pasos: pasos.length, pasos, nota: "refina con task-tracker para ejecución real" });`,
      },
      {
        name: "estimate_complexity",
        desc: "Estima la complejidad de un objetivo (baja/media/alta) por señales: alcance, dominios involucrados, incertidumbre y dependencias externas.",
        params: { objetivo: { t: "string", d: "Objetivo" }, contexto: { t: "string", d: "Contexto adicional", opt: true } },
        code: `const t = (objetivo + " " + (contexto || "")).toLowerCase();
let puntos = 0; const señales: string[] = [];
if (/\\b(todo|todas|completo|integral|end.?to.?end|múltiples|varios|cada)\\b/.test(t)) { puntos += 2; señales.push("alcance amplio"); }
if (/\\b(integr|api|extern|tercer|webhook|deploy|producción|migrat)\\b/.test(t)) { puntos += 2; señales.push("dependencias externas"); }
if (/\\b(diseñ|arquitect|decidir|elegir|comparar|estrategia)\\b/.test(t)) { puntos += 1; señales.push("decisiones de diseño"); }
if (/\\b(seguridad|pago|legal|compliance|cripto)\\b/.test(t)) { puntos += 2; señales.push("dominio sensible"); }
if (/\\b(mvp|rápido|simple|demo|borrador|solo)\\b/.test(t)) { puntos -= 2; señales.push("alcance reducido"); }
if (t.length > 400) { puntos += 1; señales.push("descripción larga: muchos requisitos implícitos"); }
const nivel = puntos <= 1 ? "baja" : puntos <= 3 ? "media" : puntos <= 5 ? "alta" : "muy alta";
return ok({ puntos, nivel, señales, recomendacion: nivel === "baja" ? "ejecuta directo" : nivel === "media" ? "planifica 3-5 pasos" : "descompón en sub-objetarios y valida supuestos primero" });`,
      },
    ],
  },
  {
    id: "task-tracker",
    title: "Task Tracker",
    tagline: "Tareas del agente con estados, prioridades y bloqueos",
    category: "Cognición y Planificación",
    pain: "Sin tracker de tareas el agente pierde el hilo entre sesiones y no sabe qué está bloqueado.",
    persistent: true,
    tools: [
      {
        name: "add",
        desc: "Añade una tarea: título, detalle, prioridad y etiquetas. Devuelve ID.",
        params: { titulo: { t: "string", d: "Título de la tarea" }, detalle: { t: "string", d: "Detalle", opt: true }, prioridad: { t: "enum", values: ["alta", "media", "baja"], d: "Prioridad", opt: true, def: "media" }, etiquetas: { t: "array", d: "Tags", opt: true } },
        code: `const st = store.load();
st.tareas = st.tareas || [];
st.seq = (st.seq || 0) + 1;
const t = { id: "T" + st.seq, titulo, detalle: detalle || "", prioridad: prioridad || "media", etiquetas: Array.isArray(etiquetas) ? etiquetas : [], estado: "pendiente", creada: new Date().toISOString() };
st.tareas.push(t);
store.save(st);
return ok({ tarea: t, total: st.tareas.length });`,
      },
      {
        name: "update_status",
        desc: "Actualiza el estado de una tarea: pendiente → en_progreso → done | bloqueada (con motivo).",
        params: { id: { t: "string", d: "ID de la tarea" }, estado: { t: "enum", values: ["pendiente", "en_progreso", "done", "bloqueada"], d: "Nuevo estado" }, motivo: { t: "string", d: "Motivo (para bloqueos)", opt: true } },
        code: `const st = store.load();
const t = (st.tareas || []).find((x) => x.id === id);
if (!t) return fail("tarea no existe: " + id);
t.estado = estado;
t.actualizada = new Date().toISOString();
if (estado === "bloqueada") t.bloqueo = motivo || "sin motivo";
if (estado === "done") t.completada = new Date().toISOString();
store.save(st);
return ok({ id, estado });`,
      },
      {
        name: "pending",
        desc: "Lista tareas pendientes/en progreso ordenadas por prioridad, con bloqueadas destacadas.",
        params: { etiqueta: { t: "string", d: "Filtrar por etiqueta", opt: true } },
        code: `const st = store.load();
let tareas: any[] = (st.tareas || []).filter((t) => t.estado !== "done");
if (etiqueta) tareas = tareas.filter((t) => (t.etiquetas || []).includes(etiqueta));
const orden: any = { alta: 0, media: 1, baja: 2 };
tareas.sort((a, b) => (orden[a.prioridad] ?? 1) - (orden[b.prioridad] ?? 1));
return ok({ pendientes: tareas.length, bloqueadas: tareas.filter((t) => t.estado === "bloqueada").length, en_progreso: tareas.filter((t) => t.estado === "en_progreso").length, tareas });`,
      },
      {
        name: "summary",
        desc: "Resumen de productividad: completadas hoy/semana, tasa de finalización y tareas estancadas.",
        params: {},
        code: `const st = store.load();
const tareas: any[] = st.tareas || [];
const ahora = Date.now();
const done = tareas.filter((t) => t.estado === "done");
const hoy = done.filter((t) => new Date(t.completada).getTime() > ahora - 86400000).length;
const semana = done.filter((t) => new Date(t.completada).getTime() > ahora - 7 * 86400000).length;
const estancadas = tareas.filter((t) => t.estado === "en_progreso" && (!t.actualizada || ahora - new Date(t.actualizada).getTime() > 86400000));
return ok({ total: tareas.length, completadas: done.length, completadas_hoy: hoy, completadas_7d: semana, tasa_finalizacion: tareas.length ? Math.round((done.length / tareas.length) * 100) + "%" : "0%", estancadas_24h: estancadas.map((t) => t.id + " " + t.titulo) });`,
      },
    ],
  },
  {
    id: "milestone-checker",
    title: "Milestone Checker",
    tagline: "Hitos con checkpoints de calidad: mide progreso real contra el plan",
    category: "Cognición y Planificación",
    pain: "El '90% listo' del agente es mentira estadística: sin hitos verificables no hay progreso medible.",
    persistent: true,
    tools: [
      {
        name: "define_milestones",
        desc: "Define los hitos de un proyecto: nombre, criterio verificable y peso relativo.",
        params: { proyecto: { t: "string", d: "Proyecto" }, hitos: { t: "array", d: "Lista de {nombre, criterio, peso}" } },
        code: `const st = store.load();
st.proyectos = st.proyectos || {};
const p = st.proyectos[proyecto] = st.proyectos[proyecto] || {};
p.hitos = (Array.isArray(hitos) ? hitos : []).map((h: any, i: number) => ({ n: i + 1, nombre: h.nombre, criterio: h.criterio || "", peso: h.peso ?? 1, cumplido: false }));
store.save(st);
return ok({ proyecto, hitos: p.hitos.length, peso_total: p.hitos.reduce((a: number, h: any) => a + h.peso, 0) });`,
      },
      {
        name: "evaluate",
        desc: "Marca un hito como cumplido (o lo revierte) evaluando su criterio.",
        params: { proyecto: { t: "string", d: "Proyecto" }, hito: { t: "number", d: "Número de hito" }, cumplido: { t: "boolean", d: "¿Cumplido?", opt: true, def: true }, evidencia: { t: "string", d: "Evidencia del cumplimiento", opt: true } },
        code: `const st = store.load();
const p = st.proyectos?.[proyecto];
if (!p) return fail("proyecto no existe");
const h = p.hitos.find((x) => x.n === hito);
if (!h) return fail("hito no existe");
h.cumplido = cumplido ?? true;
h.evidencia = evidencia || "";
h.evaluado = new Date().toISOString();
store.save(st);
const logrados = p.hitos.filter((x) => x.cumplido);
return ok({ hito, cumplido: h.cumplido, progreso: Math.round((logrados.reduce((a: number, x: any) => a + x.peso, 0) / p.hitos.reduce((a: number, x: any) => a + x.peso, 0)) * 100) + "%" });`,
      },
      {
        name: "progress",
        desc: "Reporte de progreso del proyecto: hitos cumplidos/pendientes, próximos y estancados.",
        params: { proyecto: { t: "string", d: "Proyecto" } },
        code: `const st = store.load();
const p = st.proyectos?.[proyecto];
if (!p) return fail("proyecto no existe");
const pendientes = p.hitos.filter((h: any) => !h.cumplido);
return ok({ hitos: p.hitos.length, cumplidos: p.hitos.length - pendientes.length, pendientes: pendientes.map((h: any) => h.n + ". " + h.nombre), proximo: pendientes[0] ? pendientes[0].nombre : "COMPLETADO", progreso: Math.round(((p.hitos.length - pendientes.length) / p.hitos.length) * 100) + "%" });`,
      },
    ],
  },
  {
    id: "decision-matrix",
    title: "Decision Matrix",
    tagline: "Decisiones ponderadas: opciones × criterios con análisis de sensibilidad",
    category: "Cognición y Planificación",
    pain: "El agente decide por intuición: sin matriz ponderada, las decisiones no son reproducibles ni explicables.",
    tools: [
      {
        name: "decide",
        desc: "Evalúa opciones contra criterios ponderados: puntúa cada opción, calcula total ponderado y recomienda la ganadora.",
        params: { opciones: { t: "array", d: "Nombres de opciones" }, criterios: { t: "array", d: "Lista {nombre, peso}" }, puntajes: { t: "any", d: "Matriz {opcion: {criterio: 0-10}}" } },
        code: `const opts = Array.isArray(opciones) ? opciones : [];
const crits = (Array.isArray(criterios) ? criterios : []).map((c: any) => typeof c === "string" ? { nombre: c, peso: 1 } : c);
const pesos = crits.reduce((a: number, c: any) => a + (c.peso ?? 1), 0) || 1;
const resultados = opts.map((o: string) => {
  let total = 0; const detalle: any = {};
  for (const c of crits) {
    const v = Math.max(0, Math.min(10, Number(puntajes?.[o]?.[c.nombre] ?? 5)));
    detalle[c.nombre] = v;
    total += v * (c.peso ?? 1);
  }
  return { opcion: o, puntaje_ponderado: Math.round((total / pesos) * 100) / 100, detalle };
}).sort((a: any, b: any) => b.puntaje_ponderado - a.puntaje_ponderado);
return ok({ ganadora: resultados[0]?.opcion, ranking: resultados, criterios: crits, empate: resultados.length > 1 && resultados[0].puntaje_ponderado === resultados[1].puntaje_ponderado });`,
      },
      {
        name: "sensitivity",
        desc: "Análisis de sensibilidad: ¿cambia la decisión si un criterio cambia de peso? Encuentra los pesos que voltean la decisión.",
        params: { opciones: { t: "array", d: "Nombres de opciones" }, criterios: { t: "array", d: "Lista {nombre, peso}" }, puntajes: { t: "any", d: "Matriz de puntajes" } },
        code: `const opts = Array.isArray(opciones) ? opciones : [];
const crits = (Array.isArray(criterios) ? criterios : []).map((c: any) => typeof c === "string" ? { nombre: c, peso: 1 } : c);
function totalDe(opcion: string, pesos: any): number {
  let t = 0;
  for (const c of crits) t += Math.max(0, Math.min(10, Number(puntajes?.[opcion]?.[c.nombre] ?? 5))) * pesos[c.nombre];
  return t;
}
const ganadora = opts.reduce((best: any, o: string) => { const t = totalDe(o, Object.fromEntries(crits.map((c: any) => [c.nombre, c.peso ?? 1]))); return !best || t > best.t ? { o, t } : best; }, null);
const sensibilidades: any[] = [];
for (const c of crits) {
  for (const factor of [0, 0.5, 2, 5]) {
    const pesos: any = Object.fromEntries(crits.map((x: any) => [x.nombre, x.peso ?? 1]));
    pesos[c.nombre] = (c.peso ?? 1) * factor;
    const nueva = opts.reduce((best: any, o: string) => { const t = totalDe(o, pesos); return !best || t > best.t ? { o, t } : best; }, null);
    if (nueva.o !== ganadora.o) sensibilidades.push({ criterio: c.nombre, factor_peso: factor, nueva_ganadora: nueva.o, razon: "si " + c.nombre + " pesa x" + factor + ", gana " + nueva.o });
  }
}
return ok({ ganadora_original: ganadora?.o, volatil: sensibilidades.length > 0, sensibilidades: sensibilidades.slice(0, 8), nota: sensibilidades.length ? "decisión sensible: documenta la justificación de pesos" : "decisión robusta a cambios de peso" });`,
      },
    ],
  },
  {
    id: "hypothesis-tracker",
    title: "Hypothesis Tracker",
    tagline: "Hipótesis científicas del agente: enuncia, prueba y concluye",
    category: "Cognición y Planificación",
    pain: "El agente asume en vez de hipotetizar: sin registro de hipótesis testeables, los supuestos se vuelven 'verdades'.",
    persistent: true,
    tools: [
      {
        name: "add",
        desc: "Registra una hipótesis: enunciado, predicción falsable y cómo testearla.",
        params: { enunciado: { t: "string", d: "Hipótesis (ej: X mejorará Y)" }, prediccion: { t: "string", d: "Predicción falsable" }, test: { t: "string", d: "Cómo testear", opt: true } },
        code: `const st = store.load();
st.hipotesis = st.hipotesis || [];
const h = { id: "H" + (st.hipotesis.length + 1), enunciado, prediccion, test: test || "", estado: "sin_testear", creada: new Date().toISOString() };
st.hipotesis.push(h);
store.save(st);
return ok({ hipotesis: h });`,
      },
      {
        name: "record_result",
        desc: "Registra el resultado de un test de hipótesis: confirmada, refutada o inconclusa (con datos).",
        params: { id: { t: "string", d: "ID de hipótesis" }, resultado: { t: "enum", values: ["confirmada", "refutada", "inconclusa"], d: "Resultado" }, evidencia: { t: "string", d: "Evidencia observada", opt: true } },
        code: `const st = store.load();
const h = (st.hipotesis || []).find((x) => x.id === id);
if (!h) return fail("hipótesis no existe");
h.estado = resultado;
h.evidencia = evidencia || "";
h.testeada = new Date().toISOString();
store.save(st);
return ok({ id, estado: resultado });`,
      },
      {
        name: "report",
        desc: "Reporte de hipótesis: cuántas confirmadas/refutadas/sin testear y ratio de acierto (calibración del agente).",
        params: {},
        code: `const st = store.load();
const hs = st.hipotesis || [];
const conteo: any = {};
for (const h of hs) conteo[h.estado] = (conteo[h.estado] || 0) + 1;
const testeadas = (conteo.confirmada || 0) + (conteo.refutada || 0);
return ok({ total: hs.length, ...conteo, ratio_confirmacion: testeadas ? Math.round((conteo.confirmada / testeadas) * 100) + "%" : "sin datos", interpretacion: testeadas ? ((conteo.confirmada || 0) / testeadas > 0.8 ? "sobre-confiado: hipótesis demasiado fáciles" : "calibración razonable") : "sin datos", pendientes: hs.filter((h) => h.estado === "sin_testear").map((h) => h.id + ": " + h.enunciado.slice(0, 80)) });`,
      },
    ],
  },
  {
    id: "priority-queue",
    title: "Priority Queue",
    tagline: "Cola de prioridades con matriz Eisenhower: urgente vs importante",
    category: "Cognición y Planificación",
    pain: "El agente ataca lo último que llegó (recency bias): sin matriz de prioridades, lo urgente devora lo importante.",
    persistent: true,
    tools: [
      {
        name: "add",
        desc: "Añade un item con urgencia e importancia (0-10): se clasifica en la matriz Eisenhower automáticamente.",
        params: { descripcion: { t: "string", d: "Qué hay que hacer" }, urgencia: { t: "number", d: "Urgencia 0-10" }, importancia: { t: "number", d: "Importancia 0-10" }, vence_horas: { t: "number", d: "Vence en N horas", opt: true } },
        code: `const st = store.load();
st.items = st.items || [];
st.seq = (st.seq || 0) + 1;
const u = Math.max(0, Math.min(10, urgencia)); const i = Math.max(0, Math.min(10, importancia));
const cuadrante = u >= 5 && i >= 5 ? "hacer-ya" : i >= 5 ? "planificar" : u >= 5 ? "delegar" : "eliminar";
const item = { id: "P" + st.seq, descripcion, urgencia: u, importancia: i, cuadrante, vence: vence_horas ? new Date(Date.now() + vence_horas * 3600000).toISOString() : null, creado: new Date().toISOString() };
st.items.push(item);
store.save(st);
return ok({ item, score: u * 0.6 + i * 0.4 });`,
      },
      {
        name: "pop",
        desc: "Saca el item de mayor prioridad (ponderado urgencia 60% / importancia 40%, con penalización por vencido).",
        params: {},
        code: `const st = store.load();
const items: any[] = st.items || [];
if (!items.length) return ok({ item: null });
const score = (it: any) => it.urgencia * 0.6 + it.importancia * 0.4 + (it.vence && new Date(it.vence) < new Date() ? 5 : 0);
items.sort((a, b) => score(b) - score(a));
const top = items.shift();
store.save(st);
return ok({ item: top, restantes: items.length });`,
      },
      {
        name: "matrix",
        desc: "Snapshot de la matriz Eisenhower: items por cuadrante.",
        params: {},
        code: `const st = store.load();
const items: any[] = st.items || [];
const cuadrantes: any = { "hacer-ya": [], "planificar": [], "delegar": [], "eliminar": [] };
for (const it of items) (cuadrantes[it.cuadrante] || cuadrantes.eliminar).push(it.id + " " + it.descripcion.slice(0, 60));
return ok({ total: items.length, cuadrantes });`,
      },
    ],
  },
  {
    id: "risk-register",
    title: "Risk Register",
    tagline: "Registro de riesgos: probabilidad × impacto con mitigaciones y dueños",
    category: "Cognición y Planificación",
    pain: "El agente ignora riesgos hasta que explotan: sin register, la mitigación es reactiva.",
    persistent: true,
    tools: [
      {
        name: "add_risk",
        desc: "Registra un riesgo: descripción, probabilidad (1-5), impacto (1-5), mitigación y dueño.",
        params: { descripcion: { t: "string", d: "El riesgo" }, probabilidad: { t: "number", d: "Probabilidad 1-5" }, impacto: { t: "number", d: "Impacto 1-5" }, mitigacion: { t: "string", d: "Cómo mitigarlo", opt: true }, dueno: { t: "string", d: "Responsable", opt: true } },
        code: `const st = store.load();
st.riesgos = st.riesgos || [];
const p = Math.max(1, Math.min(5, probabilidad)); const i = Math.max(1, Math.min(5, impacto));
const r = { id: "R" + (st.riesgos.length + 1), descripcion, probabilidad: p, impacto: i, score: p * i, nivel: p * i >= 15 ? "critico" : p * i >= 8 ? "alto" : p * i >= 4 ? "medio" : "bajo", mitigacion: mitigacion || "", dueno: dueno || "", estado: "abierto", creado: new Date().toISOString() };
st.riesgos.push(r);
store.save(st);
return ok({ riesgo: r });`,
      },
      {
        name: "top_risks",
        desc: "Top riesgos abiertos ordenados por score, con mitigaciones pendientes.",
        params: { n: { t: "number", d: "Cuántos", opt: true, def: 10 } },
        code: `const st = store.load();
const abiertos = (st.riesgos || []).filter((r) => r.estado === "abierto").sort((a: any, b: any) => b.score - a.score);
return ok({ total_abiertos: abiertos.length, criticos: abiertos.filter((r) => r.nivel === "critico").length, top: abiertos.slice(0, n ?? 10) });`,
      },
      {
        name: "close_risk",
        desc: "Cierra un riesgo (ocurrió, se mitigó o se aceptó).",
        params: { id: { t: "string", d: "ID del riesgo" }, desenlace: { t: "enum", values: ["mitigado", "ocurrio", "aceptado"], d: "Desenlace" }, nota: { t: "string", d: "Nota", opt: true } },
        code: `const st = store.load();
const r = (st.riesgos || []).find((x) => x.id === id);
if (!r) return fail("riesgo no existe");
r.estado = "cerrado";
r.desenlace = desenlace;
r.nota_final = nota || "";
r.cerrado = new Date().toISOString();
store.save(st);
return ok({ id, estado: "cerrado", desenlace });`,
      },
    ],
  },
  {
    id: "assumption-auditor",
    title: "Assumption Auditor",
    tagline: "Audita supuestos del agente: explícitos, críticos y cómo validarlos",
    category: "Cognición y Planificación",
    pain: "Los supuestos ocultos rompen planes enteros: nadie los enumera ni valida antes de construir encima.",
    tools: [
      {
        name: "audit_plan",
        desc: "Extrae supuestos implícitos de un plan/objetivo (señales lingüísticas: presuposiciones, dependencias, certezas) y los clasifica por criticidad.",
        params: { plan: { t: "string", d: "El plan u objetivo en texto" } },
        code: `const t = plan;
const patrones: Array<[string, string, number]> = [
  ["\\b(si|cuando|una vez que|después de)\\b[^.]{5,80}", "condicional-dependiente", 4],
  ["\\b(asumiendo|suponiendo|dando por hecho|se asume)\\b", "supuesto-explicito", 3],
  ["\\b(todo el mundo|el usuario|el equipo|la api|el sistema)\\b[^.]{0,60}\\b(está|están|tiene|tienen|quiere|quieren)\\b", "generalizacion-sobre-otros", 3],
  ["\\b(ya|siempre|nunca|obviamente|de sobra)\\b", "certeza-no-verificada", 2],
  ["\\b(sin|no hay|nadie)\\b[^.]{0,50}\\b(problema|cambio|conflicto|fallo)\\b", "ausencia- asumida", 4],
  ["\\b(api|endpoint|base de datos|librería|versión)\\b[^.]{0,60}\\b(funciona|soporta|permite)\\b", "dependencia-técnica", 5],
];
const supuestos: any[] = [];
for (const [pat, tipo, criticidad] of patrones) {
  const matches = t.match(new RegExp(pat, "gi")) || [];
  for (const m of matches.slice(0, 5)) supuestos.push({ supuesto: m.trim().slice(0, 120), tipo, criticidad, validacion_sugerida: tipo === "dependencia-técnica" ? "probar el endpoint/librería AHORA con un smoke test" : "preguntar al stakeholder o buscar evidencia" });
}
return ok({ total: supuestos.length, criticos: supuestos.filter((s) => s.criticidad >= 4).length, supuestos: supuestos.sort((a: any, b: any) => b.criticidad - a.criticidad), advertencia: supuestos.length === 0 ? "sin supuestos detectados por heurística: revisa manualmente" : "valida los críticos ANTES de ejecutar el plan" });`,
      },
      {
        name: "validate_assumption",
        desc: "Guía la validación de un supuesto específico: qué evidencia lo confirmaría/refutaría y qué hacer en cada caso.",
        params: { supuesto: { t: "string", d: "El supuesto a validar" }, criticidad: { t: "enum", values: ["baja", "media", "alta"], d: "Qué pasa si es falso", opt: true, def: "media" } },
        code: `return ok({ supuesto, plan_de_validacion: [
  "1. Define qué evidencia lo confirmaría (dato, doc, test, testimonio)",
  "2. Define qué evidencia lo refutaría",
  "3. Busca la más barata de obtener primero",
  "4. Asigna un deadline de validación",
], si_es_falso: criticidad === "alta" ? "detén el plan y rediseña: la base se cae" : "ajusta el plan: contención o alternativa", costo_de_no_validar: criticidad === "alta" ? "cascada de retrabajo" : "ajuste local" });`,
      },
    ],
  },
  {
    id: "retro-analyzer",
    title: "Retro Analyzer",
    tagline: "Retrospectivas: qué salió bien, qué no y acciones concretas",
    category: "Cognición y Planificación",
    pain: "Sin retros el agente repite los mismos errores: el aprendizaje de la ejecución se pierde.",
    persistent: true,
    tools: [
      {
        name: "log_event",
        desc: "Registra un evento de la ejecución para la retrospectiva: tipo (logro/fallo/bloqueo/sorpresa) y detalle.",
        params: { tipo: { t: "enum", values: ["logro", "fallo", "bloqueo", "sorpresa"], d: "Tipo de evento" }, detalle: { t: "string", d: "Qué pasó" }, causa: { t: "string", d: "Causa raíz (para fallos)", opt: true } },
        code: `const st = store.load();
st.eventos = st.eventos || [];
st.eventos.push({ tipo, detalle, causa: causa || "", ts: new Date().toISOString() });
store.save(st);
return ok({ total_eventos: st.eventos.length });`,
      },
      {
        name: "analyze",
        desc: "Genera la retrospectiva: patrones por tipo de evento, causas recurrentes y acciones concretas priorizadas.",
        params: {},
        code: `const st = store.load();
const evs = st.eventos || [];
if (!evs.length) return fail("sin eventos: log_event primero");
const conteo: any = {};
for (const e of evs) conteo[e.tipo] = (conteo[e.tipo] || 0) + 1;
const causas: any = {};
for (const e of evs.filter((e) => e.causa)) causas[e.causa] = (causas[e.causa] || 0) + 1;
const causas_top = Object.entries(causas).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
const acciones = causas_top.map(([causa, n]: any) => ({ accion: "ataca la causa recurrente: " + causa, prioridad: n >= 2 ? "alta" : "media", apariciones: n }));
return ok({ eventos: evs.length, resumen: conteo, causas_recurrentes: causas_top, acciones, keep: evs.filter((e) => e.tipo === "logro").slice(0, 3).map((e) => e.detalle), drop: evs.filter((e) => e.tipo === "bloqueo" || e.tipo === "fallo").slice(0, 3).map((e) => e.detalle) });`,
      },
    ],
  },
  {
    id: "uncertainty-quantifier",
    title: "Uncertainty Quantifier",
    tagline: "Cuantifica la confianza del agente: estimaciones con rangos y calibración Brier",
    category: "Cognición y Planificación",
    pain: "El agente expresa certeza binaria (sí/no) en vez de probabilidades: sin calibración, la confianza no significa nada.",
    persistent: true,
    tools: [
      {
        name: "estimate_confidence",
        desc: "Convierte una creencia verbal (seguro/probable/quizás) en probabilidad con rango, y valida coherencia.",
        params: { afirmacion: { t: "string", d: "La afirmación a cuantificar" }, nivel_verbal: { t: "enum", values: ["seguro", "muy-probable", "probable", "posible", "improbable", "casi-imposible"], d: "Nivel verbal de confianza" }, evidencia_items: { t: "number", d: "Cuántas evidencias independientes tienes", opt: true, def: 0 } },
        code: `const tabla: any = { "seguro": [0.95, 0.99], "muy-probable": [0.8, 0.9], "probable": [0.6, 0.75], "posible": [0.4, 0.6], "improbable": [0.1, 0.25], "casi-imposible": [0.01, 0.05] };
const [lo, hi] = tabla[nivel_verbal] || tabla.posible;
const evid = evidencia_items ?? 0;
let ajuste = 1;
if (evid === 0) ajuste = 0.7; else if (evid <= 2) ajuste = 0.85;
const punto = Math.max(0.01, Math.min(0.99, ((lo + hi) / 2) * ajuste));
return ok({ afirmacion: afirmacion.slice(0, 100), nivel_verbal, probabilidad_puntual: Math.round(punto * 100) + "%", rango: [Math.round(lo * ajuste * 100) + "%", Math.round(hi * ajuste * 100) + "%"], penalizacion_evidencia: evid === 0 ? "sin evidencia: confianza reducida 30%" : evid <= 2 ? "poca evidencia: reducida 15%" : "sin penalización", accion: punto < 0.6 ? "reúne más evidencia antes de actuar" : "suficiente para proceder con monitoreo" });`,
      },
      {
        name: "calibrate",
        desc: "Calibra tu confianza histórica: registra predicciones con probabilidad y outcomes; calcula score de Brier (menor = mejor).",
        params: { prediccion: { t: "string", d: "La predicción", opt: true }, probabilidad: { t: "number", d: "Probabilidad estimada 0-1", opt: true }, ocurrio: { t: "boolean", d: "¿Ocurrió? (para resolver una predicción previa)", opt: true } },
        code: `const st = store.load();
st.predicciones = st.predicciones || [];
if (prediccion && probabilidad !== undefined) {
  st.predicciones.push({ texto: prediccion, p: probabilidad, resuelta: null, ts: new Date().toISOString() });
  store.save(st);
  return ok({ registrada: true, pendientes: st.predicciones.filter((x) => x.resuelta === null).length });
}
if (ocurrio !== undefined) {
  const pend = st.predicciones.find((x) => x.resuelta === null);
  if (!pend) return fail("sin predicciones pendientes");
  pend.resuelta = ocurrio;
  store.save(st);
}
const resueltas = st.predicciones.filter((x) => x.resuelta !== null);
if (!resueltas.length) return fail("sin predicciones resueltas para calibrar");
const brier = resueltas.reduce((a: number, p: any) => a + (p.p - (p.resuelta ? 1 : 0)) ** 2, 0) / resueltas.length;
return ok({ resueltas: resueltas.length, brier_score: Math.round(brier * 1000) / 1000, interpretacion: brier < 0.1 ? "calibración excelente" : brier < 0.25 ? "calibración decente" : brier < 0.33 ? "mejor que azar apenas" : "peor que azar: revisa tus sesgos", pendientes: st.predicciones.filter((x) => x.resuelta === null).map((x) => x.texto.slice(0, 80)) });`,
      },
    ],
  },
];

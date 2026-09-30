// ═══ CATEGORÍA: Dolores de agentes · Memoria y Contexto (B) ═══
export default [
  {
    id: "scratchpad",
    title: "Scratchpad",
    tagline: "Pizarra temporal por tarea: lo que el agente piensa sin ensuciar el contexto",
    category: "Memoria y Contexto",
    pain: "El agente mezcla razonamiento intermedio con contexto durable: necesita una pizarra de trabajo desechable y aislada por tarea.",
    persistent: true,
    tools: [
      {
        name: "write",
        desc: "Escribe en la pizarra de la tarea activa (anexar o reemplazar por etiqueta).",
        params: { etiqueta: { t: "string", d: "Etiqueta de la nota (ej: hipotesis-1)" }, contenido: { t: "string", d: "Contenido" }, tarea: { t: "string", d: "Tarea activa", opt: true, def: "default" } },
        code: `const st = store.load();
const t = tarea || "default";
st[t] = st[t] || {};
st[t][etiqueta] = { contenido, ts: new Date().toISOString() };
store.save(st);
return ok({ tarea: t, etiqueta, total_notas: Object.keys(st[t]).length });`,
      },
      {
        name: "read",
        desc: "Lee la pizarra completa de la tarea (o una etiqueta específica).",
        params: { tarea: { t: "string", d: "Tarea", opt: true, def: "default" }, etiqueta: { t: "string", d: "Etiqueta específica", opt: true } },
        code: `const st = store.load();
const t = tarea || "default";
const notas = st[t] || {};
if (etiqueta) return ok(notas[etiqueta] ? { etiqueta, ...notas[etiqueta] } : { etiqueta, contenido: null });
return ok({ tarea: t, notas });`,
      },
      {
        name: "clear",
        desc: "Limpia la pizarra de una tarea (el razonamiento intermedio no debe persistir).",
        params: { tarea: { t: "string", d: "Tarea a limpiar", opt: true, def: "default" } },
        code: `const st = store.load();
delete st[tarea || "default"];
store.save(st);
return ok({ limpiada: tarea || "default" });`,
      },
      {
        name: "list_tasks",
        desc: "Lista las tareas con pizarra activa y cuántas notas tienen cada una.",
        params: {},
        code: `const st = store.load();
const tareas = Object.entries(st).map(([t, v]: [string, any]) => ({ tarea: t, notas: Object.keys(v || {}).length }));
return ok({ tareas });`,
      },
    ],
  },
  {
    id: "working-state-store",
    title: "Working State Store",
    tagline: "Estado de trabajo versionado con historial: checkpoints del agente",
    category: "Memoria y Contexto",
    pain: "El estado intermedio de una tarea se pierde en un crash: sin checkpoints, el agente vuelve a empezar.",
    persistent: true,
    tools: [
      {
        name: "save_state",
        desc: "Guarda el estado actual de una tarea como nueva versión (checkpoint numerado).",
        params: { tarea: { t: "string", d: "Nombre de la tarea" }, estado: { t: "any", d: "Estado (JSON)" }, nota: { t: "string", d: "Nota del checkpoint", opt: true } },
        code: `const st = store.load();
st[tarea] = st[tarea] || { versiones: [] };
st[tarea].versiones.push({ n: st[tarea].versiones.length + 1, estado, nota: nota || "", ts: new Date().toISOString() });
if (st[tarea].versiones.length > 50) st[tarea].versiones = st[tarea].versiones.slice(-50);
store.save(st);
return ok({ tarea, version: st[tarea].versiones.length, total: st[tarea].versiones.length });`,
      },
      {
        name: "load_state",
        desc: "Carga la última versión del estado de una tarea (o una versión específica).",
        params: { tarea: { t: "string", d: "Tarea" }, version: { t: "number", d: "Versión específica", opt: true } },
        code: `const st = store.load();
const t = st[tarea];
if (!t?.versiones?.length) return fail("sin estado guardado para esa tarea");
const v = version ? t.versiones.find((x: any) => x.n === version) : t.versiones[t.versiones.length - 1];
if (!v) return fail("versión no existe");
return ok({ tarea, version: v.n, nota: v.nota, guardada: v.ts, estado: v.estado });`,
      },
      {
        name: "diff_versions",
        desc: "Compara dos versiones del estado de una tarea: claves añadidas, eliminadas y cambiadas.",
        params: { tarea: { t: "string", d: "Tarea" }, v1: { t: "number", d: "Versión base" }, v2: { t: "number", d: "Versión a comparar" } },
        code: `const st = store.load();
const t = st[tarea];
if (!t?.versiones?.length) return fail("sin versiones");
const a = t.versiones.find((x: any) => x.n === v1)?.estado || {};
const b = t.versiones.find((x: any) => x.n === v2)?.estado || {};
const ka = new Set(Object.keys(a)); const kb = new Set(Object.keys(b));
const añadidas = [...kb].filter((k) => !ka.has(k));
const eliminadas = [...ka].filter((k) => !kb.has(k));
const cambiadas = [...ka].filter((k) => kb.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
return ok({ tarea, v1, v2, añadidas, eliminadas, cambiadas });`,
      },
    ],
  },
  {
    id: "session-recall",
    title: "Session Recall",
    tagline: "Contexto de sesión: guarda al cerrar, restaura al abrir",
    category: "Memoria y Contexto",
    pain: "Cada sesión nueva pierde el hilo: el agente necesita guardar un resumen de contexto al cerrar y restaurarlo al abrir.",
    persistent: true,
    tools: [
      {
        name: "save_context",
        desc: "Guarda el contexto de cierre de sesión: objetivo actual, estado, próximos pasos y claves de memoria a restaurar.",
        params: { objetivo: { t: "string", d: "Objetivo de la sesión" }, estado_actual: { t: "string", d: "Dónde quedaste" }, proximos_pasos: { t: "array", d: "Próximos pasos" }, claves: { t: "array", d: "Claves de memoria relevantes", opt: true } },
        code: `const st = store.load();
st.sesiones = st.sesiones || [];
st.sesiones.push({ cerrada: new Date().toISOString(), objetivo, estado_actual, proximos_pasos: Array.isArray(proximos_pasos) ? proximos_pasos : [], claves: Array.isArray(claves) ? claves : [] });
store.save(st);
return ok({ sesiones_guardadas: st.sesiones.length });`,
      },
      {
        name: "restore_last",
        desc: "Restaura el contexto de la última sesión guardada: objetivo, estado y próximos pasos listos para continuar.",
        params: {},
        code: `const st = store.load();
if (!st.sesiones?.length) return fail("sin sesiones guardadas");
const s = st.sesiones[st.sesiones.length - 1];
return ok({ ...s, hace: Math.round((Date.now() - new Date(s.cerrada).getTime()) / 60000) + " minutos", claves_a_recover: s.claves });`,
      },
      {
        name: "list_sessions",
        desc: "Lista las sesiones guardadas (objetivo y fecha) para elegir cuál restaurar.",
        params: {},
        code: `const st = store.load();
return ok({ sesiones: (st.sesiones || []).map((s: any, i: number) => ({ i, cerrada: s.cerrada, objetivo: s.objetivo })) });`,
      },
    ],
  },
  {
    id: "token-counter",
    title: "Token Counter",
    tagline: "Cuenta tokens y palabras antes de enviar: presupuesto bajo control",
    category: "Memoria y Contexto",
    pain: "El agente envía prompts gigantes sin saber cuánto costarán: falta un contador previo (aproximado, sin API).",
    tools: [
      {
        name: "count",
        desc: "Cuenta tokens aproximados de un texto (heurística chars/4 + palabras/0.75, calibrada para español e inglés).",
        params: { texto: { t: "string", d: "Texto a medir" } },
        code: `const chars = texto.length;
const palabras = texto.split(/\\s+/).filter(Boolean).length;
const por_chars = Math.ceil(chars / 4);
const por_palabras = Math.ceil(palabras / 0.75);
const estimado = Math.max(por_chars, por_palabras);
return ok({ caracteres: chars, palabras, tokens_estimados: estimado, rango: [Math.floor(estimado * 0.85), Math.ceil(estimado * 1.15)], metodo: "heurística local (chars/4 + palabras/0.75)" });`,
      },
      {
        name: "count_messages",
        desc: "Cuenta tokens de una conversación completa [{rol, contenido}] incluyendo overhead por mensaje.",
        params: { mensajes: { t: "array", d: "Lista de mensajes {rol, contenido}" } },
        code: `const msgs = Array.isArray(mensajes) ? mensajes : [];
let total = 0;
const detalle = msgs.map((m: any) => {
  const t = Math.ceil(String(m.contenido || "").length / 4) + 4;
  total += t;
  return { rol: m.rol, tokens: t };
});
return ok({ mensajes: msgs.length, tokens_total: total, detalle });`,
      },
      {
        name: "fit_check",
        desc: "Verifica si un prompt entra en la ventana de un modelo dado (gpt4, claude, gemini...) y cuánto queda para la respuesta.",
        params: { tokens_prompt: { t: "number", d: "Tokens del prompt" }, modelo: { t: "enum", values: ["small-8k", "medium-32k", "large-128k", "xlarge-200k", "giant-1m"], d: "Clase de modelo", opt: true, def: "large-128k" } },
        code: `const ventanas: any = { "small-8k": 8192, "medium-32k": 32768, "large-128k": 131072, "xlarge-200k": 204800, "giant-1m": 1048576 };
const v = ventanas[modelo || "large-128k"];
const cabe = tokens_prompt < v * 0.8;
return ok({ modelo, ventana: v, prompt: tokens_prompt, disponible_para_respuesta: v - tokens_prompt, cabe_con_margen_20: cabe, recomendacion: cabe ? "ok" : "comprime con context-compressor o sube de modelo" });`,
      },
    ],
  },
  {
    id: "context-rot-detector",
    title: "Context Rot Detector",
    tagline: "Detecta información podrida en el contexto: datos viejos, contradicciones y duplicados",
    category: "Memoria y Contexto",
    pain: "El contexto se pudre: datos desactualizados y contradictorios acumulados degradan la calidad de las respuestas (context rot).",
    tools: [
      {
        name: "detect_stale",
        desc: "Detecta entradas viejas en una lista de items {texto, ts}: flaggea las que superan la frescura máxima por tipo de dato.",
        params: { items: { t: "array", d: "Items [{texto, ts ISO}]" }, max_horas: { t: "number", d: "Frescura máxima en horas", opt: true, def: 72 } },
        code: `const list = Array.isArray(items) ? items : [];
const limite = Date.now() - (max_horas ?? 72) * 3600000;
const analisis = list.map((it: any) => {
  const ts = new Date(it.ts || 0).getTime();
  const edad_h = Math.round((Date.now() - ts) / 3600000);
  return { texto: String(it.texto || "").slice(0, 80), ts: it.ts, edad_horas: Number.isFinite(edad_h) && edad_h >= 0 ? edad_h : null, podrido: ts < limite };
});
const podridos = analisis.filter((a) => a.podrido).length;
return ok({ total: list.length, podridos, frescura_max_horas: max_horas ?? 72, analisis, recomendacion: podridos > list.length / 3 ? "contexto gravemente podrido: reconstruir" : podridos > 0 ? "purgar " + podridos + " entradas viejas" : "fresco" });`,
      },
      {
        name: "detect_contradictions",
        desc: "Detecta contradicciones simples entre afirmaciones: números distintos sobre el mismo sujeto o negaciones opuestas.",
        params: { afirmaciones: { t: "array", d: "Lista de afirmaciones (strings)" } },
        code: `const af = (Array.isArray(afirmaciones) ? afirmaciones : []).map(String);
const pares: any[] = [];
for (let i = 0; i < af.length; i++) {
  for (let j = i + 1; j < af.length; j++) {
    const a = af[i].toLowerCase(), b = af[j].toLowerCase();
    const numA = a.match(/\\d+(\\.\\d+)?/g) || [], numB = b.match(/\\d+(\\.\\d+)?/g) || [];
    const mismo_sujeto = a.split(/\\s+/).some((w) => w.length > 5 && b.includes(w));
    const num_conflict = mismo_sujeto && numA.length && numB.length && numA.join() !== numB.join();
    const negacion = (a.includes(" no ") && !b.includes(" no ") || b.includes(" no ") && !a.includes(" no ")) && mismo_sujeto;
    if (num_conflict || negacion) pares.push({ a: af[i].slice(0, 120), b: af[j].slice(0, 120), tipo: num_conflict ? "cifras-discrepantes" : "negacion-opuesta" });
  }
}
return ok({ total_afirmaciones: af.length, contradicciones: pares, limpio: pares.length === 0 });`,
      },
      {
        name: "dedupe_context",
        desc: "Elimina entradas duplicadas/casi-duplicadas de una lista de textos (similitud Jaccard sobre palabras).",
        params: { textos: { t: "array", d: "Lista de textos" }, umbral: { t: "number", d: "Similitud umbral (0-1)", opt: true, def: 0.8 } },
        code: `const list = (Array.isArray(textos) ? textos : []).map(String);
const kept: string[] = [];
const dupes: string[] = [];
const jaccard = (a: string, b: string) => {
  const sa = new Set(a.toLowerCase().split(/\\s+/).filter((w) => w.length > 3));
  const sb = new Set(b.toLowerCase().split(/\\s+/).filter((w) => w.length > 3));
  const inter = [...sa].filter((w) => sb.has(w)).length;
  return inter / (sa.size + sb.size - inter || 1);
};
for (const t of list) {
  const dup = kept.some((k) => jaccard(k, t) >= (umbral ?? 0.8));
  if (dup) dupes.push(t); else kept.push(t);
}
return ok({ originales: list.length, conservados: kept.length, duplicados: dupes.length, reduccion: Math.round((1 - kept.length / (list.length || 1)) * 100) + "%" });`,
      },
    ],
  },
  {
    id: "attention-focus",
    title: "Attention Focus",
    tagline: "Prioriza qué merece atención: ranking de secciones del contexto por relevancia",
    category: "Memoria y Contexto",
    pain: "Todo el contexto pesa igual y nada destaca: el agente diluye la atención en irrelevantes.",
    tools: [
      {
        name: "prioritize",
        desc: "Rankea secciones {nombre, texto} por relevancia contra una consulta: coincidencias de términos, posición y densidad.",
        params: { secciones: { t: "array", d: "Lista de {nombre, texto}" }, consulta: { t: "string", d: "A qué hay que prestar atención" } },
        code: `const items = Array.isArray(secciones) ? secciones : [];
const qwords = consulta.toLowerCase().split(/\\s+/).filter((w) => w.length > 3);
const rankeo = items.map((s: any, i: number) => {
  const texto = String(s.texto || "").toLowerCase();
  const hits = qwords.filter((w) => texto.includes(w)).length;
  const densidad = texto.length ? hits / (texto.length / 500) : 0;
  return { nombre: s.nombre, indice: i, hits, score: Math.round((hits * 2 + densidad) * 100) / 100 };
}).sort((a: any, b: any) => b.score - a.score);
return ok({ consulta, ranking: rankeo, top: rankeo[0]?.nombre || null });`,
      },
      {
        name: "focus_window",
        desc: "Construye la ventana de foco: las K secciones más relevantes concatenadas, listas para usar como contexto reducido.",
        params: { secciones: { t: "array", d: "Lista de {nombre, texto}" }, consulta: { t: "string", d: "Consulta" }, k: { t: "number", d: "Cuántas secciones", opt: true, def: 3 } },
        code: `const items = Array.isArray(secciones) ? secciones : [];
const qwords = consulta.toLowerCase().split(/\\s+/).filter((w) => w.length > 3);
const top = items.map((s: any) => {
  const texto = String(s.texto || "").toLowerCase();
  const hits = qwords.filter((w) => texto.includes(w)).length;
  return { s, hits };
}).sort((a, b) => b.hits - a.hits).slice(0, k ?? 3);
const ventana = top.filter((t) => t.hits > 0).map((t) => "### " + t.s.nombre + "\\n" + t.s.texto).join("\\n\\n");
return ok({ secciones_usadas: top.length, tokens_estimados: Math.ceil(ventana.length / 4), ventana });`,
      },
    ],
  },
];

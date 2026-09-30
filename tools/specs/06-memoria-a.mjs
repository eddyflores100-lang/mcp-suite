// ═══ CATEGORÍA: Dolores de agentes · Memoria y Contexto (A) ═══
// Dolor de fondo: los agentes olvidan entre sesiones, desbordan el contexto
// y no gestionan su presupuesto de tokens.
export default [
  {
    id: "agent-memory",
    title: "Agent Memory",
    tagline: "Memoria KV persistente entre sesiones con TTL y namespaces",
    category: "Memoria y Contexto",
    pain: "Los agentes amnésicos olvidan todo al cerrar la sesión: cada conversación empieza de cero.",
    persistent: true,
    notes: "Clave-valor persistente en ~/.mcp-suite/agent-memory/. Soporta namespaces (por proyecto/agente), TTL opcional y búsqueda por prefijo.",
    tools: [
      {
        name: "remember",
        desc: "Guarda un valor bajo una clave (con namespace y TTL opcional). Persiste entre sesiones.",
        params: { clave: { t: "string", d: "Clave única" }, valor: { t: "string", d: "Valor a recordar" }, namespace: { t: "string", d: "Namespace (ej: proyecto-x)", opt: true, def: "default" }, ttl_segundos: { t: "number", d: "TTL: expira tras N segundos", opt: true } },
        code: `const st = store.load();
const ns = namespace || "default";
st[ns] = st[ns] || {};
st[ns][clave] = { v: valor, ts: new Date().toISOString(), exp: ttl_segundos ? new Date(Date.now() + ttl_segundos * 1000).toISOString() : null };
store.save(st);
return ok({ guardado: true, clave, namespace: ns, expira: st[ns][clave].exp });`,
      },
      {
        name: "recall",
        desc: "Recupera el valor de una clave (respetando TTL: devuelve null si expiró).",
        params: { clave: { t: "string", d: "Clave a recuperar" }, namespace: { t: "string", d: "Namespace", opt: true, def: "default" } },
        code: `const st = store.load();
const ns = namespace || "default";
const item = st[ns]?.[clave];
if (!item) return ok({ clave, valor: null, razon: "no existe" });
if (item.exp && new Date(item.exp) < new Date()) { delete st[ns][clave]; store.save(st); return ok({ clave, valor: null, razon: "expirada" }); }
return ok({ clave, valor: item.v, guardada: item.ts });`,
      },
      {
        name: "list_keys",
        desc: "Lista las claves guardadas en un namespace (con timestamps y expiración).",
        params: { namespace: { t: "string", d: "Namespace", opt: true, def: "default" }, prefijo: { t: "string", d: "Filtrar por prefijo", opt: true } },
        code: `const st = store.load();
const ns = namespace || "default";
let claves = Object.entries(st[ns] || {});
if (prefijo) claves = claves.filter(([k]) => k.startsWith(prefijo));
return ok({ namespace: ns, total: claves.length, claves: claves.map(([k, v]: [string, any]) => ({ clave: k, guardada: v.ts, expira: v.exp })) });`,
      },
      {
        name: "forget",
        desc: "Elimina una clave (o todo el namespace con confirmar=true).",
        params: { clave: { t: "string", d: "Clave a olvidar", opt: true }, namespace: { t: "string", d: "Namespace", opt: true, def: "default" }, confirmar: { t: "boolean", d: "Borrar namespace completo", opt: true, def: false } },
        code: `const st = store.load();
const ns = namespace || "default";
if (confirmar && !clave) { delete st[ns]; store.save(st); return ok({ olvidado: "namespace " + ns }); }
if (!clave) return fail("necesitas clave o confirmar=true");
delete (st[ns] || {})[clave];
store.save(st);
return ok({ olvidado: clave });`,
      },
    ],
  },
  {
    id: "agent-memory-graph",
    title: "Agent Memory Graph",
    tagline: "Memoria de entidades y relaciones: el grafo de conocimiento del agente",
    category: "Memoria y Contexto",
    pain: "La memoria plana pierde las RELACIONES (quién trabaja con quién, qué depende de qué): los agentes necesitan memoria estructural.",
    persistent: true,
    notes: "Grafo dirigido etiquetado persistente: nodos {id, tipo, props} y aristas {desde, hacia, relación}. Consulta de vecinos y caminos de longitud 2.",
    tools: [
      {
        name: "add_entity",
        desc: "Añade una entidad al grafo de memoria (persona, proyecto, concepto, herramienta...).",
        params: { id: { t: "string", d: "Identificador único" }, tipo: { t: "string", d: "Tipo (persona/proyecto/concepto)" }, props: { t: "any", d: "Propiedades adicionales", opt: true } },
        code: `const st = store.load();
st.entidades = st.entidades || {};
st.entidades[id] = { tipo, props: props || {}, creado: new Date().toISOString() };
store.save(st);
return ok({ entidad: id, tipo, total_entidades: Object.keys(st.entidades).length });`,
      },
      {
        name: "link",
        desc: "Crea una relación dirigida entre dos entidades (ej: alice -> trabaja_en -> proyecto-x).",
        params: { desde: { t: "string", d: "Entidad origen" }, hacia: { t: "string", d: "Entidad destino" }, relacion: { t: "string", d: "Nombre de la relación" } },
        code: `const st = store.load();
st.aristas = st.aristas || [];
if (!st.entidades?.[desde]) return fail("entidad origen no existe: add_entity primero");
if (!st.entidades?.[hacia]) return fail("entidad destino no existe: add_entity primero");
st.aristas.push({ desde, hacia, relacion, ts: new Date().toISOString() });
store.save(st);
return ok({ arista: desde + " -" + relacion + "-> " + hacia, total_aristas: st.aristas.length });`,
      },
      {
        name: "neighbors",
        desc: "Devuelve vecinos de una entidad: relaciones entrantes y salientes con nombres.",
        params: { entidad: { t: "string", d: "Entidad a consultar" } },
        code: `const st = store.load();
const salientes = (st.aristas || []).filter((a: any) => a.desde === entidad).map((a: any) => ({ relacion: a.relacion, destino: a.hacia }));
const entrantes = (st.aristas || []).filter((a: any) => a.hacia === entidad).map((a: any) => ({ origen: a.desde, relacion: a.relacion }));
return ok({ entidad, tipo: st.entidades?.[entidad]?.tipo, salientes, entrantes });`,
      },
      {
        name: "query_path",
        desc: "Encuentra caminos de hasta 2 saltos entre dos entidades (quién conecta con quién).",
        params: { origen: { t: "string", d: "Entidad origen" }, destino: { t: "string", d: "Entidad destino" } },
        code: `const st = store.load();
const aristas: any[] = st.aristas || [];
const caminos: any[] = [];
for (const a of aristas.filter((a) => a.desde === origen && a.hacia === destino)) caminos.push({ camino: [origen, destino], via: a.relacion });
for (const a1 of aristas.filter((a) => a.desde === origen)) {
  for (const a2 of aristas.filter((a) => a.desde === a1.hacia && a.hacia === destino)) {
    caminos.push({ camino: [origen, a1.hacia, destino], via: a1.relacion + " -> " + a2.relacion });
  }
}
return ok({ origen, destino, caminos, conectados: caminos.length > 0 });`,
      },
    ],
  },
  {
    id: "agent-episodic-log",
    title: "Agent Episodic Log",
    tagline: "Bitácora cronológica de episodios: qué pasó, cuándo y con qué resultado",
    category: "Memoria y Contexto",
    pain: "Sin bitácora temporal el agente no puede reconstruir qué hizo ni cuándo: debugging y auditoría imposibles.",
    persistent: true,
    tools: [
      {
        name: "log_event",
        desc: "Registra un episodio con timestamp: acción, resultado, contexto y severidad.",
        params: { accion: { t: "string", d: "Qué se hizo" }, resultado: { t: "string", d: "Resultado (éxito/fallo/detalle)" }, contexto: { t: "string", d: "Contexto adicional", opt: true }, severidad: { t: "enum", values: ["info", "warn", "error"], d: "Severidad", opt: true, def: "info" } },
        code: `const st = store.load();
st.eventos = st.eventos || [];
const e = { ts: new Date().toISOString(), accion, resultado, contexto: contexto || "", severidad: severidad || "info" };
st.eventos.push(e);
if (st.eventos.length > 2000) st.eventos = st.eventos.slice(-2000);
store.save(st);
return ok({ registrado: e, total_eventos: st.eventos.length });`,
      },
      {
        name: "timeline",
        desc: "Devuelve la línea de tiempo de eventos (filtrable por severidad y ventana de tiempo en horas).",
        params: { severidad: { t: "enum", values: ["info", "warn", "error"], d: "Filtrar severidad", opt: true }, horas: { t: "number", d: "Solo últimas N horas", opt: true }, limite: { t: "number", d: "Máx eventos", opt: true, def: 50 } },
        code: `const st = store.load();
let evs = st.eventos || [];
if (severidad) evs = evs.filter((e: any) => e.severidad === severidad);
if (horas) { const desde = Date.now() - horas * 3600000; evs = evs.filter((e: any) => new Date(e.ts).getTime() >= desde); }
return ok({ total: evs.length, eventos: evs.slice(-(limite ?? 50)).reverse() });`,
      },
      {
        name: "search_events",
        desc: "Busca eventos por texto (en acción, resultado o contexto).",
        params: { texto: { t: "string", d: "Texto a buscar" }, limite: { t: "number", d: "Máx resultados", opt: true, def: 20 } },
        code: `const st = store.load();
const t = texto.toLowerCase();
const evs = (st.eventos || []).filter((e: any) => (e.accion + " " + e.resultado + " " + e.contexto).toLowerCase().includes(t));
return ok({ total: evs.length, eventos: evs.slice(-(limite ?? 20)).reverse() });`,
      },
    ],
  },
  {
    id: "context-compressor",
    title: "Context Compressor",
    tagline: "Comprime contextos largos: extrae lo esencial antes de desbordar la ventana",
    category: "Memoria y Contexto",
    pain: "El contexto crece hasta desbordar la ventana: falta compresión extractiva determinista antes de gastar tokens en reintentos.",
    tools: [
      {
        name: "compress",
        desc: "Compresión extractiva de un texto largo: selecciona las oraciones más informativas (frecuencia de términos) reduciendo a ~40% del original.",
        params: { texto: { t: "string", d: "Texto largo a comprimir" }, ratio: { t: "number", d: "Fracción a conservar (0.1-0.9)", opt: true, def: 0.4 } },
        code: `const oraciones = texto.replace(/\\s+/g, " ").split(/(?<=[.!?])\\s+/).filter((s) => s.trim().length > 10);
if (oraciones.length <= 3) return ok({ comprimido: texto, oraciones: oraciones.length, nota: "ya es corto" });
const freq: any = {};
const clean = (s: string) => s.toLowerCase().replace(/[^a-záéíóúñü0-9\\s]/g, "");
for (const o of oraciones) for (const w of clean(o).split(/\\s+/)) if (w.length > 3) freq[w] = (freq[w] || 0) + 1;
const puntuadas = oraciones.map((o, i) => {
  const words = clean(o).split(/\\s+/).filter((w) => w.length > 3);
  const score = words.reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(words.length || 1);
  return { i, o, score };
}).sort((a, b) => b.score - a.score);
const conservar = Math.max(3, Math.round(oraciones.length * (ratio ?? 0.4)));
const indices = puntuadas.slice(0, conservar).map((p) => p.i).sort((a, b) => a - b);
const comprimido = indices.map((i) => oraciones[i]).join(" ");
return ok({ original_caracteres: texto.length, comprimido_caracteres: comprimido.length, reduccion: Math.round((1 - comprimido.length / texto.length) * 100) + "%", oraciones_originales: oraciones.length, oraciones_conservadas: conservar, comprimido });`,
      },
      {
        name: "key_points",
        desc: "Extrae los N puntos clave de un texto (oraciones top por informatividad), sin reordenar el original.",
        params: { texto: { t: "string", d: "Texto a analizar" }, n: { t: "number", d: "Cuántos puntos", opt: true, def: 5 } },
        code: `const oraciones = texto.replace(/\\s+/g, " ").split(/(?<=[.!?])\\s+/).filter((s) => s.trim().length > 15);
const freq: any = {};
for (const o of oraciones) for (const w of o.toLowerCase().split(/\\s+/)) if (w.length > 4) freq[w] = (freq[w] || 0) + 1;
const top = oraciones.map((o, i) => ({ i, o, score: o.toLowerCase().split(/\\s+/).filter((w: string) => w.length > 4).reduce((a: number, w: string) => a + (freq[w] || 0), 0) })).sort((a, b) => b.score - a.score).slice(0, n ?? 5);
return ok({ puntos_clave: top.map((t) => t.o), total_oraciones: oraciones.length });`,
      },
      {
        name: "stats",
        desc: "Estadísticas del texto: caracteres, palabras, oraciones, tokens estimados y densidad informativa.",
        params: { texto: { t: "string", d: "Texto a medir" } },
        code: `const palabras = texto.split(/\\s+/).filter(Boolean);
const oraciones = texto.split(/[.!?]+/).filter((s) => s.trim().length > 0);
const unicas = new Set(palabras.map((w) => w.toLowerCase().replace(/[^a-záéíóúñü0-9]/g, ""))).size;
return ok({ caracteres: texto.length, palabras: palabras.length, oraciones: oraciones.length, tokens_estimados: Math.ceil(texto.length / 4), palabras_unicas: unicas, riqueza_lexica: palabras.length ? Math.round((unicas / palabras.length) * 100) + "%" : "0%" });`,
      },
    ],
  },
  {
    id: "context-budget",
    title: "Context Budget",
    tagline: "Presupuesto de tokens por sección: qué entra al prompt y qué se queda fuera",
    category: "Memoria y Contexto",
    pain: "Sin presupuesto, el agente mete todo al prompt hasta chocar con el límite (issue #58 del spec MCP: responses too big).",
    tools: [
      {
        name: "check_fit",
        desc: "Calcula si una lista de secciones {nombre, texto} cabe en el presupuesto de tokens del modelo (con margen para respuesta).",
        params: { secciones: { t: "array", d: "Lista de {nombre, texto}" }, presupuesto_tokens: { t: "number", d: "Límite del modelo", opt: true, def: 128000 }, margen_respuesta: { t: "number", d: "Tokens reservados para la respuesta", opt: true, def: 4000 } },
        code: `const items = Array.isArray(secciones) ? secciones : [];
const disp = presupuesto_tokens - margen_respuesta;
let acumulado = 0;
const analisis = items.map((s: any) => {
  const tokens = Math.ceil(String(s.texto || "").length / 4);
  acumulado += tokens;
  return { nombre: s.nombre, tokens, acumulado, cabe: acumulado <= disp };
});
return ok({ disponible: disp, total_secciones: acumulado, excede: acumulado > disp, sobra: disp - acumulado, analisis, recomendacion: acumulado > disp ? "recorta secciones de menor prioridad o usa context-compressor" : "todo cabe" });`,
      },
      {
        name: "plan_sections",
        desc: "Dado un presupuesto y secciones priorizadas, decide cuáles entran completas, cuáles recortadas y cuáles fuera.",
        params: { secciones: { t: "array", d: "Lista de {nombre, texto, prioridad 1-5}" }, presupuesto_tokens: { t: "number", d: "Presupuesto", opt: true, def: 32000 } },
        code: `const items = (Array.isArray(secciones) ? secciones : []).map((s: any) => ({ ...s, tokens: Math.ceil(String(s.texto || "").length / 4) }));
items.sort((a: any, b: any) => (b.prioridad || 3) - (a.prioridad || 3));
let restante = presupuesto_tokens ?? 32000;
const plan: any[] = [];
for (const s of items) {
  if (s.tokens <= restante) { plan.push({ nombre: s.nombre, modo: "completo", tokens: s.tokens }); restante -= s.tokens; }
  else if (restante > 500) { plan.push({ nombre: s.nombre, modo: "recortado", tokens_originales: s.tokens, tokens: restante }); restante = 0; }
  else plan.push({ nombre: s.nombre, modo: "fuera", tokens: s.tokens });
}
return ok({ presupuesto: presupuesto_tokens, plan });`,
      },
    ],
  },
  {
    id: "conversation-summarizer",
    title: "Conversation Summarizer",
    tagline: "Resumen incremental de conversaciones largas sin perder los compromisos",
    category: "Memoria y Contexto",
    pain: "Al resumir una conversación se pierden decisiones y tareas pendientes: el resumen debe conservar compromisos, no solo tema.",
    persistent: true,
    tools: [
      {
        name: "add_message",
        desc: "Añade un mensaje a la conversación activa (rol + contenido). Se guarda cronológicamente.",
        params: { rol: { t: "enum", values: ["user", "assistant", "system", "tool"], d: "Autor del mensaje" }, contenido: { t: "string", d: "Contenido del mensaje" } },
        code: `const st = store.load();
st.mensajes = st.mensajes || [];
st.mensajes.push({ rol, contenido, ts: new Date().toISOString() });
if (st.mensajes.length > 500) st.mensajes = st.mensajes.slice(-500);
store.save(st);
return ok({ total_mensajes: st.mensajes.length });`,
      },
      {
        name: "summarize",
        desc: "Genera resumen estructurado de la conversación: temas, decisiones detectadas, tareas pendientes y preguntas abiertas. Base perfecta para handoff.",
        params: { ultimo_n: { t: "number", d: "Solo los últimos N mensajes", opt: true } },
        code: `const st = store.load();
const msgs = st.mensajes || [];
const use = ultimo_n ? msgs.slice(-ultimo_n) : msgs;
if (!use.length) return fail("conversación vacía: add_message primero");
const texto = use.map((m: any) => m.rol + ": " + m.contenido).join("\\n");
const decisiones = use.filter((m: any) => /decid|acuerd|confirm|eleg|vamos con|aprobado|ok,? hagamos/i.test(m.contenido)).map((m: any) => m.rol + ": " + m.contenido.slice(0, 200));
const tareas = use.filter((m: any) => /tarea|pendiente|to.?do|hacer|falta|debo|hay que|pr[oó]ximo paso/i.test(m.contenido)).map((m: any) => m.contenido.slice(0, 200));
const preguntas = use.filter((m: any) => m.contenido.includes("?")).map((m: any) => m.contenido.slice(0, 150));
const temas: any = {};
for (const m of use) for (const w of m.contenido.toLowerCase().split(/\\s+/)) if (w.length > 6) temas[w] = (temas[w] || 0) + 1;
const top_temas = Object.entries(temas).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
return ok({ mensajes: use.length, mensajes_totales: msgs.length, temas_principales: top_temas, decisiones: decisiones.slice(0, 10), tareas_detectadas: tareas.slice(0, 10), preguntas_abiertas: preguntas.slice(0, 5), tokens_estimados: Math.ceil(texto.length / 4) });`,
      },
      {
        name: "reset",
        desc: "Reinicia la conversación activa (guardando archivo de histórico si confirmar=true).",
        params: { confirmar: { t: "boolean", d: "Confirmar reset", opt: true, def: false } },
        code: `if (!confirmar) return fail("requiere confirmar=true");
const st = store.load();
st.historico = st.historico || [];
if (st.mensajes?.length) st.historico.push({ cerrada: new Date().toISOString(), mensajes: st.mensajes.length });
st.mensajes = [];
store.save(st);
return ok({ reset: true, conversaciones_historicas: st.historico.length });`,
      },
    ],
  },
];

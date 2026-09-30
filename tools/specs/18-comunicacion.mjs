// ═══ CATEGORÍA: Dolores de agentes · Comunicación y Humano (8) ═══
// Dolor de fondo: falta human-in-the-loop, handoffs débiles y reportes
// que nadie puede digerir.
export default [
  {
    id: "human-approval",
    title: "Human Approval",
    tagline: "Flujo de aprobación humana: solicitudes, vencimientos y registro",
    category: "Comunicación y Humano",
    pain: "Las acciones críticas se ejecutan sin visto bueno: human-in-the-loop es promesa, no práctica.",
    persistent: true,
    tools: [
      {
        name: "request_approval",
        desc: "Solicita aprobación para una acción: contexto, riesgo y qué pasa si no se aprueba. Vence en N horas.",
        params: { accion: { t: "string", d: "Acción que requiere aprobación" }, contexto: { t: "string", d: "Por qué se propone" }, riesgo_si_rechaza: { t: "string", d: "Riesgo de NO aprobar", opt: true }, vence_horas: { t: "number", d: "Vencimiento en horas", opt: true, def: 24 } },
        code: `const st = store.load();
st.aprobaciones = st.aprobaciones || [];
st.seq = (st.seq || 0) + 1;
const req = { id: "A" + st.seq, accion, contexto, riesgo_si_rechaza: riesgo_si_rechaza || "", estado: "pendiente", solicitada: new Date().toISOString(), vence: new Date(Date.now() + (vence_horas ?? 24) * 3600000).toISOString() };
st.aprobaciones.push(req);
store.save(st);
return ok({ aprobacion_id: req.id, vence: req.vence, mensaje_para_humano: "APROBACIÓN REQUERIDA: " + accion + "\\nContexto: " + contexto + "\\nResponde con respond_approval." });`,
      },
      {
        name: "respond_approval",
        desc: "Resuelve una aprobación: aprobar, rechazar (con motivo) o pedir más info.",
        params: { id: { t: "string", d: "ID de aprobación" }, decision: { t: "enum", values: ["aprobar", "rechazar", "mas-info"], d: "Decisión" }, motivo: { t: "string", d: "Motivo", opt: true } },
        code: `const st = store.load();
const req = (st.aprobaciones || []).find((a) => a.id === id);
if (!req) return fail("aprobación no existe");
if (req.estado !== "pendiente") return fail("ya resuelta: " + req.estado);
req.estado = decision;
req.motivo = motivo || "";
req.resuelta = new Date().toISOString();
store.save(st);
return ok({ id, estado: decision, accion_autorizada: decision === "aprobar" });`,
      },
      {
        name: "pending_approvals",
        desc: "Lista aprobaciones pendientes con sus vencimientos (marca las vencidas).",
        params: {},
        code: `const st = store.load();
const pend = (st.aprobaciones || []).filter((a) => a.estado === "pendiente");
const ahora = new Date();
return ok({ pendientes: pend.length, vencidas: pend.filter((a) => new Date(a.vence) < ahora).length, items: pend.map((a) => ({ id: a.id, accion: a.accion, vence: a.vence, vencida: new Date(a.vence) < ahora })) });`,
      },
    ],
  },
  {
    id: "feedback-loop",
    title: "Feedback Loop",
    tagline: "Recolecta feedback estructurado y detecta sentimiento sin APIs externas",
    category: "Comunicación y Humano",
    pain: "El feedback llega suelto por chat: sin registro ni análisis, el agente repite lo que molesta.",
    persistent: true,
    tools: [
      {
        name: "collect",
        desc: "Registra feedback: categoría (claridad, velocidad, calidad, error), texto y puntuación opcional 1-5.",
        params: { categoria: { t: "enum", values: ["claridad", "velocidad", "calidad", "error", "sugerencia"], d: "Categoría" }, texto: { t: "string", d: "El feedback" }, puntuacion: { t: "number", d: "1-5 opcional", opt: true } },
        code: `const st = store.load();
st.feedback = st.feedback || [];
st.feedback.push({ categoria, texto, puntuacion: puntuacion ?? null, ts: new Date().toISOString() });
store.save(st);
return ok({ total_feedback: st.feedback.length });`,
      },
      {
        name: "sentiment_lite",
        desc: "Sentimiento léxico local (ES): positivo/negativo/neutral con los términos detectados, sin APIs.",
        params: { texto: { t: "string", d: "Feedback a analizar" } },
        code: `const positivas = ["bien", "excelente", "genial", "gracias", "perfecto", "claro", "útil", "rápido", "sí", "correcto", "me gusta", "funciona", "increíble", "buen", "bueno", "buena", "excelente"];
const negativas = ["mal", "malo", "mala", "lento", "error", "fallo", "no funciona", "confuso", "no entiendo", "difícil", "peor", "molesto", "no me gusta", "equivocado", "roto", "pésimo", "inútil", "no"];
const t = " " + texto.toLowerCase() + " ";
let score = 0; const hallados_pos: string[] = []; const hallados_neg: string[] = [];
for (const p of positivas) { const re = new RegExp("\\\\b" + p + "\\\\b"); if (re.test(t)) { score++; hallados_pos.push(p); } }
for (const n of negativas) { const re = new RegExp("\\\\b" + n + "\\\\b"); if (re.test(t)) { score--; hallados_neg.push(n); } }
const excl = /[!]{2,}/.test(texto) ? 1 : 0;
const sentimiento = score + excl > 0 ? "positivo" : score < 0 ? "negativo" : "neutral";
return ok({ sentimiento, score, terminos_positivos: hallados_pos, terminos_negativos: hallados_neg, intensidad: Math.abs(score) });`,
      },
      {
        name: "summarize_feedback",
        desc: "Resumen del feedback acumulado: promedio por categoría, temas frecuentes y sentimiento global.",
        params: {},
        code: `const st = store.load();
const fb = st.feedback || [];
if (!fb.length) return fail("sin feedback registrado");
const por_categoria: any = {};
for (const f of fb) {
  por_categoria[f.categoria] = por_categoria[f.categoria] || { n: 0, suma: 0, textos: [] };
  por_categoria[f.categoria].n++;
  if (f.puntuacion) por_categoria[f.categoria].suma += f.puntuacion;
  por_categoria[f.categoria].textos.push(f.texto);
}
const resumen = Object.entries(por_categoria).map(([cat, d]: [string, any]) => ({ categoria: cat, n: d.n, promedio: d.suma ? Math.round((d.suma / d.n) * 10) / 10 : null, ejemplo: d.textos[0]?.slice(0, 80) }));
const scores = fb.filter((f) => f.puntuacion).map((f) => f.puntuacion);
return ok({ total: fb.length, promedio_global: scores.length ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10 : null, por_categoria: resumen });`,
      },
    ],
  },
  {
    id: "report-builder",
    title: "Report Builder",
    tagline: "Construye reportes markdown sección a sección con control de completitud",
    category: "Comunicación y Humano",
    pain: "Los reportes del agente son un muro de texto: sin estructura por secciones ni checklist de completitud.",
    persistent: true,
    tools: [
      {
        name: "add_section",
        desc: "Añade una sección al reporte activo: título y contenido markdown.",
        params: { reporte: { t: "string", d: "Nombre del reporte" }, titulo: { t: "string", d: "Título de la sección" }, contenido: { t: "string", d: "Contenido markdown" } },
        code: `const st = store.load();
st.reportes = st.reportes || {};
const r = st.reportes[reporte] = st.reportes[reporte] || { secciones: [], creado: new Date().toISOString() };
r.secciones.push({ titulo, contenido, ts: new Date().toISOString() });
store.save(st);
return ok({ reporte, secciones: r.secciones.length });`,
      },
      {
        name: "render",
        desc: "Renderiza el reporte completo a markdown: TOC + secciones + checklist de calidad.",
        params: { reporte: { t: "string", d: "Reporte a renderizar" } },
        code: `const st = store.load();
const r = st.reportes?.[reporte];
if (!r?.secciones?.length) return fail("reporte vacío o inexistente");
const toc = r.secciones.map((s: any, i: number) => (i + 1) + ". " + s.titulo).join("\\n");
const cuerpo = r.secciones.map((s: any) => "## " + s.titulo + "\\n\\n" + s.contenido).join("\\n\\n");
const checks = [
  r.secciones.some((s: any) => /resumen|conclusión|síntesis/i.test(s.titulo)) || null,
  r.secciones.some((s: any) => /datos|cifras|métricas|resultado/i.test(s.titulo)) || null,
  r.secciones.some((s: any) => /siguientes|acción|recomendaci|próximos/i.test(s.titulo)) || null,
];
const faltantes = ["sección de resumen/conclusión", "sección con datos/cifras", "sección de próximos pasos"].filter((_, i) => !checks[i]);
return ok({ markdown: "# Reporte: " + reporte + "\\n\\n**Generado:** " + new Date().toISOString() + "\\n\\n## Contenido\\n\\n" + toc + "\\n\\n---\\n\\n" + cuerpo, secciones: r.secciones.length, completitud: faltantes.length === 0 ? "completo" : "faltan: " + faltantes.join(", ") });`,
      },
      {
        name: "outline_check",
        desc: "Verifica que el reporte cubra el esqueleto estándar ejecutivo: contexto, hallazgos, cifras, riesgos y acción.",
        params: { reporte: { t: "string", d: "Reporte a chequear" } },
        code: `const st = store.load();
const r = st.reportes?.[reporte];
if (!r) return fail("reporte no existe");
const titulos = r.secciones.map((s: any) => s.titulo.toLowerCase()).join(" | ");
const requeridas = [
  ["contexto|introducción|antecedentes", "contexto"],
  ["hallazgo|análisis|observaciones", "hallazgos"],
  ["cifra|métrica|dato|número", "cifras"],
  ["riesgo|limitación|caveats", "riesgos"],
  ["acción|recomendaci|próximo|siguiente", "próximos pasos"],
];
const faltan = requeridas.filter(([pat]) => !new RegExp(pat).test(titulos)).map(([, n]) => n);
return ok({ completo: faltan.length === 0, faltan, secciones_actuales: r.secciones.map((s: any) => s.titulo) });`,
      },
    ],
  },
  {
    id: "digest-writer",
    title: "Digest Writer",
    tagline: "Dígestos ejecutivos: convierte una lista de items en resumen digerible priorizado",
    category: "Comunicación y Humano",
    pain: "50 actualizaciones no leídas = 0 información: falta un digest que priorice y agrupe.",
    tools: [
      {
        name: "digest",
        desc: "Genera un digest de items {titulo, detalle, prioridad, categoria}: agrupado por categoría, priorizado y con top-3 destacado.",
        params: { items: { t: "array", d: "Items {titulo, detalle, prioridad(alta/media/baja), categoria}" }, titulo_digest: { t: "string", d: "Título del digest", opt: true, def: "Digest" } },
        code: `const list = Array.isArray(items) ? items : [];
if (!list.length) return fail("sin items");
const por_cat: any = {};
for (const it of list) { const c = it.categoria || "general"; por_cat[c] = (por_cat[c] || []).concat(it); }
const orden: any = { alta: 0, media: 1, baja: 2 };
const top3 = [...list].sort((a: any, b: any) => (orden[a.prioridad] ?? 1) - (orden[b.prioridad] ?? 1)).slice(0, 3);
const lineas: string[] = ["# " + (titulo_digest || "Digest"), "", "**" + new Date().toISOString().slice(0, 10) + " — " + list.length + " items**", "", "## Top prioridades"];
for (const t of top3) lineas.push("- **" + (t.titulo || "sin título") + "** (" + (t.prioridad || "media") + "): " + String(t.detalle || "").slice(0, 120));
for (const [cat, items_cat] of Object.entries(por_cat as Record<string, any[]>)) {
  lineas.push("", "## " + cat + " (" + items_cat.length + ")");
  for (const it of items_cat) lineas.push("- " + (it.titulo || "") + ": " + String(it.detalle || "").slice(0, 100));
}
return ok({ total_items: list.length, categorias: Object.keys(por_cat).length, digest: lineas.join("\\n") });`,
      },
      {
        name: "escalation_digest",
        desc: "Dígesto de escalación: solo lo que requiere ACCIÓN humana hoy, con deadline.",
        params: { items: { t: "array", d: "Items {titulo, detalle, vence?}" } },
        code: `const list = Array.isArray(items) ? items : [];
const ahora = Date.now();
const con_deadline = list.filter((i: any) => i.vence);
const vencidos = con_deadline.filter((i: any) => new Date(i.vence).getTime() < ahora);
const lineas: string[] = ["# ⚠ Escalación: acción humana requerida", ""];
if (vencidos.length) { lineas.push("**VENCIDOS:**"); for (const v of vencidos) lineas.push("- 🚨 " + v.titulo + " (venció " + v.vence + ")"); lineas.push(""); }
const proximos = con_deadline.filter((i: any) => { const t = new Date(i.vence).getTime(); return t >= ahora && t - ahora < 86400000; });
if (proximos.length) { lineas.push("**Vencen hoy:**"); for (const p of proximos) lineas.push("- " + p.titulo + " → " + p.vence); }
const sin_deadline = list.filter((i: any) => !i.vence).slice(0, 5);
if (sin_deadline.length) { lineas.push("", "**Sin deadline asignado:**"); for (const s of sin_deadline) lineas.push("- " + s.titulo + " (asigna deadline)"); }
return ok({ items_totales: list.length, vencidos: vencidos.length, vencen_hoy: proximos.length, digest: lineas.join("\\n") });`,
      },
    ],
  },
  {
    id: "locale-helper",
    title: "Locale Helper",
    tagline: "Glossario y reglas de localización ES/EN/FR: formatos y consistencia terminológica",
    category: "Comunicación y Humano",
    pain: "El agente mezcla formatos de fecha/número entre idiomas y traduce términos clave inconsistentemente: el glossario vive en ninguna parte.",
    persistent: true,
    tools: [
      {
        name: "add_glossary",
        desc: "Añade términos al glossario multilingüe (es/en/fr) para traducciones consistentes.",
        params: { es: { t: "string", d: "Término en español" }, en: { t: "string", d: "En inglés", opt: true }, fr: { t: "string", d: "En francés", opt: true }, nota: { t: "string", d: "Nota de uso", opt: true } },
        code: `const st = store.load();
st.glossario = st.glossario || [];
st.glossario.push({ es, en: en || "", fr: fr || "", nota: nota || "" });
store.save(st);
return ok({ terminos: st.glossario.length });`,
      },
      {
        name: "lookup_glossary",
        desc: "Busca un término en el glossario y devuelve sus equivalentes + nota de uso.",
        params: { termino: { t: "string", d: "Término (cualquier idioma)" } },
        code: `const st = store.load();
const t = termino.toLowerCase().trim();
const hit = (st.glossario || []).find((g: any) => [g.es, g.en, g.fr].some((v) => String(v).toLowerCase() === t));
if (!hit) return ok({ encontrado: false, sugerencia: "agrégalo con add_glossary para consistencia futura" });
return ok({ encontrado: true, ...hit });`,
      },
      {
        name: "locale_rules",
        desc: "Reglas de formato por locale: fechas, números, moneda y unidades (es-EC, es-ES, en-US, fr-CA, fr-FR).",
        params: { locale: { t: "enum", values: ["es-EC", "es-ES", "es-MX", "en-US", "en-GB", "fr-CA", "fr-FR"], d: "Locale" }, ejemplo_fecha: { t: "string", d: "Fecha ISO a formatear", opt: true, def: "2026-09-10" } },
        code: `const reglas: any = {
  "es-EC": { fecha: "10/09/2026", fecha_larga: "10 de septiembre de 2026", numero: "1.234,56", moneda: "$ 1.234,56 (USD)", decimal: ",", miles: "." },
  "es-ES": { fecha: "10/09/2026", fecha_larga: "10 de septiembre de 2026", numero: "1.234,56", moneda: "1.234,56 €", decimal: ",", miles: "." },
  "es-MX": { fecha: "10/09/2026", fecha_larga: "10 de septiembre de 2026", numero: "1,234.56", moneda: "$1,234.56 (MXN)", decimal: ".", miles: "," },
  "en-US": { fecha: "09/10/2026", fecha_larga: "September 10, 2026", numero: "1,234.56", moneda: "$1,234.56", decimal: ".", miles: "," },
  "en-GB": { fecha: "10/09/2026", fecha_larga: "10 September 2026", numero: "1,234.56", moneda: "£1,234.56", decimal: ".", miles: "," },
  "fr-CA": { fecha: "2026-09-10", fecha_larga: "10 septembre 2026", numero: "1 234,56", moneda: "1 234,56 $ CAD", decimal: ",", miles: " " },
  "fr-FR": { fecha: "10/09/2026", fecha_larga: "10 septembre 2026", numero: "1 234,56", moneda: "1 234,56 €", decimal: ",", miles: " " },
};
const r = reglas[locale] || reglas["es-EC"];
return ok({ locale, ...r, ejemplo: "formato corto: " + r.fecha + " | largo: " + r.fecha_larga });`,
      },
    ],
  },
  {
    id: "tone-adjuster",
    title: "Tone Adjuster",
    tagline: "Analiza y ajusta el tono del texto del agente: formalidad, cortesía y claridad",
    category: "Comunicación y Humano",
    pain: "El agente responde con tono inadecuado (demasiado seco para clientes, demasiado efusivo para técnicos): nadie mide el tono.",
    tools: [
      {
        name: "analyze_tone",
        desc: "Analiza el tono de un texto: formalidad (léxico), cortesía, asertividad, longitud de oraciones y jerga técnica.",
        params: { texto: { t: "string", d: "Texto a analizar" } },
        code: `const t = String(texto);
const palabras = t.split(/\\s+/).filter(Boolean);
const oraciones = t.split(/[.!?]+/).filter((s) => s.trim());
const formal = ["por lo tanto", "asimismo", "en consecuencia", "sírvase", "agradezco", "cordialmente", "estimado", "adjunto", "conforme", "de acuerdo con"];
const informal = ["ok", "dale", "ya quoi", "bueno", "o sea", "en plan", "tío", "chevere", "bacán", "ni modo"];
const cortes = ["por favor", "gracias", "podrías", "te agradecería", "cuando puedas", "disculpa", "permiso"];
const jerga = ["deploy", "endpoint", "payload", "rollback", "k8s", "latencia", "throughput", "idempotente", "schema", "parse"];
const contar = (lista: string[]) => lista.filter((f) => t.toLowerCase().includes(f)).length;
const f = contar(formal), inf = contar(informal), c = contar(cortes), j = contar(jerga);
const prom_oracion = oraciones.length ? Math.round(palabras.length / oraciones.length) : 0;
const formalidad = f > inf ? "formal" : inf > f ? "informal" : "neutral";
return ok({ formalidad, cortesia: c > 0 ? "presente" : "ausente", jerga_tecnica: j, palabras, prom_palabras_por_oracion: prom_oracion, exhortacion: prom_oracion > 25 ? "oraciones largas: partir para claridad" : "ok", lecturabilidad: prom_oracion < 15 ? "alta" : prom_oracion < 25 ? "media" : "baja" });`,
      },
      {
        name: "adjust_hints",
        desc: "Devuelve instrucciones concretas para ajustar el tono al objetivo deseado (profesional, cálido, técnico, directo).",
        params: { tono_objetivo: { t: "enum", values: ["profesional", "calido", "tecnico", "directo", "empatico"], d: "Tono deseado" }, texto: { t: "string", d: "Texto actual", opt: true } },
        code: `const guias: any = {
  profesional: ["elimina muletillas e informalidades", "usa tratamientos formales (usted/estimado)", "cifras y datos concretos", "cierre con acción clara"],
  calido: ["saluda por nombre si lo conoces", "agradecer antes de pedir", "suaviza imperativos: 'podrías revisar' vs 'revisa'", "emojis solo si el canal los usa"],
  tecnico: ["precisión sobre prosa", "nombra versiones/ids exactos", "incluye comandos/logs textuales", "evita adjetivos calificativos"],
  directo: ["una idea por oración", "la petición en la primera línea", "elimina preámbulos", "bullets para listas"],
  empatico: ["reconoce el problema antes de proponer", "evita 'simplemente' y 'solo tienes que'", "ofrece 2 caminos con trade-offs", "cierra con disposición de ayuda"],
};
const hints = guias[tono_objetivo] || guias.profesional;
return ok({ tono_objetivo, hints: hints.map((h: string) => "- " + h) });`,
      },
    ],
  },
  {
    id: "handoff-notes",
    title: "Handoff Notes",
    tagline: "Notas de traspaso entre agentes/turnos: contexto, estado y pendientes en plantilla estandarizada",
    category: "Comunicación y Humano",
    pain: "El traspaso entre agentes (o turnos) pierde contexto crítico: cada receptor re-descubre todo.",
    persistent: true,
    tools: [
      {
        name: "create_handoff",
        desc: "Crea una nota de traspaso estandarizada: objetivo, estado actual, pendientes, riesgos, contexto esencial y contactos.",
        params: { tarea: { t: "string", d: "Tarea que se traspasa" }, objetivo: { t: "string", d: "Objetivo" }, estado_actual: { t: "string", d: "Dónde quedó todo" }, pendientes: { t: "array", d: "Pendientes concretos" }, riesgos: { t: "array", d: "Riesgos conocidos", opt: true }, contexto: { t: "string", d: "Contexto esencial (links, decisions)", opt: true } },
        code: `const st = store.load();
st.handoffs = st.handoffs || [];
const h = { id: "HO" + (st.handoffs.length + 1), tarea, objetivo, estado_actual, pendientes: Array.isArray(pendientes) ? pendientes : [], riesgos: Array.isArray(riesgos) ? riesgos : [], contexto: contexto || "", creado: new Date().toISOString() };
st.handoffs.push(h);
store.save(st);
return ok({ handoff_id: h.id });`,
      },
      {
        name: "render_handoff",
        desc: "Renderiza la nota de traspaso en markdown listo para pegar al receptor.",
        params: { id: { t: "string", d: "ID del handoff" } },
        code: `const st = store.load();
const h = (st.handoffs || []).find((x) => x.id === id);
if (!h) return fail("handoff no existe");
const md = [
  "# Traspaso: " + h.tarea, "",
  "**Objetivo:** " + h.objetivo, "",
  "## Estado actual", h.estado_actual, "",
  "## Pendientes", ...(h.pendientes.length ? h.pendientes.map((p: string) => "- [ ] " + p) : ["- nada pendiente"]), "",
  h.riesgos.length ? "## Riesgos" : "", ...(h.riesgos || []).map((r: string) => "- ⚠ " + r),
  h.contexto ? "## Contexto esencial" : "", h.contexto || "",
  "", "---", "*Creado: " + h.creado + "*",
].filter((l) => l !== "").join("\\n");
return ok({ markdown: md, pendientes: h.pendientes.length });`,
      },
      {
        name: "completeness_check",
        desc: "Verifica completitud del traspaso: ¿el receptor puede continuar sin preguntar nada?",
        params: { id: { t: "string", d: "ID del handoff" } },
        code: `const st = store.load();
const h = (st.handoffs || []).find((x) => x.id === id);
if (!h) return fail("handoff no existe");
const faltas: string[] = [];
if (!h.objetivo || h.objetivo.length < 20) faltas.push("objetivo débil: el receptor no sabrá para qué");
if (!h.estado_actual || h.estado_actual.length < 40) faltas.push("estado actual insuficiente");
if (!h.pendientes.length) faltas.push("sin pendientes: ¿de verdad no queda nada?");
if (!h.contexto) faltas.push("sin contexto esencial: agrega links/decisiones");
return ok({ completo: faltas.length === 0, faltas, veredicto: faltas.length === 0 ? "listo para traspasar" : "completa antes de traspasar" });`,
      },
    ],
  },
  {
    id: "meeting-notes",
    title: "Meeting Notes",
    tagline: "Estructura notas de reunión: decisiones, acciones con dueño y temas aparcados",
    category: "Comunicación y Humano",
    pain: "Las notas de reunión son ríos de prosa: decisiones y acciones se pierden sin estructura.",
    tools: [
      {
        name: "structure_notes",
        desc: "Estructura notas crudas de reunión: detecta decisiones, action items (con dueño si aparece) y temas aparcados (parking lot).",
        params: { notas: { t: "string", d: "Notas crudas de la reunión" }, reunion: { t: "string", d: "Título de la reunión", opt: true, def: "Reunión" } },
        code: `const t = String(notas);
const oraciones = t.split(/[\\n.!?]+/).map((s) => s.trim()).filter((s) => s.length > 5);
const decisiones = oraciones.filter((o) => /decidimos|acordamos|se aprobó|aprobado|queda definido|vamos con|elegimos|se resolvió/i.test(o));
const acciones = oraciones.filter((o) => /va a |hará|se encarga|queda a cargo|action item|to.?do|antes del|para el viernes|para la próxima|enviar|preparar/i.test(o));
const parking = oraciones.filter((o) => /lo vemos|más adelante|no es prioritario|lo dejamos|pendiente de|tablero|para otra/i.test(o));
const dueños = acciones.map((a) => { const m = a.match(/\\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\\s+(?:va a|hará|se encarga|queda)/); return m ? m[1] : null; });
return ok({ reunion: reunion || "Reunión", total_oraciones: oraciones.length, decisiones, acciones: acciones.map((a, i) => ({ accion: a, dueno: dueños[i] || "sin dueño asignado" })), parking_lot: parking, proximos_pasos: acciones.length ? "asigna deadlines a cada acción" : "sin acciones detectadas: ¿fue una reunión solo informativa?" });`,
      },
      {
        name: "action_items",
        desc: "Extrae SOLO las action items con su formato estandarizado: qué, quién, cuándo (si aparece).",
        params: { notas: { t: "string", d: "Notas" } },
        code: `const t = String(notas);
const lineas = t.split(/[\\n;]+/).map((s) => s.trim()).filter(Boolean);
const items: any[] = [];
for (const l of lineas) {
  if (/^(?:-|\\*|\\d+[.)])\\s+/.test(l) || /va a |hará|debe|action|todo|pendiente|encarg/i.test(l)) {
    const dueño = (l.match(/\\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\\b/) || [])[1] || "sin dueño";
    const fecha = (l.match(/\\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo|mañana|pasado mañana|\\d{1,2}[/-]\\d{1,2}|semana que viene|el \\d+\\b)/i) || [])[0] || "sin fecha";
    items.push({ que: l.replace(/^[-*\\d.)\\s]+/, ""), quien: dueño, cuando: fecha });
  }
}
return ok({ total: items.length, items: items.slice(0, 30), sin_dueño: items.filter((i) => i.quien === "sin dueño").length });`,
      },
    ],
  },
];

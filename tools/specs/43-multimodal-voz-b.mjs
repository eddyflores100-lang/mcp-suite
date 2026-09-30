// ═══ CATEGORÍA: Dolores FUTUROS · Multimodal & Voz (B) ═══
// Evidencia: el ritmo del habla sintética (pausas, énfasis, velocidad) decide
// la comprensión; los lotes de imágenes llegan sin metadatos; y los captions
// desalineados del transcript hacen inútil la referencia temporal.
export default [
  {
    id: "speech-pacing",
    title: "Speech Pacing",
    tagline: "Planifica el ritmo del habla del agente: pausas donde hay ideas, énfasis en los datos y velocidad por complejidad",
    category: "Multimodal & Voz",
    pain: "El agente lee a velocidad uniforme: dispara las cifras críticas, no pausa entre ideas opuestas y el usuario no retiene nada. El pacing no es un extra de TTS: es la mitad de la comprensión oral.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/speech-pacing/. Analiza el texto (densidad de cifras, longitud de cláusulas, contraste de ideas) y produce un plan de pausas con puntos SSML (break strengths) y velocidad por segmento.",
    tools: [
      {
        name: "analyze_text",
        desc: "Analiza el texto a hablar: densidad de datos, complejidad y puntos naturales de pausa.",
        params: { texto: { t: "string", d: "Texto que el agente va a decir" } },
        code: `const oraciones = texto.split(/(?<=[.!?;:])\\s+/).filter(s => s.trim());
if (!oraciones.length) return fail("texto vacío");
const analisis = oraciones.map(o => {
  const palabras = o.split(/\\s+/).filter(Boolean);
  const cifras = (o.match(/\\d+([.,]\\d+)?%?/g) || []).length;
  const esLista = /,| y | o |;/.test(o) && palabras.length > 12;
  const contraste = /\\b(pero|sin embargo|aunque|no obstante|en cambio|mientras que)\\b/i.test(o);
  const esCifraCritica = cifras >= 2;
  return { texto: o.slice(0, 70), palabras: palabras.length, cifras, es_lista: esLista, tiene_contraste: contraste, complejidad: Number(((cifras * 2 + palabras.length / 8 + (esLista ? 1 : 0)).toFixed(1))) };
});
const totalPalabras = analisis.reduce((a, x) => a + x.palabras, 0);
const totalCifras = analisis.reduce((a, x) => a + x.cifras, 0);
return ok({ oraciones: analisis.length, palabras: totalPalabras, cifras: totalCifras, densidad_de_datos: Number((totalCifras / Math.max(analisis.length, 1)).toFixed(2)) + " por oración", analisis, veredicto: totalCifras / Math.max(analisis.length, 1) > 1.5 ? "texto DENSO en cifras: sin pacing el usuario no retendrá ninguna" : "texto manejable" });`,
      },
      {
        name: "plan_pacing",
        desc: "Genera el plan de ritmo: pausas (break SSML), velocidad y énfasis por segmento.",
        params: { texto: { t: "string", d: "Texto a decir" }, velocidad_base: { t: "number", d: "Velocidad base (1.0 = normal)", opt: true, def: 1 } },
        code: `const oraciones = texto.split(/(?<=[.!?;:])\\s+/).filter(s => s.trim());
if (!oraciones.length) return fail("texto vacío");
const plan = oraciones.map((o, i) => {
  const palabras = o.split(/\\s+/).filter(Boolean);
  const cifras = (o.match(/\\d+([.,]\\d+)?%?/g) || []).length;
  const contraste = /\\b(pero|sin embargo|aunque|no obstante|en cambio)\\b/i.test(o);
  const esLista = (o.match(/,/g) || []).length >= 2;
  let velocidad = velocidad_base;
  let pausa_despues = "corta (300ms)";
  let enfasis = [];
  if (cifras >= 2) { velocidad = Number((velocidad_base * 0.85).toFixed(2)); pausa_despues = "larga (700ms): deja digerir las cifras"; enfasis = (o.match(/\\d+([.,]\\d+)?%?/g) || []).slice(0, 3); }
  else if (contraste) { pausa_despues = "media (500ms): el contraste exige asiento"; enfasis = [o.match(/\\b[A-Za-zÁÉÍÓÚáéíóúñ]+\\b/g)?.slice(0, 1)?.[0] || ""]; }
  else if (esLista) { pausa_despues = "media (450ms)"; }
  else if (palabras.length > 25) { velocidad = Number((velocidad_base * 0.95).toFixed(2)); pausa_despues = "media (400ms): oración larga, aire al final"; }
  return { orden: i + 1, segmento: o.slice(0, 60), palabras: palabras.length, velocidad, pausa_despues, enfasis_en: enfasis.filter(Boolean) };
});
const duracionEstimada = plan.reduce((a, p) => a + p.palabras / (2.5 * p.velocidad), 0);
return ok({ segmentos: plan.length, plan, duracion_estimada_seg: Number(duracionEstimada.toFixed(1)), total_pausas: plan.length + " pausas estructurales", reglas_aplicadas: "cifras ralentizan 15% y pausan largo · contrastes pausan medio · listas separan elementos · largas respiran al final" });`,
      },
      {
        name: "ssml_hints",
        desc: "Convierte el plan en pistas SSML concretas (breaks, prosody, emphasis) para tu motor TTS.",
        params: { texto: { t: "string", d: "Texto a decir" } },
        code: `const oraciones = texto.split(/(?<=[.!?;:])\\s+/).filter(s => s.trim());
if (!oraciones.length) return fail("texto vacío");
const ms = { corta: 300, media: 500, larga: 700 };
let ssml = "<speak>";
oraciones.forEach(o => {
  const cifras = (o.match(/\\d+([.,]\\d+)?%?/g) || []).length;
  const contraste = /\\b(pero|sin embargo|aunque|no obstante|en cambio)\\b/i.test(o);
  let abre = "", cierra = "";
  if (cifras >= 2) { abre = '<prosody rate="85%">'; cierra = "</prosody>"; }
  else if (o.split(/\\s+/).length > 25) { abre = '<prosody rate="95%">'; cierra = "</prosody>"; }
  let cuerpo = o;
  const enfatizables = (o.match(/\\d+([.,]\\d+)?%?/g) || []).slice(0, 2);
  enfatizables.forEach(c => { cuerpo = cuerpo.replace(c, '<emphasis level="moderate">' + c + "</emphasis>"); });
  ssml += abre + cuerpo + cierra;
  const pausa = cifras >= 2 ? ms.larga : contraste ? ms.media : ms.corta;
  ssml += '<break time="' + pausa + 'ms"/>';
});
ssml += "</speak>";
return ok({ ssml, longitud: ssml.length, usable_en: "motores compatibles SSML (Polly, Azure, Google, ElevenLabs parciales)", nota: "si tu TTS no soporta SSML, usa los milisegundos de plan_pacing como silencios insertados manualmente" });`,
      },
      {
        name: "estimate_duration",
        desc: "Estima duración del habla con velocidad y pausas planificadas (para timeouts y UX).",
        params: { texto: { t: "string", d: "Texto" }, velocidad: { t: "number", d: "Velocidad (1 = normal)", opt: true, def: 1 }, incluir_pausas: { t: "boolean", d: "Sumar las pausas estructurales", opt: true, def: true } },
        code: `const oraciones = texto.split(/(?<=[.!?;:])\\s+/).filter(s => s.trim());
if (!oraciones.length) return fail("texto vacío");
let seg = 0, pausas = 0;
oraciones.forEach(o => {
  const palabras = o.split(/\\s+/).filter(Boolean).length;
  const cifras = (o.match(/\\d+([.,]\\d+)?%?/g) || []).length;
  const v = cifras >= 2 ? velocidad * 0.85 : velocidad;
  seg += palabras / (2.5 * v);
  if (incluir_pausas) pausas += cifras >= 2 ? 0.7 : 0.35;
});
const total = seg + pausas;
return ok({ oraciones: oraciones.length, habla_seg: Number(seg.toFixed(1)), pausas_seg: Number(pausas.toFixed(1)), total_seg: Number(total.toFixed(1)), total_min: Number((total / 60).toFixed(2)), umbral_ux: total > 90 ? "MÁS DE 90 SEGUNDOS de monólogo: el usuario medio abandona: divide en turnos con confirmación" : total > 40 ? "40-90s: arriesgado, considera punto de confirmación a mitad" : "duración segura para un turno de voz" });`,
      },
    ],
  },
  {
    id: "image-batch-tagger",
    title: "Image Batch Tagger",
    tagline: "Metadatos obligatorios para lotes de imágenes: procedencia, contenido, frescura y decisión de uso",
    category: "Multimodal & Voz",
    pain: "El agente recibe 20 imágenes sueltas sin origen ni fecha: las mete todas al contexto, mezcla capturas de hace un año con las de hoy y no puede justificar de dónde salió la que citó después.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/image-batch-tagger/. Registro de lotes con metadatos por imagen (origen, fecha, contenido inferido, sensibilidad); selección por etiquetas y control de frescura antes de adjuntar al contexto.",
    tools: [
      {
        name: "register_batch",
        desc: "Registra un lote de imágenes con metadatos mínimos por imagen.",
        params: { lote: { t: "string", d: "Nombre del lote" }, origen: { t: "string", d: "Procedencia (URL, app, usuario, carpeta)" }, imagenes: { t: "array", d: "Imágenes {id, contenido?: descripción corta, tomada_ts?: fecha}" } },
        code: `const st = store.load();
st.lotes = st.lotes || {};
if (st.lotes[lote]) return fail("lote ya registrado: " + lote);
const limpias = (imagenes || []).filter(i => i && i.id).map(i => ({ id: String(i.id), contenido: String(i.contenido || "sin describir"), tomada_ts: i.tomada_ts ? String(i.tomada_ts) : null, registrada: new Date().toISOString(), usada_en_contexto: false }));
if (!limpias.length) return fail("sin imágenes con id");
st.lotes[lote] = { lote, origen, imagenes: limpias, registrado: new Date().toISOString() };
store.save(st);
return ok({ lote, imagenes: limpias.length, origen, sin_descripcion: limpias.filter(i => i.contenido === "sin describir").length + " sin describir de contenido: descríbelas antes de usarlas" });`,
      },
      {
        name: "tag_images",
        desc: "Etiqueta imágenes del lote (contenido, sensibilidad, idoneidad de uso).",
        params: { lote: { t: "string", d: "Lote" }, tags: { t: "array", d: "Etiquetas a aplicar {id, contenido?, sensibilidad?: publica|interna|confidencial, apta_para?: contexto}" } },
        code: `const st = store.load();
const l = (st.lotes || {})[lote];
if (!l) return fail("lote no encontrado: " + lote);
let aplicadas = 0, noEncontradas = [];
(tags || []).forEach(t => {
  const img = l.imagenes.find(i => i.id === String(t.id));
  if (!img) { noEncontradas.push(String(t.id)); return; }
  if (t.contenido) img.contenido = String(t.contenido).slice(0, 120);
  if (t.sensibilidad) img.sensibilidad = t.sensibilidad;
  if (t.apta_para) img.apta_para = String(t.apta_para);
  aplicadas++;
});
store.save(st);
return ok({ lote, etiquetas_aplicadas: aplicadas, ids_no_encontrados: noEncontradas, por_sensibilidad: { publica: l.imagenes.filter(i => i.sensibilidad === "publica").length, interna: l.imagenes.filter(i => i.sensibilidad === "interna").length, confidencial: l.imagenes.filter(i => i.sensibilidad === "confidencial").length, sin_clasificar: l.imagenes.filter(i => !i.sensibilidad).length }, aviso: l.imagenes.filter(i => !i.sensibilidad).length > l.imagenes.length / 2 ? "más de la mitad sin clasificar de sensibilidad: clasifica antes de adjuntar nada al contexto" : null });`,
      },
      {
        name: "select_by_tag",
        desc: "Selecciona imágenes del lote por etiquetas y frescura para adjuntar al contexto.",
        params: { lote: { t: "string", d: "Lote" }, requerir_contenido: { t: "string", d: "Filtrar por texto en contenido", opt: true }, max_frescura_dias: { t: "number", d: "Antigüedad máxima aceptable (0 = sin límite)", opt: true, def: 0 }, excluir_sensibilidad: { t: "array", d: "Sensibilidades a excluir", opt: true } },
        code: `const st = store.load();
const l = (st.lotes || {})[lote];
if (!l) return fail("lote no encontrado");
let candidatas = l.imagenes.slice();
if (requerir_contenido) candidatas = candidatas.filter(i => i.contenido.toLowerCase().includes(requerir_contenido.toLowerCase()));
if (excluir_sensibilidad && excluir_sensibilidad.length) candidatas = candidatas.filter(i => !excluir_sensibilidad.includes(i.sensibilidad || ""));
let rechazadas_por_frescura = [];
if (max_frescura_dias > 0) {
  candidatas = candidatas.filter(i => {
    if (!i.tomada_ts) return true;
    const dias = (Date.now() - new Date(i.tomada_ts).getTime()) / 86400000;
    if (dias > max_frescura_dias) { rechazadas_por_frescura.push({ id: i.id, dias: Number(dias.toFixed(0)) }); return false; }
    return true;
  });
}
return ok({ lote, seleccionadas: candidatas.map(i => ({ id: i.id, contenido: i.contenido, sensibilidad: i.sensibilidad || "sin clasificar", tomada: i.tomada_ts || "desconocida" })), rechazadas_por_frescura, advertencia: candidatas.some(i => !i.sensibilidad) ? "hay seleccionadas SIN sensibilidad clasificada: clasifícalas o exclúyelas" : null, origen_para_cita: l.origen });`,
      },
      {
        name: "batch_report",
        desc: "Informe del lote: cobertura de metadatos, frescura y qué se ha usado ya en contexto.",
        params: { lote: { t: "string", d: "Lote" } },
        code: `const st = store.load();
const l = (st.lotes || {})[lote];
if (!l) return fail("lote no encontrado");
const imgs = l.imagenes;
const conFecha = imgs.filter(i => i.tomada_ts);
const edades = conFecha.map(i => (Date.now() - new Date(i.tomada_ts).getTime()) / 86400000);
return ok({ lote, origen: l.origen, imagenes: imgs.length, cobertura_metadatos: { con_contenido: imgs.filter(i => i.contenido !== "sin describir").length + "/" + imgs.length, con_sensibilidad: imgs.filter(i => i.sensibilidad).length + "/" + imgs.length, con_fecha: conFecha.length + "/" + imgs.length }, frescura: conFecha.length ? { media_dias: Number((edades.reduce((a, b) => a + b, 0) / edades.length).toFixed(1)), maxima_dias: Number(Math.max(...edades).toFixed(1)) } : "sin fechas: no puedes confiar en la frescura", usadas_en_contexto: imgs.filter(i => i.usada_en_contexto).length, nunca_usadas: imgs.filter(i => !i.usada_en_contexto).map(i => i.id), recomendacion: imgs.filter(i => !i.sensibilidad).length > 0 ? "completa la clasificación de sensibilidad antes del próximo uso" : "lote en orden" });`,
      },
    ],
  },
  {
    id: "caption-aligner",
    title: "Caption Aligner",
    tagline: "Alinea transcripción y subtítulos por tiempo: cobertura, solapes y huecos detectados antes de confiar en ellos",
    category: "Multimodal & Voz",
    pain: "El transcript dice 'a las 14:30' y el caption correspondiente empieza 40 segundos tarde: el agente cita minutos exactos de un material desalineado y la referencia temporal es pura ficción.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/caption-aligner/. Ingiere segmentos de subtítulo (start/end/texto) y oraciones del transcript; calcula solapes, huecos de cobertura y deriva acumulada; propone offsets de corrección.",
    tools: [
      {
        name: "ingest_segments",
        desc: "Ingiere los segmentos de subtítulo con sus tiempos.",
        params: { material: { t: "string", d: "Nombre del material (video/clase/reunión)" }, segmentos: { t: "array", d: "Segmentos {start: segundos, end: segundos, texto}" }, duracion_total_seg: { t: "number", d: "Duración del material", opt: true } },
        code: `const st = store.load();
st.materiales = st.materiales || {};
const limpios = (segmentos || []).filter(s => typeof s.start === "number" && typeof s.end === "number" && s.texto).map(s => ({ start: s.start, end: s.end, texto: String(s.texto).trim() })).sort((a, b) => a.start - b.start);
if (!limpios.length) return fail("sin segmentos válidos {start, end, texto}");
const solapes = [];
for (let i = 1; i < limpios.length; i++) {
  if (limpios[i].start < limpios[i - 1].end - 0.05) solapes.push({ entre: [i, i + 1], segundos: Number((limpios[i - 1].end - limpios[i].start).toFixed(2)) });
}
const invertidos = limpios.filter((s, i) => i > 0 && s.start < limpios[i - 1].start).length;
st.materiales[material] = { material, segmentos: limpios, duracion: duracion_total_seg || limpios[limpios.length - 1].end, solapes, ingerido: new Date().toISOString() };
store.save(st);
return ok({ material, segmentos: limpios.length, duracion_seg: st.materiales[material].duracion, solapes_detectados: solapes.length, segmentos_invertidos: invertidos, aviso: solapes.length > limpios.length * 0.2 ? "más del 20% de segmentos se solapan: la fuente de captions es sucia, límpiala antes de alinear" : "ingesta razonable" });`,
      },
      {
        name: "coverage_check",
        desc: "Cobertura temporal: qué zonas del material no tienen caption (huecos) y cuánto duran.",
        params: { material: { t: "string", d: "Material" } },
        code: `const st = store.load();
const m = (st.materiales || {})[material];
if (!m) return fail("material no encontrado: ingiere con ingest_segments");
const huecos = [];
let cursor = 0;
m.segmentos.forEach(s => {
  if (s.start > cursor + 1.5) huecos.push({ desde: Number(cursor.toFixed(1)), hasta: Number(s.start.toFixed(1)), duracion: Number((s.start - cursor).toFixed(1)) });
  cursor = Math.max(cursor, s.end);
});
if (m.duracion > cursor + 2) huecos.push({ desde: Number(cursor.toFixed(1)), hasta: Number(m.duracion.toFixed(1)), duracion: Number((m.duracion - cursor).toFixed(1)) });
const cobertura = Number((m.segmentos.reduce((a, s) => a + (s.end - s.start), 0) / m.duracion * 100).toFixed(1));
return ok({ material, duracion_total: Number(m.duracion.toFixed(1)), cobertura_pct: cobertura + "%", huecos: huecos.sort((a, b) => b.duracion - a.duracion), zona_mas_oscura: huecos[0] || null, veredicto: cobertura < 85 ? "cobertura POBRE: el " + Number((100 - cobertura).toFixed(0)) + "% del material no tiene caption: NO cites tiempos de zonas sin caption" : cobertura < 95 ? "cobertura aceptable con huecos acotados" : "cobertura completa" });`,
      },
      {
        name: "align_transcript",
        desc: "Alinea oraciones del transcript con los segmentos por similitud textual y devuelve el mapeo con confianza.",
        params: { material: { t: "string", d: "Material" }, oraciones: { t: "array", d: "Oraciones del transcript (texto, en orden)" } },
        code: `const st = store.load();
const m = (st.materiales || {})[material];
if (!m) return fail("material no encontrado");
const ords = (oraciones || []).map(String).filter(o => o.trim());
if (!ords.length) return fail("sin oraciones");
const tokens = (x) => new Set(x.toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 2));
const alineadas = ords.map((o, idx) => {
  const to = tokens(o);
  let mejor = null;
  m.segmentos.forEach((s, si) => {
    const ts = tokens(s.texto);
    const inter = [...to].filter(w => ts.has(w)).length;
    const sim = inter / Math.max(to.size, 1);
    if (!mejor || sim > mejor.sim) mejor = { segmento_idx: si, start: s.start, end: s.end, sim };
  });
  return { oracion_idx: idx, oracion: o.slice(0, 60), segmento: mejor ? mejor.segmento_idx + 1 : null, tiempo: mejor ? { desde: Number(mejor.start.toFixed(1)), hasta: Number(mejor.end.toFixed(1)) } : null, confianza: mejor ? (mejor.sim >= 0.7 ? "ALTA" : mejor.sim >= 0.4 ? "MEDIA" : "BAJA") : "NINGUNA", similitud: mejor ? Number(mejor.sim.toFixed(2)) : 0 };
});
const monotono = alineadas.every((a, i) => i === 0 || !a.tiempo || !alineadas[i - 1].tiempo || a.tiempo.desde >= alineacionesPrevias(alineadas, i));
function alineacionesPrevias(arr, i) { return arr[i - 1].tiempo; }
const bajas = alineadas.filter(a => a.confianza === "BAJA" || a.confianza === "NINGUNA");
return ok({ material, oraciones_alineadas: alineadas.filter(a => a.tiempo).length, alineacion: alineadas, orden_temporal_coherente: monotono, confianzas: { alta: alineadas.filter(a => a.confianza === "ALTA").length, media: alineadas.filter(a => a.confianza === "MEDIA").length, baja_baja: bajas.length }, aviso: bajas.length > ords.length * 0.25 ? "más del 25% de oraciones alinean MAL: el transcript y los captions cuentan historias distintas, no mezcles sus tiempos" : null });`,
      },
      {
        name: "suggest_offset",
        desc: "Si todo alinea pero desplazado constante, calcula el offset de corrección por puntos de anclaje.",
        params: { material: { t: "string", d: "Material" }, anclajes: { t: "array", d: "Puntos verificados {texto_cita, tiempo_real_seg}" } },
        code: `const st = store.load();
const m = (st.materiales || {})[material];
if (!m) return fail("material no encontrado");
const tokens = (x) => new Set(x.toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 2));
const deltas = [];
(anclajes || []).forEach(a => {
  const to = tokens(String(a.texto_cita || ""));
  let mejor = null;
  m.segmentos.forEach(s => {
    const ts = tokens(s.texto);
    const sim = [...to].filter(w => ts.has(w)).length / Math.max(to.size, 1);
    if (!mejor || sim > mejor.sim) mejor = { sim, start: s.start };
  });
  if (mejor && mejor.sim >= 0.5) deltas.push({ cita: String(a.texto_cita).slice(0, 40), caption_dice: Number(mejor.start.toFixed(1)), tiempo_real: Number(a.tiempo_real_seg), delta_seg: Number((a.tiempo_real_seg - mejor.start).toFixed(2)) });
});
if (deltas.length < 2) return fail("necesitas al menos 2 anclajes con similitud suficiente; aportados válidos: " + deltas.length);
const media = deltas.reduce((s, d) => s + d.delta_seg, 0) / deltas.length;
const dispersion = Math.max(...deltas.map(d => Math.abs(d.delta_seg - media)));
return ok({ anclajes: deltas, offset_medio_seg: Number(media.toFixed(2)), dispersion_seg: Number(dispersion.toFixed(2)), correccion: dispersion < 0.75 ? "offset CONSTANTE: suma " + Number(media.toFixed(2)) + "s a todo caption y queda alineado" : "offset VARIABLE (deriva): el material se desincroniza progresivamente; realinea por tramos en lugar de un solo offset", aplicacion: "al citar tiempos del material, corrige: tiempo_cita = tiempo_caption + " + Number(media.toFixed(2)) });`,
      },
    ],
  },
]

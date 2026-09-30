// ═══ CATEGORÍA: Dolores FUTUROS · Multimodal & Voz (A) ═══
// Evidencia: los agentes de voz y multimodales acumulan transcripts kilométricos
// y assets pesados sin presupuesto de contexto; y el turn-taking (turnos,
// silencios, interrupciones) no tiene máquina de estados que lo gobierna.
export default [
  {
    id: "transcript-condenser",
    title: "Transcript Condenser",
    tagline: "Condensa transcripciones de voz interminables: conserva decisiones, acciones y compromisos; tira la paja",
    category: "Multimodal & Voz",
    pain: "Una reunión de 90 minutos genera 12.000 tokens de transcript con 'eh', saludos y divagaciones: el agente lo traga entero, infla el contexto y aún así se le escapa el único compromiso que se tomó.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/transcript-condenser/. Clasifica segmentos (decisión/acción/compromiso/pregunta/contexto/ruido) con heurísticas lingüísticas; condensa manteniendo íntegro lo accionable y resume el resto.",
    tools: [
      {
        name: "ingest_transcript",
        desc: "Ingiere un transcript con hablantes y segmentos temporales.",
        params: { sesion: { t: "string", d: "Nombre de la sesión/reunión" }, segmentos: { t: "array", d: "Segmentos {hablante, texto, ts?}" } },
        code: `const st = store.load();
st.sesiones = st.sesiones || {};
const limpios = (segmentos || []).filter(s => s && s.texto).map(s => ({ hablante: String(s.hablante || "desconocido"), texto: String(s.texto).trim(), ts: s.ts ? String(s.ts) : null }));
if (!limpios.length) return fail("sin segmentos con texto");
st.sesiones[sesion] = { sesion, segmentos: limpios, ingerido: new Date().toISOString(), condensado: null };
store.save(st);
return ok({ sesion, segmentos: limpios.length, hablantes: [...new Set(limpios.map(s => s.hablante))], caracteres: limpios.reduce((a, s) => a + s.texto.length, 0), siguiente: "condensa con condense" });`,
      },
      {
        name: "condense",
        desc: "Condensa el transcript: clasifica cada segmento y conserva textualmente solo lo accionable.",
        params: { sesion: { t: "string", d: "Sesión a condensar" } },
        code: `const st = store.load();
const s = (st.sesiones || {})[sesion];
if (!s) return fail("sesión no encontrada: " + sesion);
if (!s.segmentos.length) return fail("sesión vacía");
const es = {
  decision: /\\b(acordamos|decidimos|se decide|queda decidido|aprobamos|conclusión|resolvemos|se aprueba)\\b/i,
  accion: /\\b(voy a |vas a |vamos a |debería|hay que|queda pendiente|encárgate|envía|prepara|revisa|haz |me ocupo|te encargas|para el (lunes|martes|miércoles|jueves|viernes)|antes del)\\b/i,
  compromiso: /\\b(me comprometo|prometo|garantizo|aseguro|quedo encargado|será entregado|lo entrego|confirmo)\\b/i,
  pregunta: /\\?|\\b(puedes|podrías|qué te parece|estás de acuerdo|lo ves)\\b/i,
  ruido: /^(eh|em|mhm|sí|no|ok|okay|vale|claro|bueno|ya|ajá)[.!?]?$/i
};
const clasificados = s.segmentos.map((seg, i) => {
  let tipo = "contexto";
  if (es.ruido.test(seg.texto)) tipo = "ruido";
  else if (es.decision.test(seg.texto)) tipo = "decision";
  else if (es.compromiso.test(seg.texto)) tipo = "compromiso";
  else if (es.accion.test(seg.texto)) tipo = "accion";
  else if (es.pregunta.test(seg.texto)) tipo = "pregunta";
  return { idx: i, hablante: seg.hablante, texto: seg.texto, tipo, ts: seg.ts };
});
const accionables = clasificados.filter(c => ["decision", "accion", "compromiso"].includes(c.tipo));
const preguntasAbiertas = clasificados.filter(c => c.tipo === "pregunta").slice(0, 8);
const contexto = clasificados.filter(c => c.tipo === "contexto");
const ruido = clasificados.filter(c => c.tipo === "ruido");
const caracteresOriginales = s.segmentos.reduce((a, x) => a + x.texto.length, 0);
const caracteresCondensados = accionables.reduce((a, x) => a + x.texto.length, 0);
s.condensado = { ts: new Date().toISOString(), accionables, preguntas: preguntasAbiertas, reduccion: caracteresOriginales > 0 ? Number((100 - caracteresCondensados / caracteresOriginales * 100).toFixed(0)) + "%" : "n/a" };
store.save(st);
return ok({ sesion, segmentos_totales: clasificados.length, clasificacion: { decision: clasificados.filter(c => c.tipo === "decision").length, accion: clasificados.filter(c => c.tipo === "accion").length, compromiso: clasificados.filter(c => c.tipo === "compromiso").length, pregunta: clasificados.filter(c => c.tipo === "pregunta").length, contexto: contexto.length, ruido: ruido.length }, conservados_textuales: accionables, preguntas_relevantes: preguntasAbiertas.map(q => ({ quien: q.hablante, pregunta: q.texto.slice(0, 100) })), reduccion_estimada: s.condensado.reduccion, nota: "los segmentos de contexto NO se pierden: quedan accesibles con get_original" });`,
      },
      {
        name: "extract_action_items",
        desc: "Extrae la lista de acciones con responsable inferido y plazo si se menciona.",
        params: { sesion: { t: "string", d: "Sesión condensada" } },
        code: `const st = store.load();
const s = (st.sesiones || {})[sesion];
if (!s || !s.condensado) return fail("condensa primero con condense");
const acciones = s.condensado.accionables.filter(a => a.tipo !== "decision").map(a => {
  const plazoMatch = a.texto.match(/(lunes|martes|miércoles|jueves|viernes|sábado|domingo|mañana|pasado mañana|próxima semana|fin de mes|\\d{1,2} de [a-z]+|\\d{1,2}\\/\\d{1,2})/i);
  return { responsable: a.hablante, tipo: a.tipo, accion: a.texto.slice(0, 140), plazo_mencionado: plazoMatch ? plazoMatch[0] : null };
});
const decisiones = s.condensado.accionables.filter(a => a.tipo === "decision").map(a => ({ decision: a.texto.slice(0, 140), quien_lo_dijo: a.hablante }));
return ok({ sesion, acciones: acciones.length, lista_de_acciones: acciones, decisiones, sin_responsable_claro: acciones.filter(a => !a.responsable || a.responsable === "desconocido").length + " acciones sin responsable identificado: asígnalo antes de cerrar" });`,
      },
      {
        name: "speaker_stats",
        desc: "Estadísticas de participación: quién habló más, quién decidió más, quién calló.",
        params: { sesion: { t: "string", d: "Sesión" } },
        code: `const st = store.load();
const s = (st.sesiones || {})[sesion];
if (!s) return fail("sesión no encontrada");
const por = {};
s.segmentos.forEach(seg => {
  por[seg.hablante] = por[seg.hablante] || { hablante: seg.hablante, segmentos: 0, palabras: 0, decisiones: 0, acciones: 0 };
  por[seg.hablante].segmentos++;
  por[seg.hablante].palabras += seg.texto.split(/\\s+/).filter(Boolean).length;
});
if (s.condensado) s.condensado.accionables.forEach(a => { if (por[a.hablante]) { if (a.tipo === "decision") por[a.hablante].decisiones++; else if (a.tipo === "accion") por[a.hablante].acciones++; } });
const stats = __vals(por).sort((a, b) => b.palabras - a.palabras);
const totalPalabras = stats.reduce((a, x) => a + x.palabras, 0) || 1;
return ok({ sesion, hablantes: stats.length, participacion: stats.map(x => ({ ...x, share: Number((x.palabras / totalPalabras * 100).toFixed(0)) + "%" })), observaciones: { mas_decisiones: stats.slice().sort((a, b) => b.decisiones - a.decisiones)[0]?.hablante || "nadie decidió nada", accion_por_hablante: stats.filter(x => x.acciones > 0).map(x => x.hablante + " (" + x.acciones + ")"), dominante: stats[0] && stats[0].share > 60 ? stats[0].hablante + " acapara el " + stats[0].share + ": ¿reunión o monólogo?" : "participación equilibrada" } });`,
      },
      {
        name: "get_original",
        desc: "Recupera los segmentos originales de contexto descartados en la condensación (nada se pierde).",
        params: { sesion: { t: "string", d: "Sesión" }, desde_indice: { t: "number", d: "Índice de segmento inicial", opt: true, def: 0 }, cantidad: { t: "number", d: "Cuántos segmentos", opt: true, def: 20 } },
        code: `const st = store.load();
const s = (st.sesiones || {})[sesion];
if (!s) return fail("sesión no encontrada");
const segmentos = s.segmentos.slice(desde_indice, desde_indice + cantidad);
return ok({ sesion, rango: { desde: desde_indice, hasta: Math.min(desde_indice + cantidad, s.segmentos.length) }, total: s.segmentos.length, segmentos });`,
      },
    ],
  },
  {
    id: "av-budget-packer",
    title: "AV Budget Packer",
    tagline: "Mochila de contexto multimodal: qué audios, imágenes y videos caben en el presupuesto con prioridad declarada",
    category: "Multimodal & Voz",
    pain: "El agente multimodal mete 6 imágenes y 3 audios 'porque caben' y revienta el contexto a los 4 turnos: no existe la disciplina de presupuestar assets por prioridad como se presupuestan tokens.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/av-budget-packer/. Registro de assets con coste en tokens estimado (por resolución/duración); el packer resuelve la mochila por prioridad×densidad de valor y sugiere downsampleo del resto.",
    tools: [
      {
        name: "register_asset",
        desc: "Registra un asset multimodal con coste estimado en tokens y prioridad.",
        params: { asset: { t: "string", d: "Identificador del asset" }, tipo: { t: "enum", d: "Tipo", values: ["imagen", "audio", "video", "documento"] }, tokens_estimados: { t: "number", d: "Coste en tokens (imagen ~ (ancho*alto)/750, audio ~ 25 por segundo)" }, prioridad: { t: "number", d: "Prioridad 1 (imprescindible) a 10 (prescindible)" }, valor: { t: "string", d: "Qué aporta este asset a la tarea", opt: true } },
        code: `const st = store.load();
st.assets = st.assets || {};
if (st.assets[asset]) return fail("asset ya registrado: " + asset);
if (tokens_estimados <= 0) return fail("tokens_estimados debe ser positivo");
if (prioridad < 1 || prioridad > 10) return fail("prioridad de 1 a 10");
st.assets[asset] = { asset, tipo, tokens: tokens_estimados, prioridad, valor: valor || "", densidad: Number(((11 - prioridad) * 1000 / tokens_estimados).toFixed(3)), usado_en: [], creado: new Date().toISOString() };
store.save(st);
return ok({ asset, tipo, tokens: tokens_estimados, prioridad, densidad_valor_por_token: st.assets[asset].densidad });`,
      },
      {
        name: "pack",
        desc: "Resuelve la mochila: qué assets entran en el presupuesto de tokens, por densidad de valor.",
        params: { presupuesto_tokens: { t: "number", d: "Tokens disponibles para assets" }, filtrar: { t: "array", d: "Restrictir a ciertos ids de asset", opt: true } },
        code: `const st = store.load();
let candidatos = __vals(st.assets || {});
if (filtrar && filtrar.length) candidatos = candidatos.filter(a => filtrar.includes(a.asset));
if (!candidatos.length) return fail("sin assets registrados");
const ordenados = candidatos.slice().sort((a, b) => b.densidad - a.densidad);
const dentro = [], fuera = [];
let restante = presupuesto_tokens;
ordenados.forEach(a => {
  if (a.tokens <= restante) { dentro.push(a); restante -= a.tokens; }
  else fuera.push(a);
});
const criticoFuera = fuera.filter(a => a.prioridad <= 3);
return ok({ presupuesto: presupuesto_tokens, usados: presupuesto_tokens - restante, libres: restante, dentro: dentro.map(a => ({ asset: a.asset, tipo: a.tipo, tokens: a.tokens, prioridad: a.prioridad })), fuera: fuera.map(a => ({ asset: a.asset, tipo: a.tipo, tokens: a.tokens, prioridad: a.prioridad, razon: a.tokens > presupuesto_tokens ? "NO CABE NUNCA: demasiado grande, redúcelo en origen" : "cabe con presupuesto mayor o recortando otro" })), alertas: criticoFuera.length ? criticoFuera.map(a => "CRÍTICO fuera: " + a.asset + " (prioridad " + a.prioridad + "): sube el presupuesto o baja assets de prioridad 8-10") : [], utilizacion: Number(((presupuesto_tokens - restante) / presupuesto_tokens * 100).toFixed(0)) + "%" });`,
      },
      {
        name: "suggest_downsample",
        desc: "Para los assets que no cupieron: cuánto reducirlos para que entren (o por qué no merece la pena).",
        params: { asset: { t: "string", d: "Asset a reducir" }, presupuesto_tokens: { t: "number", d: "Tokens disponibles para él" } },
        code: `const st = store.load();
const a = (st.assets || {})[asset];
if (!a) return fail("asset no registrado: " + asset);
const ratio = Number((presupuesto_tokens / a.tokens).toFixed(2));
if (ratio >= 1) return ok({ asset, cabe_ya: true, mensaje: "cabe tal cual: " + a.tokens + " tokens < presupuesto " + presupuesto_tokens });
if (ratio < 0.15) return ok({ asset, cabe_ya: false, ratio, recomendacion: "requerirías reducir al " + Number((ratio * 100).toFixed(0)) + "%: la pérdida de información es inaceptable, descártalo o pide el asset de nuevo en origen" });
const ajustes = {
  imagen: ratio < 0.5 ? "recorta a la región de interés + baja resolución a ~" + Math.round(512 * ratio * 2) + "px: los detalles se pierden pero la escena sobrevive" : "baja resolución a ~" + Math.round(1024 * ratio) + "px o recorta bordes",
  audio: "transcribe en su lugar (texto ~75% más barato) o recorta al segmento relevante ~" + Number((ratio * 100).toFixed(0)) + "% de duración",
  video: "extrae keyframes (" + Math.max(2, Math.round(8 * ratio)) + " frames) + transcripción del audio",
  documento: "extrae solo las secciones relevantes (~" + Number((ratio * 100).toFixed(0)) + "% del documento)"
};
return ok({ asset, tipo: a.tipo, tokens_actuales: a.tokens, presupuesto: presupuesto_tokens, ratio_posible: ratio, ajuste_sugerido: ajustes[a.tipo], aviso_prioridad: a.prioridad <= 3 ? "es prioridad " + a.prioridad + ": MERECE el downsample" : "prioridad " + a.prioridad + ": descártalo antes que degradar los críticos" });`,
      },
      {
        name: "pack_report",
        desc: "Informe de coste acumulado de assets por tarea y detección de pesos repetidos.",
        params: {},
        code: `const st = store.load();
const assets = __vals(st.assets || {});
if (!assets.length) return ok({ assets: 0, mensaje: "sin assets" });
const porTipo = {};
assets.forEach(a => { porTipo[a.tipo] = porTipo[a.tipo] || { tipo: a.tipo, count: 0, tokens: 0 }; porTipo[a.tipo].count++; porTipo[a.tipo].tokens += a.tokens; });
const gigantes = assets.filter(a => a.tokens > 4000);
return ok({ assets: assets.length, tokens_totales: assets.reduce((a, x) => a + x.tokens, 0), por_tipo: __vals(porTipo), mas_caros: assets.slice().sort((a, b) => b.tokens - a.tokens).slice(0, 5).map(a => ({ asset: a.asset, tipo: a.tipo, tokens: a.tokens, prioridad: a.prioridad })), gigantes: gigantes.map(g => g.asset + " (" + g.tokens + " tokens)"), recomendacion: gigantes.length ? "los assets de +4000 tokens devoran presupuestos típicos (8k-16k): recortarlos en origen es la mayor palanca de ahorro" : "tamaños razonables" });`,
      },
    ],
  },
  {
    id: "turn-state-machine",
    title: "Turn State Machine",
    tagline: "Gobierno de turnos para agentes de voz: quién habla, cuándo callar, cómo procesar la interrupción sin perder el hilo",
    category: "Multimodal & Voz",
    pain: "El agente de voz sigue hablando cuando el usuario ya lo interrumpió, o responde al silencio con monólogos en cadena: el turn-taking es una máquina de estados y casi nadie la modela, se improvisa con ifs.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/turn-state-machine/. Sesiones de diálogo con estados ESCUCHANDO/PENSANDO/HABLANDO/ESPERANDO_CONFIRMACION y eventos legales por transición; detecta interrupciones (barge-in), silencios y compulsión de respuesta.",
    tools: [
      {
        name: "new_session",
        desc: "Crea una sesión de diálogo de voz con política de turnos.",
        params: { sesion: { t: "string", d: "Id de sesión" }, silencio_max_seg: { t: "number", d: "Segundos de silencio del usuario antes de ceder turno", opt: true, def: 6 }, tolera_interrupcion: { t: "boolean", d: "¿El usuario puede interrumpir al agente?", opt: true, def: true } },
        code: `const st = store.load();
st.dialogos = st.dialogos || {};
if (st.dialogos[sesion]) return fail("sesión ya existe: " + sesion);
st.dialogos[sesion] = { sesion, estado: "ESCUCHANDO", politica: { silencio_max_seg, tolera_interrupcion }, eventos: [], turnos_usuario: 0, turnos_agente: 0, interrupciones: 0, creado: new Date().toISOString() };
store.save(st);
return ok({ sesion, estado_inicial: "ESCUCHANDO", politica: { silencio_max_seg, tolera_interrupcion }, eventos_legales: ["usuario_habla", "silencio_detectado", "agente_listo_para_hablar", "agente_termino", "usuario_interrumpe", "fin_dialogo"] });`,
      },
      {
        name: "handle_event",
        desc: "Procesa un evento de turno y devuelve la transición con la acción correcta para el agente.",
        params: { sesion: { t: "string", d: "Sesión" }, evento: { t: "enum", d: "Evento ocurrido", values: ["usuario_habla", "silencio_detectado", "agente_listo_para_hablar", "agente_termino", "usuario_interrumpe", "fin_dialogo"] }, detalle: { t: "string", d: "Detalle del evento (duración del silencio, texto escuchado...)", opt: true } },
        code: `const st = store.load();
const d = (st.dialogos || {})[sesion];
if (!d) return fail("sesión no encontrada: crea con new_session");
const transiciones = {
  ESCUCHANDO: { usuario_habla: { a: "PENSANDO", accion: "deja de escuchar: procesa el input del usuario completo antes de responder", turno: "usuario" }, silencio_detectado: { a: "ESCUCHANDO", accion: "sigue esperando: el silencio corto es pensamiento, no rendición" }, agente_listo_para_hablar: { a: "HABLANDO", accion: "habla: ten listo el texto TTS con anclas de pausa" } },
  PENSANDO: { agente_listo_para_hablar: { a: "HABLANDO", accion: "responde: marca el inicio con una señal audible breve si la latencia superó 2s" }, usuario_interrumpe: { a: "ESCUCHANDO", accion: "re-escucha: el usuario añadió información mientras pensabas, re-procesa TODO el input junto" } },
  HABLANDO: { usuario_interrumpe: { a: "ESCUCHANDO", accion: "CALLA INMEDIATAMENTE y guarda el punto exacto de corte: reanudar desde ahí solo si el usuario no aporta nada nuevo", critico: true }, agente_termino: { a: "ESPERANDO_CONFIRMACION", accion: "cierra el turno con pregunta corta o confirmación explícita y cede la palabra" } },
  ESPERANDO_CONFIRMACION: { usuario_habla: { a: "PENSANDO", accion: "procesa la confirmación o la nueva petición" }, silencio_detectado: { a: "ESCUCHANDO", accion: "tras el silencio máximo, resume y ofrece ayuda una sola vez: NO repitas lo mismo en bucle" } }
};
const desde = d.estado;
const t = (transiciones[desde] || {})[evento];
if (!t) {
  const legal = Object.keys(transiciones[desde] || {});
  return fail("evento '" + evento + "' ILEGAL en estado " + desde + ". Eventos legales: " + (legal.join(", ") || "ninguno (estado terminal)") + ". Forzarlo rompería el turn-taking");
}
if (evento === "usuario_interrumpe" && !d.politica.tolera_interrupcion) return fail("interrupción NO tolerada por política: el agente debe terminar su frase (y revisa la política, negar barge-in suele frustrar)");
d.estado = t.a;
if (evento === "usuario_habla") d.turnos_usuario++;
if (evento === "agente_termino") d.turnos_agente++;
if (evento === "usuario_interrumpe") { d.interrupciones++; d.ultimo_corte = { detalle: detalle || "", ts: new Date().toISOString() }; }
d.eventos.push({ desde, evento, a: t.a, detalle: detalle || "", ts: new Date().toISOString() });
store.save(st);
return ok({ sesion, transicion: desde + " --" + evento + "--> " + t.a, estado_actual: d.estado, accion_para_el_agente: t.accion, punto_de_corte: evento === "usuario_interrumpe" ? d.ultimo_corte : null, metricas: { turnos_usuario: d.turnos_usuario, turnos_agente: d.turnos_agente, interrupciones: d.interrupciones } });`,
      },
      {
        name: "current_state",
        desc: "Estado actual de la sesión y eventos legales desde ahí.",
        params: { sesion: { t: "string", d: "Sesión" } },
        code: `const st = store.load();
const d = (st.dialogos || {})[sesion];
if (!d) return fail("sesión no encontrada");
const legales = { ESCUCHANDO: ["usuario_habla", "silencio_detectado", "agente_listo_para_hablar"], PENSANDO: ["agente_listo_para_hablar", "usuario_interrumpe"], HABLANDO: ["usuario_interrumpe", "agente_termino"], ESPERANDO_CONFIRMACION: ["usuario_habla", "silencio_detectado"] };
return ok({ sesion, estado: d.estado, eventos_legales: legales[d.estado] || [], politica: d.politica, metricas: { turnos_usuario: d.turnos_usuario, turnos_agente: d.turnos_agente, interrupciones: d.interrupciones, balance: d.turnos_agente > d.turnos_usuario * 2 ? "DESEQUILIBRADO: el agente monopoliza, reduce respuestas" : "razonable" }, ultimo_evento: d.eventos[d.eventos.length - 1] || null });`,
      },
      {
        name: "session_log",
        desc: "Traza completa de transiciones para depurar el comportamiento del diálogo.",
        params: { sesion: { t: "string", d: "Sesión" }, ultimos: { t: "number", d: "Últimos N eventos", opt: true, def: 30 } },
        code: `const st = store.load();
const d = (st.dialogos || {})[sesion];
if (!d) return fail("sesión no encontrada");
const eventos = d.eventos.slice(-ultimos);
const ratios = { interrupciones_por_turno_agente: d.turnos_agente ? Number((d.interrupciones / d.turnos_agente).toFixed(2)) : 0 };
return ok({ sesion, eventos_totales: d.eventos.length, eventos, diagnostico: ratios.interrupciones_por_turno_agente > 0.5 ? "el usuario interrumpe la MITAD de los turnos del agente: respuestas demasiado largas o fuera de punto, acórtalas" : d.eventos.filter(e => e.evento === "silencio_detectado").length > d.turnos_usuario ? "muchos silencios: el agente no deja espacio natural para hablar" : "dinámica de turnos sana" });`,
      },
    ],
  },
]

// ═══ CATEGORÍA: Dolores de agentes · Calidad de Salida (B) ═══
export default [
  {
    id: "self-critic",
    title: "Self Critic",
    tagline: "El agente se critica a sí mismo: checklist de reflexión antes de entregar",
    category: "Calidad de Salida",
    pain: "Sin reflexión previa a la entrega, el agente repite errores evitables (técnica reflect de los papers de agentes).",
    tools: [
      {
        name: "critique",
        desc: "Aplica checklist de autocrítica a una salida: rigor, completitud, sesgos, seguridad y accionabilidad. Genera issues concretos.",
        params: { salida: { t: "string", d: "Salida a criticar" }, tarea: { t: "string", d: "Tarea original que debía resolver" } },
        code: `const t = salida; const issues: any[] = [];
if (t.length < 80) issues.push({ severidad: "alta", issue: "salida mínima para la tarea: ¿falta desarrollo?" });
if (/\\b(por supuesto|obviamente|como todos saben|es bien conocido)\\b/i.test(t)) issues.push({ severidad: "media", issue: "presuposiciones no verificadas: cites o elimina" });
if (t.toLowerCase().split(/\\s+/).filter((w) => ["bueno", "malo", "mejor", "peor"].includes(w)).length > 6) issues.push({ severidad: "media", issue: "juicios de valor sin criterios explícitos" });
if (!/\\d/.test(t) && /analiza|compara|cifra|dato|estadístic/i.test(tarea)) issues.push({ severidad: "alta", issue: "tarea pedía análisis y la salida no tiene ni un número" });
if (/\\b(nunca|siempre|todos|ninguno|imposible)\\b/i.test(t)) issues.push({ severidad: "media", issue: "generalizaciones absolutas: súqualas o matízalas" });
if (!/(paso|1\\.|2\\.|primero|luego|finalmente)/i.test(t) && /instrucc|cómo|how|guía|tutorial/i.test(tarea)) issues.push({ severidad: "media", issue: "instrucciones sin secuencia clara" });
const score = Math.max(0, 100 - issues.reduce((a, i) => a + (i.severidad === "alta" ? 30 : 12), 0));
return ok({ score_autocritica: score, issues, veredicto: score >= 75 ? "entregable" : score >= 50 ? "corregir antes de entregar" : "revisar profundamente" });`,
      },
      {
        name: "reflect_prompt",
        desc: "Genera el prompt de reflexión (estilo Reflexion) para que el modelo mejore su salida en el siguiente intento.",
        params: { tarea: { t: "string", d: "La tarea original" }, intento: { t: "string", d: "El intento fallido" }, feedback: { t: "string", d: "Qué salió mal", opt: true } },
        code: `const prompt = [
  "Reflexiona sobre tu intento anterior y mejora la respuesta.",
  "TAREA ORIGINAL: " + tarea,
  "INTENTO ANTERIOR: " + String(intento).slice(0, 2000),
  feedback ? "FEEDBACK RECIBIDO: " + feedback : "",
  "INSTRUCCIONES:",
  "1. Identifica 2-3 errores concretos del intento anterior",
  "2. Explica por qué ocurrieron",
  "3. Produce una versión corregida que evite esos errores",
  "4. Verifica contra la tarea original antes de responder",
].filter(Boolean).join("\\n\\n");
return ok({ prompt_de_reflexion: prompt });`,
      },
    ],
  },
  {
    id: "consensus-voter",
    title: "Consensus Voter",
    tagline: "Votación entre N respuestas del mismo prompt: self-consistency sin infraestructura",
    category: "Calidad de Salida",
    pain: "Una sola pasada del LLM puede ser un outlier: self-consistency (votar entre N muestras) mejora precisión pero falta tooling.",
    persistent: true,
    tools: [
      {
        name: "add_answer",
        desc: "Añade una respuesta candidata (de una pasada distinta) a la pregunta activa.",
        params: { pregunta: { t: "string", d: "La pregunta (misma para todas)" }, respuesta: { t: "string", d: "Respuesta candidata" } },
        code: `const st = store.load();
st.rondas = st.rondas || {};
const k = pregunta.slice(0, 150);
st.rondas[k] = st.rondas[k] || { pregunta: k, respuestas: [] };
st.rondas[k].respuestas.push({ texto: respuesta, ts: new Date().toISOString() });
store.save(st);
return ok({ pregunta: k, total_respuestas: st.rondas[k].respuestas.length });`,
      },
      {
        name: "vote",
        desc: "Calcula el consenso: agrupa respuestas por similitud (números clave + Jaccard) y devuelve la ganadora con nivel de acuerdo.",
        params: { pregunta: { t: "string", d: "La pregunta de la ronda" } },
        code: `const st = store.load();
const k = pregunta.slice(0, 150);
const ronda = st.rondas?.[k];
if (!ronda?.respuestas?.length) return fail("sin respuestas registradas: add_answer primero");
const resp = ronda.respuestas.map((r: any) => String(r.texto));
const clusters: any[] = [];
for (const texto of resp) {
  const nums = (texto.match(/\\d+(\\.\\d+)?/g) || []).sort().join(",");
  const words = new Set(texto.toLowerCase().split(/\\s+/).filter((w) => w.length > 3));
  const cluster = clusters.find((c) => {
    const inter = [...words].filter((w) => c.words.has(w)).length;
    const sim = inter / (words.size + c.words.size - inter || 1);
    const sameNums = nums && nums === c.nums;
    return sim > 0.55 || (sameNums && sim > 0.3);
  });
  if (cluster) { cluster.miembros.push(texto); } else clusters.push({ nums, words, miembros: [texto] });
}
clusters.sort((a, b) => b.miembros.length - a.miembros.length);
const ganador = clusters[0];
const acuerdo = Math.round((ganador.miembros.length / resp.length) * 100);
return ok({ total_respuestas: resp.length, clusters: clusters.map((c) => ({ votos: c.miembros.length, ejemplo: c.miembros[0].slice(0, 150) })), respuesta_consenso: ganador.miembros[0], acuerdo: acuerdo + "%", fuerte: acuerdo >= 70 });`,
      },
    ],
  },
  {
    id: "output-diff",
    title: "Output Diff",
    tagline: "Diffs de JSON y texto: qué cambió entre dos versiones de una salida",
    category: "Calidad de Salida",
    pain: "Regenerar una respuesta y no saber qué cambió respecto a la anterior: imposible evaluar mejoras.",
    tools: [
      {
        name: "diff_json",
        desc: "Diff estructural de dos JSON: rutas añadidas, eliminadas y con valor cambiado.",
        params: { a: { t: "any", d: "JSON base" }, b: { t: "any", d: "JSON nuevo" } },
        code: `function caminar(obj: any, ruta: string, out: any) {
  if (obj === null || typeof obj !== "object") { out[ruta] = obj; return; }
  for (const [k, v] of Object.entries(obj)) caminar(v, ruta ? ruta + "." + k : k, out);
}
const flatA: any = {}; const flatB: any = {};
caminar(a, "", flatA); caminar(b, "", flatB);
const añadidas: string[] = []; const eliminadas: string[] = []; const cambiadas: any[] = [];
for (const k of Object.keys(flatB)) if (!(k in flatA)) añadidas.push(k);
for (const k of Object.keys(flatA)) if (!(k in flatB)) eliminadas.push(k);
for (const k of Object.keys(flatA)) if (k in flatB && JSON.stringify(flatA[k]) !== JSON.stringify(flatB[k])) cambiadas.push({ ruta: k, antes: flatA[k], ahora: flatB[k] });
return ok({ añadidas, eliminadas, cambiadas, resumen: { "+": añadidas.length, "-": eliminadas.length, "~": cambiadas.length } });`,
      },
      {
        name: "diff_text",
        desc: "Diff línea a línea de dos textos (LCS simple): añadidas, eliminadas y contexto.",
        params: { a: { t: "string", d: "Texto base" }, b: { t: "string", d: "Texto nuevo" } },
        code: `const la = a.split("\\n"); const lb = b.split("\\n");
const m = la.length, n = lb.length;
const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = la[i] === lb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
const cambios: any[] = [];
let i = 0, j = 0;
while (i < m && j < n) {
  if (la[i] === lb[j]) { i++; j++; }
  else if (dp[i + 1][j] >= dp[i][j + 1]) { cambios.push({ tipo: "-", linea: i + 1, texto: la[i] }); i++; }
  else { cambios.push({ tipo: "+", linea: j + 1, texto: lb[j] }); j++; }
}
while (i < m) { cambios.push({ tipo: "-", linea: i + 1, texto: la[i] }); i++; }
while (j < n) { cambios.push({ tipo: "+", linea: j + 1, texto: lb[j] }); j++; }
return ok({ lineas_base: m, lineas_nuevas: n, cambios: cambios.slice(0, 200), total_cambios: cambios.length });`,
      },
    ],
  },
  {
    id: "normalize-output",
    title: "Normalize Output",
    tagline: "Normaliza formatos: fechas ISO, números, unidades y casing consistentes",
    category: "Calidad de Salida",
    pain: "La salida llega con formatos mezclados: fechas en 3 formatos, números con comas y puntos, unidades inconsistentes.",
    tools: [
      {
        name: "normalize_dates",
        desc: "Detecta fechas en un texto y las normaliza a ISO 8601 (YYYY-MM-DD), reportando cada conversión.",
        params: { texto: { t: "string", d: "Texto con fechas" } },
        code: `const MES: any = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const hallazgos: any[] = [];
let resultado = texto;
const patrones: Array<[RegExp, (m: string[]) => string]> = [
  [/\\b(\\d{1,2})[\\/](\\d{1,2})[\\/](\\d{4})\\b/g, (m) => new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString().slice(0, 10)],
  [/\\b(\\d{1,2}) de ([a-záéíóúñ]+) de (\\d{4})\\b/gi, (m) => String(new Date(Date.UTC(+m[3], (MES[m[2].toLowerCase()] || 1) - 1, +m[1])).toISOString().slice(0, 10))],
  [/\\b(\\d{4})-(\\d{2})-(\\d{2})\\b/g, (m) => m[0]],
];
for (const [re, fn] of patrones) {
  resultado = resultado.replace(re, (...args: any[]) => {
    const iso = fn(args.slice(0, -2) as string[]);
    hallazgos.push({ original: args[0], iso });
    return iso;
  });
}
return ok({ fechas_normalizadas: hallazgos.length, hallazgos, texto_resultado: resultado });`,
      },
      {
        name: "normalize_numbers",
        desc: "Normaliza números con separadores de miles/decimales mezclados (1.234,56 / 1,234.56) a formato consistente.",
        params: { numero: { t: "string", d: "Número a normalizar" }, formato: { t: "enum", values: ["punto-decimal", "coma-decimal"], d: "Formato destino", opt: true, def: "punto-decimal" } },
        code: `let s = String(numero).trim().replace(/\\s/g, "");
const tiene_ambos = s.includes(".") && s.includes(",");
if (tiene_ambos) {
  if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
} else if (s.includes(",")) {
  const partes = s.split(",");
  s = partes.length === 2 && partes[1].length !== 3 ? s.replace(",", ".") : s.replace(/,/g, "");
}
const valor = Number(s);
if (Number.isNaN(valor)) return fail("no parseable: " + numero);
const destino = formato || "punto-decimal";
const formateado = destino === "punto-decimal" ? valor.toLocaleString("en-US") : valor.toLocaleString("de-DE");
return ok({ original: numero, valor, formateado, formato: destino });`,
      },
    ],
  },
  {
    id: "text-qa",
    title: "Text QA",
    tagline: "QA de texto: palabras duplicadas, placeholders, encoding roto y espaciado",
    category: "Calidad de Salida",
    pain: "Salidas con errores tipográficos obvios (palabras duplicadas, caracteres mojibake, doble espacio) erosionan la confianza.",
    tools: [
      {
        name: "check",
        desc: "Ejecuta 10+ reglas de QA tipográfico: duplicadas, mojibake, doble espacio, espacios antes de puntuación, minúscula tras punto, lorem, URLs rotas.",
        params: { texto: { t: "string", d: "Texto a revisar" } },
        code: `const issues: any[] = [];
const dup = texto.match(/\\b(\\w+)\\s+\\1\\b/gi);
if (dup) issues.push({ tipo: "palabra-duplicada", ejemplos: dup.slice(0, 5) });
if (/[\\ufffd\\u00c3\\u00e2\\u20ac]/.test(texto)) issues.push({ tipo: "encoding-roto (mojibake)", ejemplos: (texto.match(/[\\ufffd\\u00c3.\\u00e2\\u20ac]{2,}/g) || []).slice(0, 5) });
if (/ {2,}/.test(texto)) issues.push({ tipo: "doble-espacio", ocurrencias: (texto.match(/ {2,}/g) || []).length });
if (/\\s+[,;:.!?]/.test(texto)) issues.push({ tipo: "espacio-antes-de-puntuación", ocurrencias: (texto.match(/\\s+[,;:.!?]/g) || []).length });
if (/[a-z]\\.[A-Z]/.test(texto.replace(/\\b\\w\\./g, ""))) issues.push({ tipo: "posible-falta-de-espacio-tras-punto" });
if (/lorem ipsum/i.test(texto)) issues.push({ tipo: "lorem-ipsum" });
if (/\\bTODO\\b|\\bFIXME\\b|TBD/i.test(texto)) issues.push({ tipo: "marcas-de-trabajo-inconcluso" });
if (/[)!.,;:]{2,}/.test(texto)) issues.push({ tipo: "puntuación-repetida", ejemplos: (texto.match(/[)!.,;:]{2,}/g) || []).slice(0, 3) });
if (/\\s\\n/.test(texto)) issues.push({ tipo: "espacios-al-final-de-línea", ocurrencias: (texto.match(/\\s\\n/g) || []).length });
if (textoo_mayus(texto)) issues.push({ tipo: "GRIETAS-en-mayúsculas (shouting)", ejemplos: (texto.match(/\\b[A-ZÁÉÍÓÚÑ]{5,}\\b/g) || []).slice(0, 5) });
function textoo_mayus(t: string): boolean { return (t.match(/\\b[A-ZÁÉÍÓÚÑ]{5,}\\b/g) || []).length > 2; }
return ok({ limpio: issues.length === 0, issues: issues.map((i) => ({ tipo: i.tipo, ...i })) });`,
      },
      {
        name: "fix_common",
        desc: "Corrige automáticamente los problemas tipográficos seguros: duplicadas, dobles espacios, espacios antes de puntuación, trailing spaces.",
        params: { texto: { t: "string", d: "Texto a corregir" } },
        code: `let t = texto;
let cambios = 0;
const antes = t;
t = t.replace(/\\b(\\w+)\\s+\\1\\b/gi, "$1"); if (t !== antes) cambios++;
const a2 = t; t = t.replace(/ {2,}/g, " "); if (t !== a2) cambios++;
const a3 = t; t = t.replace(/\\s+([,;:.!?])/g, "$1"); if (t !== a3) cambios++;
const a4 = t; t = t.replace(/[ \\t]+\\n/g, "\\n"); if (t !== a4) cambios++;
const a5 = t; t = t.replace(/[)!.,;:]{2,}/g, (m) => m[0]); if (t !== a5) cambios++;
return ok({ cambios_aplicados: cambios, texto_corregido: t });`,
      },
    ],
  },
  {
    id: "response-size-guard",
    title: "Response Size Guard",
    tagline: "Guardián del tamaño de respuesta: nada revienta el contexto del cliente (issue #58 de MCP)",
    category: "Calidad de Salida",
    pain: "Respuestas MCP gigantes desbordan el contexto del cliente: el spec pide truncado inteligente (GitHub modelcontextprotocol#58).",
    tools: [
      {
        name: "measure",
        desc: "Mide una respuesta MCP {content:[{type,text}]}: tokens estimados, caracteres y si excede límites recomendados.",
        params: { respuesta: { t: "any", d: "Respuesta MCP a medir" }, limite_tokens: { t: "number", d: "Límite recomendado", opt: true, def: 2000 } },
        code: `const r = respuesta || {};
const textos = (r.content || []).map((c: any) => String(c.text || "")).join("\\n");
const tokens = Math.ceil(textos.length / 4);
const items = (r.content || []).length;
return ok({ caracteres: textos.length, tokens_estimados: tokens, items_content: items, limite: limite_tokens ?? 2000, excede: tokens > (limite_tokens ?? 2000), exceso: Math.max(0, tokens - (limite_tokens ?? 2000)) });`,
      },
      {
        name: "truncate_safe",
        desc: "Trunca una respuesta de forma segura: conserva JSON válido (elide arrays), corta texto por oraciones y añade aviso.",
        params: { data: { t: "any", d: "Datos a truncar" }, max_tokens: { t: "number", d: "Presupuesto de tokens", opt: true, def: 2000 } },
        code: `function ajustar(nodo: any, presupuesto: number): any {
  if (typeof nodo === "string") {
    if (Math.ceil(nodo.length / 4) <= presupuesto) return nodo;
    const oraciones = nodo.split(/(?<=[.!?])\\s+/);
    let out = "";
    for (const o of oraciones) { if (Math.ceil((out + o).length / 4) > presupuesto) break; out += o + " "; }
    if (!out) out = nodo.slice(0, presupuesto * 4);
    return out.trim() + " [...truncado]";
  }
  if (Array.isArray(nodo)) {
    const recortadas: any[] = [];
    let gasto = 0;
    for (const item of nodo) {
      const s = JSON.stringify(item);
      gasto += Math.ceil(s.length / 4);
      if (gasto > presupuesto * 0.8) break;
      recortadas.push(ajustar(item, presupuesto * 0.3));
    }
    return recortadas.length < nodo.length ? [...recortadas.slice(0, 10), "...(" + (nodo.length - recortadas.length) + " elementos elidos)"] : recortadas.map((x) => ajustar(x, presupuesto * 0.3));
  }
  if (nodo && typeof nodo === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(nodo)) out[k] = ajustar(v, presupuesto * 0.4);
    return out;
  }
  return nodo;
}
const ajustado = ajustar(data, max_tokens ?? 2000);
return ok({ truncado: JSON.stringify(ajustado) !== JSON.stringify(data), tokens_origen_estimados: Math.ceil(JSON.stringify(data).length / 4), data: ajustado });`,
      },
    ],
  },
];

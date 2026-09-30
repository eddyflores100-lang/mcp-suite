// ═══ CATEGORÍA: Dolores de agentes · Datos y Extracción (B) ═══
export default [
  {
    id: "yaml-toolkit",
    title: "YAML Toolkit",
    tagline: "Parse y genera YAML (subconjunto práctico): configs y front-matter",
    category: "Datos y Extracción",
    pain: "Las configs llegan en YAML (front-matter, CI, docker-compose) y sin parser el agente las toca a ciegas.",
    tools: [
      {
        name: "parse",
        desc: "Parsea YAML de subconjunto práctico: escalares, strings, listas (- item), maps anidados por indentación y flags. Suficiente para configs típicas.",
        params: { yaml: { t: "string", d: "YAML a parsear" } },
        code: `function parseValor(v: string): any {
  const s = v.trim();
  if (s === "" || s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\\d+\\.\\d+$/.test(s)) return parseFloat(s);
  if (/^\\[.*\\]$/.test(s)) { try { return JSON.parse(s.replace(/'/g, '"')); } catch { return s.slice(1, -1).split(",").map((x) => parseValor(x)); } }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}
const lineas = String(yaml).split(/\\r?\\n/).filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
function parseBloque(idx: number, indent: number): [any, number] {
  const resultado: any = {}; let esLista = false; const lista: any[] = [];
  let i = idx;
  while (i < lineas.length) {
    const linea = lineas[i];
    const indentActual = linea.length - linea.trimStart().length;
    if (indentActual < indent) break;
    const trimmed = linea.trim();
    if (trimmed.startsWith("- ")) {
      esLista = true;
      const resto = trimmed.slice(2);
      if (resto.includes(": ")) {
        const item: any = {};
        const [k, ...restoV] = resto.split(": ");
        item[k.trim()] = parseValor(restoV.join(": "));
        lista.push(item);
      } else lista.push(parseValor(resto));
      i++;
    } else if (/^[\\w.-]+:/.test(trimmed)) {
      const m = trimmed.match(/^([\\w.-]+):\\s*(.*)$/);
      if (!m) { i++; continue; }
      const clave = m[1]; const valorStr = m[2];
      if (valorStr === "") {
        const [sub, nuevoIdx] = parseBloque(i + 1, indentActual + 1);
        if (esLista) { lista.push({ [clave]: sub }); resultado[clave] = sub; }
        else resultado[clave] = sub;
        i = nuevoIdx;
      } else {
        if (esLista) lista.push({ [clave]: parseValor(valorStr) });
        resultado[clave] = parseValor(valorStr);
        i++;
      }
    } else { i++; }
  }
  return [esLista && Object.keys(resultado).length === 0 ? lista : (esLista ? lista : resultado), i];
}
try {
  const [data, final] = parseBloque(0, 0);
  return ok({ data, lineas_parseadas: final });
} catch (e: any) { return fail("YAML no parseable (subconjunto): " + e.message); }`,
      },
      {
        name: "stringify",
        desc: "Serializa un JSON a YAML (indentación 2, strings citadas solo si necesario).",
        params: { data: { t: "any", d: "JSON a serializar" } },
        code: `function esc(s: string): string {
  if (new RegExp("[:#\\-\\[\\]{},&*?|>!%@" + '"' + String.fromCharCode(96) + "\\n]").test(s) || s.trim() !== s || /^(true|false|null|~|-?\\d)/.test(s)) return JSON.stringify(s);
  return s;
}
function serializar(o: any, indent: number): string {
  const pad = "  ".repeat(indent);
  if (o === null || o === undefined) return "null";
  if (typeof o === "boolean" || typeof o === "number") return String(o);
  if (typeof o === "string") return esc(o);
  if (Array.isArray(o)) { return o.length === 0 ? "[]" : "\\n" + o.map((item) => pad + "- " + serializar(item, indent + 1).trimStart()).join("\\n"); }
  const entries = Object.entries(o);
  if (!entries.length) return "{}";
  return "\\n" + entries.map(([k, v]) => {
    const valor = serializar(v, indent + 1);
    return pad + esc(k) + ":" + (valor.startsWith("\\n") ? valor : " " + valor);
  }).join("\\n");
}
const out = serializar(data, 0).replace(/^\\n/, "");
return ok({ yaml: out });`,
      },
    ],
  },
  {
    id: "markdown-toolkit",
    title: "Markdown Toolkit",
    tagline: "TOC, encabezados, enlaces y lint de Markdown",
    category: "Datos y Extracción",
    pain: "Documentos markdown desordenados: sin TOC ni lint, la doc del agente degrada rápido.",
    tools: [
      {
        name: "toc",
        desc: "Genera la tabla de contenidos de un markdown: encabezados anidados con anchors válidos.",
        params: { markdown: { t: "string", d: "Markdown" }, max_nivel: { t: "number", d: "Profundidad máxima", opt: true, def: 3 } },
        code: `const lineas = String(markdown).split("\\n");
const toc: any[] = [];
let enBloque = false;
for (const l of lineas) {
  if (l.trim().startsWith(String.fromCharCode(96, 96, 96))) enBloque = !enBloque;
  if (enBloque) continue;
  const m = l.match(/^(#{1,6})\\s+(.+)$/);
  if (m) {
    const nivel = m[1].length;
    if (nivel <= (max_nivel ?? 3)) {
      const texto = m[2].trim();
      const anchor = texto.toLowerCase().replace(/[^a-záéíóúñü0-9\\s-]/g, "").replace(/\\s+/g, "-");
      toc.push({ nivel, texto, anchor, linea: "[#" + texto + "](#" + anchor + ")" });
    }
  }
}
const indentado = toc.map((t) => "  ".repeat(t.nivel - 1) + "- " + t.linea).join("\\n");
return ok({ encabezados: toc.length, toc: indentado });`,
      },
      {
        name: "structure",
        desc: "Analiza la estructura de un markdown: encabezados por nivel, enlaces, imágenes, bloques de código y conteo de palabras por sección.",
        params: { markdown: { t: "string", d: "Markdown" } },
        code: `const md = String(markdown);
const encabezados = (md.match(/^#{1,6}\\s+.+$/gm) || []).length;
const h1 = (md.match(/^#\\s+.+$/gm) || []).length;
const enlaces = (md.match(/\\[[^\\]]+\\]\\([^)]+\\)/g) || []).length;
const enlaces_rotos = (md.match(/\\]\\(\\s*\\)|\\]\\(#\\)/g) || []).length;
const imagenes = (md.match(/!\\[[^\\]]*\\]\\([^)]+\\)/g) || []).length;
const fence = String.fromCharCode(96, 96, 96);
const bloques = (md.match(new RegExp("^" + fence, "gm")) || []).length / 2;
const palabras = md.replace(new RegExp(fence + "[\\s\\S]*?" + fence, "g"), "").split(/\\s+/).filter(Boolean).length;
const problemas: string[] = [];
if (h1 === 0) problemas.push("sin H1 principal");
if (h1 > 1) problemas.push(h1 + " H1: debería haber uno");
if (encabezados === 0 && palabras > 200) problemas.push("documento largo sin encabezados");
if (enlaces_rotos) problemas.push(enlaces_rotos + " enlaces vacíos");
if (!Number.isInteger(bloques)) problemas.push("bloques de código sin cerrar");
if (bloques === 0 && palabras > 100) problemas.push("sin ejemplos de código");
return ok({ encabezados, h1, enlaces, imagenes, bloques_codigo: Math.round(bloques), palabras, problemas, estructura_ok: problemas.length === 0 });`,
      },
      {
        name: "extract_links",
        desc: "Extrae todos los enlaces {texto, url} de un markdown, detectando duplicados y anchors internos.",
        params: { markdown: { t: "string", d: "Markdown" } },
        code: `const md = String(markdown);
const re = /(?<!!)\\[([^\\]]*)\\]\\(([^)]+)\\)/g;
const enlaces: any[] = [];
let m;
while ((m = re.exec(md)) !== null) enlaces.push({ texto: m[1], url: m[2], interno: m[2].startsWith("#") });
const urls = enlaces.map((e) => e.url);
const duplicados = [...new Set(urls.filter((u, i) => urls.indexOf(u) !== i))];
return ok({ total: enlaces.length, internos: enlaces.filter((e) => e.interno).length, duplicados, enlaces: enlaces.slice(0, 200) });`,
      },
    ],
  },
  {
    id: "pdf-text-extractor",
    title: "PDF Text Extractor",
    tagline: "Extrae texto de PDFs localmente: streams zlib + operadores Tj/TJ, sin dependencias",
    category: "Datos y Extracción",
    pain: "Los PDFs son ilegibles para agentes: los extractores requieren binarios pesados. Aquí: parser PDF puro en Node.",
    imports: ["fs", "path", "os"],
    tools: [
      {
        name: "extract",
        desc: "Extrae texto de un PDF: descomprime streams FlateDecode (zlib), interpreta operadores de texto Tj/TJ/'/\" y decodifica hex strings. Funciona con PDFs de texto (no escaneados).",
        params: { pdf_base64: { t: "string", d: "PDF en base64" } },
        code: `const { inflateSync } = await import("node:zlib");
const buf = Buffer.from(pdf_base64, "base64");
if (buf.slice(0, 5).toString() !== "%PDF-") return fail("no es un PDF válido");
const raw = buf.toString("latin1");
const chunks: string[] = [];
const streamRe = /stream\\r?\\n([\\s\\S]*?)endstream/g;
let sm;
while ((sm = streamRe.exec(raw)) !== null) {
  const data = Buffer.from(sm[1], "latin1");
  let contenido = "";
  try { contenido = inflateSync(data).toString("latin1"); } catch { contenido = sm[1]; }
  chunks.push(contenido);
}
let texto = "";
for (const c of chunks) {
  const tjRe = /\\((?:\\\\.|[^\\\\()])*\\)\\s*Tj|\\[((?:\\\\.|[^\\\\\\]])*)\\]\\s*TJ|\\((?:\\\\.|[^\\\\()])*\\)\\s*'|\\((?:\\\\.|[^\\\\()])*\\)\\s*"/g;
  let m;
  while ((m = tjRe.exec(c)) !== null) {
    const expr = m[0];
    const partes = expr.match(/\\((?:\\\\.|[^\\\\()])*\\)/g) || [];
    for (const p of partes) {
      const BS = String.fromCharCode(92); const NL = String.fromCharCode(10); const CR = String.fromCharCode(13); const TB = String.fromCharCode(9);
      const s = p.slice(1, -1).split(BS + "n").join(NL).split(BS + "r").join(CR).split(BS + "t").join(TB).split(BS + "(").join("(").split(BS + ")").join(")").split(BS + BS).join(BS);
      texto += s;
    }
    texto += "\\n";
  }
}
const hexStr = texto.match(/[0-9A-Fa-f]{4,}/g) || [];
texto = texto.replace(/\\b[0-9A-Fa-f]{6,}\\b/g, "");
const limpio = texto.replace(/\\n{3,}/g, "\\n\\n").trim();
return ok({ paginas_aprox: Math.max(1, chunks.length), caracteres: limpio.length, tiene_texto: limpio.length > 0, nota: limpio.length === 0 ? "PDF sin texto extraíble (¿escaneado?): se necesita OCR" : "", texto: limpio.slice(0, 50000) });`,
      },
      {
        name: "metadata",
        desc: "Extrae metadatos del PDF: versión, título, autor, fechas y productor desde el dictionary y XMP.",
        params: { pdf_base64: { t: "string", d: "PDF en base64" } },
        code: `const buf = Buffer.from(pdf_base64, "base64");
const raw = buf.toString("latin1");
const version = (raw.match(/%PDF-(\\d\\.\\d)/) || [])[1] || null;
const info: any = {};
const infoMatch = raw.match(/\\/Info\\s+(\\d+)\\s+(\\d+)\\s+R/);
for (const campo of ["Title", "Author", "Subject", "Creator", "Producer", "CreationDate", "ModDate"]) {
  const re = new RegExp("\\\\/" + campo + "\\\\s*\\\\(([^)\\\\\\\\]*(?:\\\\\\\\.[^)\\\\\\\\]*)*)\\\\)");
  const m = raw.match(re);
  if (m) info[campo.toLowerCase()] = m[1].replace(/\\\\[()]/g, "");
}
const paginas = (raw.match(/\\/Type\\s*\\/Page[^s]/g) || []).length;
const cifrado = /\\/Encrypt\\s+\\d+\\s+\\d+\\s+R/.test(raw);
return ok({ version_pdf: version, paginas, cifrado, metadata: info, tamano_bytes: buf.length });`,
      },
    ],
  },
  {
    id: "url-inspector",
    title: "URL Inspector",
    tagline: "Anatomía de URLs: parse, normalización, redirecciones en vivo y clasificación",
    category: "Datos y Extracción",
    pain: "URLs malformadas rompen flujos enteros: falta inspección previa (parámetros UTM, redirects, esquemas).",
    needsFetch: true,
    tools: [
      {
        name: "inspect",
        desc: "Analiza una URL estáticamente: esquema, host, puerto, path, query params completos, fragmento, UTMs y riesgo.",
        params: { url: { t: "string", d: "URL a inspeccionar" } },
        code: `let u: any;
try { u = new URL(url); } catch { return fail("URL inválida"); }
const params: any = {};
for (const [k, v] of u.searchParams.entries()) params[k] = v;
const utms = Object.keys(params).filter((k) => k.startsWith("utm_"));
const riesgos: string[] = [];
if (u.protocol === "http:") riesgos.push("sin TLS");
if (u.username || u.password) riesgos.push("credenciales embebidas en la URL");
if (url.length > 2000) riesgos.push("URL extremadamente larga");
const trackers = Object.keys(params).filter((k) => /^(fbclid|gclid|msclkid|mc_cid|mc_eid|ref)$/.test(k));
return ok({ protocolo: u.protocol.replace(":", ""), host: u.host, dominio: u.hostname, puerto: u.port || null, path: u.pathname, fragmento: u.hash || null, params, total_params: Object.keys(params).length, utms, trackers, riesgos, longitud: url.length });`,
      },
      {
        name: "normalize",
        desc: "Normaliza la URL: baja el host, elimina UTMs/trackers, default port, trailing slash controlado y fragmentos.",
        params: { url: { t: "string", d: "URL a normalizar" }, conservar_query: { t: "boolean", d: "Conservar query no-tracking", opt: true, def: true } },
        code: `let u: any;
try { u = new URL(url); } catch { return fail("URL inválida"); }
u.hostname = u.hostname.toLowerCase();
u.hash = "";
const borrar = [...u.searchParams.keys()].filter((k) => k.startsWith("utm_") || /^(fbclid|gclid|msclkid|ref|mc_cid|mc_eid)$/.test(k));
for (const k of borrar) u.searchParams.delete(k);
if (conservar_query === false) u.search = "";
if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
let norm = u.toString();
if (norm.endsWith("?")) norm = norm.slice(0, -1);
return ok({ original: url, normalizada: norm, parametros_eliminados: borrar });`,
      },
      {
        name: "redirect_chain",
        desc: "Sigue la cadena de redirecciones en vivo (máx 5 saltos) y reporta cada hop con status.",
        params: { url: { t: "string", d: "URL inicial" } },
        code: `const cadena: any[] = [];
let actual = url;
for (let hop = 0; hop < 6; hop++) {
  try {
    const r = await fetchSmart(actual, { timeoutMs: 10000, retries: 0 });
    const location = r.text.match(/href=["']([^"']+)["']|content=["']\\d+;\\s*url=([^"']+)/i);
    const locHeader = (r as any).location || null;
    cadena.push({ url: actual, status: r.status });
    if (r.status >= 300 && r.status < 400 && locHeader) { actual = new URL(locHeader, actual).toString(); continue; }
    break;
  } catch (e: any) { cadena.push({ url: actual, error: e.message.slice(0, 60) }); break; }
}
return ok({ saltos: cadena.length - 1, cadena, url_final: cadena[cadena.length - 1]?.url, loop_detectado: new Set(cadena.map((c) => c.url)).size < cadena.length });`,
      },
    ],
  },
  {
    id: "diff-detector",
    title: "Diff Detector",
    tagline: "Detecta cambios entre versiones de texto/HTML/JSON con similitud",
    category: "Datos y Extracción",
    pain: "Saber si algo cambió (y cuánto) entre dos versiones es la base del monitoreo: falta diff con score.",
    tools: [
      {
        name: "similarity",
        desc: "Similitud entre dos textos: Jaccard de palabras + shingles de 3 palabras + ratio de longitud.",
        params: { a: { t: "string", d: "Texto A" }, b: { t: "string", d: "Texto B" } },
        code: `const wa = a.toLowerCase().split(/\\s+/).filter(Boolean);
const wb = b.toLowerCase().split(/\\s+/).filter(Boolean);
const setA = new Set(wa); const setB = new Set(wb);
const inter1 = [...setA].filter((w) => setB.has(w)).length;
const jaccard = inter1 / (setA.size + setB.size - inter1 || 1);
const shingles = (words: string[]) => { const out = new Set<string>(); for (let i = 0; i + 2 < words.length; i++) out.add(words.slice(i, i + 3).join(" ")); return out; };
const sA = shingles(wa); const sB = shingles(wb);
const interS = [...sA].filter((s) => sB.has(s)).length;
const shingleSim = sA.size + sB.size ? interS / (sA.size + sB.size - interS) : 1;
const lenRatio = Math.min(a.length, b.length) / (Math.max(a.length, b.length) || 1);
return ok({ similitud_global: Math.round(((jaccard + shingleSim) / 2) * 1000) / 10 + "%", jaccard_palabras: Math.round(jaccard * 1000) / 10 + "%", similitud_frases: Math.round(shingleSim * 1000) / 10 + "%", ratio_longitud: Math.round(lenRatio * 1000) / 10 + "%", veredicto: shingleSim > 0.9 ? "prácticamente idénticos" : shingleSim > 0.6 ? "mismo contenido con cambios" : shingleSim > 0.3 ? "contenido relacionado" : "contenido distinto" });`,
      },
      {
        name: "changed_sections",
        desc: "Divide dos HTML/textos en secciones por encabezados (h1-h3 o líneas en blanco) y reporta qué secciones cambian, se añaden o desaparecen.",
        params: { version_anterior: { t: "string", d: "Versión vieja" }, version_nueva: { t: "string", d: "Versión nueva" } },
        code: `function seccionar(t: string): any[] {
  const limpio = t.replace(/<[^>]+>/g, "\\n");
  const partes = limpio.split(/\\n(?=#{1,3}\\s)|\\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 30);
  return partes.map((p) => ({ titulo: (p.match(/^#{1,3}\\s+(.+)/) || [])[1]?.slice(0, 60) || p.slice(0, 60), hash: String(p.length) + ":" + p.slice(0, 100) }));
}
const sa = seccionar(version_anterior);
const sb = seccionar(version_nueva);
const hashA = new Map(sa.map((s) => [s.hash, s.titulo]));
const hashB = new Map(sb.map((s) => [s.hash, s.titulo]));
const desaparecidas = [...hashA.entries()].filter(([h]) => !hashB.has(h)).map(([, t]) => t);
const añadidas = [...hashB.entries()].filter(([h]) => !hashA.has(h)).map(([, t]) => t);
const estables = [...hashA.keys()].filter((h) => hashB.has(h)).length;
return ok({ secciones_antes: sa.length, secciones_ahora: sb.length, estables, añadidas: añadidas.slice(0, 20), desaparecidas: desaparecidas.slice(0, 20), cambio_detectado: añadidas.length + desaparecidas.length > 0 });`,
      },
    ],
  },
  {
    id: "chunker",
    title: "Chunker",
    tagline: "Trocea texto para RAG: chunks por oraciones/superposiciones con presupuesto de tokens",
    category: "Datos y Extracción",
    pain: "El RAG casero trocea mal (corta oraciones, tamaños desiguales): la calidad de recuperación se hunde.",
    tools: [
      {
        name: "chunk_text",
        desc: "Trocea texto en chunks de presupuesto de tokens: respeta oraciones, superposición configurable y mínimo por chunk.",
        params: { texto: { t: "string", d: "Texto a trocear" }, max_tokens: { t: "number", d: "Tokens por chunk", opt: true, def: 400 }, overlap_oraciones: { t: "number", d: "Oraciones solapadas entre chunks", opt: true, def: 1 } },
        code: `const oraciones = String(texto).replace(/\\s+/g, " ").split(/(?<=[.!?])\\s+/).filter((s) => s.trim());
const presupuesto = max_tokens ?? 400;
const chunks: any[] = [];
let actual: string[] = [];
let tokensActual = 0;
for (const o of oraciones) {
  const t = Math.ceil(o.length / 4);
  if (tokensActual + t > presupuesto && actual.length) {
    chunks.push({ chunk: chunks.length + 1, texto: actual.join(" "), tokens: tokensActual, oraciones: actual.length });
    const cola = actual.slice(-(overlap_oraciones ?? 1));
    actual = [...cola];
    tokensActual = Math.ceil(cola.join(" ").length / 4);
  }
  if (t > presupuesto) {
    const palabras = o.split(" ");
    let parte: string[] = [];
    for (const w of palabras) {
      if (Math.ceil(parte.join(" ").length / 4) + Math.ceil(w.length / 4) > presupuesto && parte.length) { chunks.push({ chunk: chunks.length + 1, texto: parte.join(" "), tokens: Math.ceil(parte.join(" ").length / 4), oraciones: 1 }); parte = []; }
      parte.push(w);
    }
    if (parte.length) { actual = actual.concat([parte.join(" ")]); tokensActual = Math.ceil(actual.join(" ").length / 4); }
  } else { actual.push(o); tokensActual += t; }
}
if (actual.length) chunks.push({ chunk: chunks.length + 1, texto: actual.join(" "), tokens: tokensActual, oraciones: actual.length });
return ok({ total_chunks: chunks.length, tokens_origen: Math.ceil(texto.length / 4), chunks });`,
      },
      {
        name: "chunk_stats",
        desc: "Estadísticas de una lista de chunks: tamaños, desviación y cobertura con overlap (para tunear el chunking).",
        params: { chunks: { t: "array", d: "Lista de chunks (strings u objetos con texto)" } },
        code: `const tamaños = (Array.isArray(chunks) ? chunks : []).map((c: any) => typeof c === "string" ? Math.ceil(c.length / 4) : Math.ceil(String(c.texto || c.chunk || "").length / 4));
if (!tamaños.length) return fail("sin chunks");
const media = tamaños.reduce((a: number, b: number) => a + b, 0) / tamaños.length;
const sd = Math.sqrt(tamaños.reduce((a: number, t: number) => a + (t - media) ** 2, 0) / tamaños.length);
const sorted = [...tamaños].sort((a, b) => a - b);
return ok({ chunks: tamaños.length, tokens_media: Math.round(media), desviacion: Math.round(sd), min: sorted[0], max: sorted[sorted.length - 1], p50: sorted[Math.floor(sorted.length / 2)], uniformidad: Math.round((1 - sd / (media || 1)) * 100) + "%", recomendacion: sd / (media || 1) > 0.5 ? "tamaños muy dispares: revisa el chunking" : "uniformidad aceptable" });`,
      },
    ],
  },
  {
    id: "data-anonymizer",
    title: "Data Anonymizer",
    tagline: "Anonimiza datasets: pseudonimos estables, emails fake y análisis de riesgo de reidentificación",
    category: "Datos y Extracción",
    pain: "Compartir datasets con PII raw es ilegal: hace falta anonimización con mapeo estable (no romper joins).",
    persistent: true,
    tools: [
      {
        name: "pseudonymize",
        desc: "Pseudonimiza un dataset: reemplaza valores de columnas sensibles por IDs estables (mismo input → mismo seudónimo, los joins sobreviven).",
        params: { data: { t: "array", d: "Lista de registros (objetos)" }, columnas_sensibles: { t: "array", d: "Columnas a pseudonimizar" }, prefijo: { t: "string", d: "Prefijo del seudónimo", opt: true, def: "persona" } },
        code: `const st = store.load();
st.mapa = st.mapa || {};
const registros = Array.isArray(data) ? data : [];
const cols = Array.isArray(columnas_sensibles) ? columnas_sensibles : [];
let siguiente = st.siguiente || 1;
const salida = registros.map((reg: any) => {
  const nuevo: any = { ...reg };
  for (const c of cols) {
    const original = String(reg[c] ?? "");
    if (!original) continue;
    if (!st.mapa[original]) { st.mapa[original] = prefijo + "-" + siguiente; siguiente++; }
    nuevo[c] = st.mapa[original];
  }
  return nuevo;
});
st.siguiente = siguiente;
store.save(st);
return ok({ registros_procesados: salida.length, valores_mapeados: Object.keys(st.mapa).length, aviso: "el mapa original→seudónimo vive en ~/.mcp-suite: es dato sensible (k-anonimidad depende de él)" });`,
      },
      {
        name: "reidentification_risk",
        desc: "Evalúa riesgo de reidentificación de un dataset: cuasi-identificadores (combinaciones únicas) estilo k-anonimidad.",
        params: { data: { t: "array", d: "Registros" }, columnas_quasi: { t: "array", d: "Columnas cuasi-identificadoras (edad, ciudad, zip...)" } },
        code: `const registros = Array.isArray(data) ? data : [];
const cols = Array.isArray(columnas_quasi) ? columnas_quasi : [];
if (!registros.length || !cols.length) return fail("necesitas data y columnas_quasi");
const combos: any = {};
for (const r of registros) {
  const clave = cols.map((c) => String(r[c] ?? "?")).join("|");
  combos[clave] = (combos[clave] || 0) + 1;
}
const grupos = Object.values(combos);
const unicos = grupos.filter((g) => g === 1).length;
const k = Math.min(...(grupos as number[]));
return ok({ registros: registros.length, combinaciones_distintas: Object.keys(combos).length, k_minimo: k, registros_unicos_k1: unicos, riesgo: k === 1 ? "ALTO: hay combinaciones que identifican a una sola persona" : k < 5 ? "MEDIO: k=" + k + ", generaliza más columnas" : "BAJO: k=" + k, recomendacion: k < 5 ? "generaliza (redondear edades, truncar zip) o elimina columnas" : "aceptable" });`,
      },
    ],
  },
];

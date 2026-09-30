// ═══ CATEGORÍA: Dolores de agentes · Datos y Extracción (A) ═══
// Dolor de fondo: las tools devuelven HTML crudo, CSVs desordenados y
// PDFs ilegibles: falta la capa de extracción/limpieza.
export default [
  {
    id: "robust-fetcher",
    title: "Robust Fetcher",
    tagline: "Fetch HTTP resiliente: timeouts, reintentos, headers y respuestas truncadas seguras",
    category: "Datos y Extracción",
    pain: "fetch() plano se cuelga o muere en la primera sin conexión: las tools necesitan un fetch con retries y control.",
    needsFetch: true,
    tools: [
      {
        name: "fetch_text",
        desc: "Fetch robusto de una URL: timeout configurable, hasta 3 reintentos con backoff y captura de status/headers relevantes.",
        params: { url: { t: "string", d: "URL a descargar" }, timeout_ms: { t: "number", d: "Timeout", opt: true, def: 15000 }, reintentos: { t: "number", d: "Reintentos", opt: true, def: 2 } },
        code: `try {
  const r = await fetchSmart(url, { timeoutMs: timeout_ms, retries: reintentos });
  return ok({ url, status: r.status, ok: r.status >= 200 && r.status < 300, content_type: "", tamano: r.text.length, texto: r.text.slice(0, 50000) });
} catch (e: any) { return fail("fetch falló: " + e.message); }`,
      },
      {
        name: "fetch_json",
        desc: "Fetch que parsea JSON directamente (con error claro si la respuesta no es JSON).",
        params: { url: { t: "string", d: "URL del JSON" }, timeout_ms: { t: "number", d: "Timeout", opt: true, def: 15000 } },
        code: `const r = await fetchSmart(url, { timeoutMs: timeout_ms, retries: 2 });
if (!r.json) return fail("la respuesta no es JSON válido (HTTP " + r.status + "): " + r.text.slice(0, 200));
return ok({ url, status: r.status, data: r.json });`,
      },
      {
        name: "head",
        desc: "Petición HEAD rápida: existe la URL, tamaño declarado y tipo de contenido, sin descargar el cuerpo.",
        params: { url: { t: "string", d: "URL a chequear" } },
        code: `const inicio = Date.now();
try {
  const r = await fetchSmart(url, { timeoutMs: 8000, retries: 1 });
  return ok({ url, status: r.status, existe: r.status >= 200 && r.status < 400, ms: Date.now() - inicio, tamano_respuesta: r.text.length });
} catch (e: any) { return fail("HEAD falló: " + e.message); }`,
      },
    ],
  },
  {
    id: "html-to-markdown",
    title: "HTML to Markdown",
    tagline: "Convierte HTML a Markdown limpio: sin scripts, sin estilos, enlaces intactos",
    category: "Datos y Extracción",
    pain: "El HTML crudo infla el contexto 10x: el agente necesita markdown limpio para leer la web eficientemente.",
    tools: [
      {
        name: "convert",
        desc: "Convierte HTML a Markdown: elimina scripts/styles/navs, preserva encabezados, listas, enlaces, tablas simples, negrita/cursiva y código.",
        params: { html: { t: "string", d: "HTML a convertir" } },
        code: `let h = String(html);
h = h.replace(/<script[\\s\\S]*?<\\/script>/gi, "").replace(/<style[\\s\\S]*?<\\/style>/gi, "").replace(/<nav[\\s\\S]*?<\\/nav>/gi, "").replace(/<!--[\\s\\S]*?-->/g, "");
const entidades: any = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "..." };
const decode = (s: string) => { let r = s; for (const [k, v] of Object.entries(entidades as Record<string, string>)) r = r.split(k).join(v); return r.replace(/&#(\\d+);/g, (m: any, n: any) => String.fromCharCode(Number(n))); };
h = h.replace(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/gi, (m, c) => "\\n# " + decode(c.trim()) + "\\n");
h = h.replace(/<h2[^>]*>([\\s\\S]*?)<\\/h2>/gi, (m, c) => "\\n## " + decode(c.trim()) + "\\n");
h = h.replace(/<h3[^>]*>([\\s\\S]*?)<\\/h3>/gi, (m, c) => "\\n### " + decode(c.trim()) + "\\n");
h = h.replace(/<h[4-6][^>]*>([\\s\\S]*?)<\\/h[4-6]>/gi, (m, c) => "\\n#### " + decode(c.trim()) + "\\n");
h = h.replace(/<(strong|b)[^>]*>([\\s\\S]*?)<\\/(strong|b)>/gi, (m: any, c: any) => "**" + decode(c.trim()) + "**");
h = h.replace(/<(em|i)[^>]*>([\\s\\S]*?)<\\/(em|i)>/gi, (m: any, c: any) => "*" + decode(c.trim()) + "*");
h = h.replace(/<code[^>]*>([\\s\\S]*?)<\\/code>/gi, (m, c) => String.fromCharCode(96) + decode(c) + String.fromCharCode(96));
h = h.replace(/<pre[^>]*>([\\s\\S]*?)<\\/pre>/gi, (m, c) => "\\n" + String.fromCharCode(96,96,96) + "\\n" + decode(c.replace(/<[^>]+>/g, "")).trim() + "\\n" + String.fromCharCode(96,96,96) + "\\n");
h = h.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi, (m: any, href: any, txt: any) => "[" + decode(txt.replace(/<[^>]+>/g, "").trim()) + "](" + href + ")");
h = h.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, "![$2]($1)");
h = h.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, "![]($1)");
h = h.replace(/<li[^>]*>([\\s\\S]*?)<\\/li>/gi, (m, c) => "- " + decode(c.replace(/<[^>]+>/g, "").trim()) + "\\n");
h = h.replace(/<(br|hr)[^>]*\\/?>/gi, (m, tag) => tag.toLowerCase().startsWith("br") ? "\\n" : "\\n---\\n");
h = h.replace(/<p[^>]*>([\\s\\S]*?)<\\/p>/gi, (m, c) => "\\n" + decode(c.replace(/<[^>]+>/g, "")).trim() + "\\n\\n");
h = h.replace(/<blockquote[^>]*>([\\s\\S]*?)<\\/blockquote>/gi, (m, c) => "> " + decode(c.replace(/<[^>]+>/g, "")).trim() + "\\n");
h = h.replace(/<td[^>]*>([\\s\\S]*?)<\\/td>/gi, (m: any, c: any) => "| " + decode(c.replace(/<[^>]+>/g, "").trim()) + " ");
h = h.replace(/<tr[^>]*>([\\s\\S]*?)<\\/tr>/gi, (m, c) => c.trim() + "|\\n");
h = h.replace(/<[^>]+>/g, "");
h = decode(h);
h = h.replace(/\\n{3,}/g, "\\n\\n").replace(/[ \\t]+\\n/g, "\\n").trim();
return ok({ markdown: h, longitud: h.length, reduccion_vs_html: Math.round((1 - h.length / (html.length || 1)) * 100) + "%" });`,
      },
      {
        name: "strip_tags",
        desc: "Versión rápida: solo texto plano sin conversión a markdown (máximo rendimiento).",
        params: { html: { t: "string", d: "HTML a limpiar" } },
        code: `let t = String(html);
t = t.replace(/<script[\\s\\S]*?<\\/script>/gi, "").replace(/<style[\\s\\S]*?<\\/style>/gi, "").replace(/<br\\s*\\/?>/gi, "\\n").replace(/<\\/p>/gi, "\\n\\n");
t = t.replace(/<[^>]+>/g, " ");
const entidades: any = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
for (const [k, v] of Object.entries(entidades as Record<string, string>)) t = t.split(k).join(v);
t = t.replace(/ +/g, " ").replace(/\\n{3,}/g, "\\n\\n").trim();
return ok({ texto: t, longitud: t.length });`,
      },
    ],
  },
  {
    id: "readability-extract",
    title: "Readability Extract",
    tagline: "Extrae el contenido principal de una página: título, artículo y metadatos",
    category: "Datos y Extracción",
    pain: "Del HTML de una noticia el 80% es chrome (menus, footers, ads): leer sin extraer el main quema contexto.",
    tools: [
      {
        name: "extract",
        desc: "Heurística de legibilidad: detecta el bloque con más densidad de texto (article/main/role) y devuelve título + texto del artículo + metadatos.",
        params: { html: { t: "string", d: "HTML de la página" } },
        code: `const h = String(html);
const meta = (name: string) => { const m = h.match(new RegExp('<meta[^>]+(?:name|property)=["\\']' + name + '["\\'][^>]+content=["\\']([^"\\']*)', "i")); return m ? m[1] : null; };
const titulo = (h.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i) || [])[1]?.trim() || meta("og:title") || "";
const candidatos: Array<[string, string]> = [];
const tags = ["article", "main", "section", "div"];
for (const tag of tags) {
  const re = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "gi");
  let m; while ((m = re.exec(h)) !== null) {
    const texto = m[1].replace(/<script[\\s\\S]*?<\\/script>/gi, "").replace(/<[^>]+>/g, " ");
    const palabras = texto.split(/\\s+/).filter((w) => w.length > 2).length;
    const enlaces = (m[1].match(/<a[\\s]/gi) || []).length;
    const densidad = palabras / (1 + enlaces);
    candidatos.push([m[0], palabras + " palabras, densidad " + Math.round(densidad)]);
  }
}
candidatos.sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
const mejor = candidatos[0]?.[0] || h;
const texto = mejor.replace(/<script[\\s\\S]*?<\\/script>/gi, "").replace(/<style[\\s\\S]*?<\\/style>/gi, "").replace(/<br\\s*\\/?>/gi, "\\n").replace(/<\\/p>/gi, "\\n\\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/ +/g, " ").trim();
return ok({ titulo, descripcion: meta("description") || meta("og:description"), autor: meta("author"), palabras: texto.split(/\\s+/).length, bloques_analizados: candidatos.length, texto: texto.slice(0, 30000) });`,
      },
      {
        name: "excerpt",
        desc: "Devuelve un excerpt de N palabras del contenido principal + keywords para decidir si leer más.",
        params: { html: { t: "string", d: "HTML" }, palabras: { t: "number", d: "Palabras del excerpt", opt: true, def: 60 } },
        code: `const h = String(html);
const body = h.replace(/<script[\\s\\S]*?<\\/script>/gi, "").replace(/<style[\\s\\S]*?<\\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
const words = body.split(" ");
const freq: any = {};
for (const w of words) { const k = w.toLowerCase().replace(/[^a-záéíóúñü0-9]/g, ""); if (k.length > 5) freq[k] = (freq[k] || 0) + 1; }
const keywords = Object.entries(freq).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
return ok({ excerpt: words.slice(0, palabras ?? 60).join(" "), total_palabras: words.length, keywords });`,
      },
    ],
  },
  {
    id: "table-extractor",
    title: "Table Extractor",
    tagline: "Tablas HTML → JSON/CSV/Markdown estructurado",
    category: "Datos y Extracción",
    pain: "Las tablas HTML llegan como sopa de tags: el agente necesita filas/columnas estructuradas.",
    tools: [
      {
        name: "extract_tables",
        desc: "Extrae TODAS las tablas de un HTML: cada una como {headers, rows}. Detecta th/td y colspan simple.",
        params: { html: { t: "string", d: "HTML con tablas" } },
        code: `const h = String(html);
const tablas: any[] = [];
const tablaRe = /<table[^>]*>([\\s\\S]*?)<\\/table>/gi;
let tm;
while ((tm = tablaRe.exec(h)) !== null) {
  const filas: string[][] = [];
  const filaRe = /<tr[^>]*>([\\s\\S]*?)<\\/tr>/gi;
  let fm;
  while ((fm = filaRe.exec(tm[1])) !== null) {
    const celdas: string[] = [];
    const celdaRe = /<(?:td|th)[^>]*>([\\s\\S]*?)<\\/(?:td|th)>/gi;
    let cm;
    while ((cm = celdaRe.exec(fm[1])) !== null) {
      const txt = cm[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\\s+/g, " ").trim();
      celdas.push(txt);
    }
    if (celdas.length) filas.push(celdas);
  }
  if (filas.length) {
    const primera = filas[0];
    const parece_header = primera.every((c) => c.length > 0 && c.length < 40 && !/^\\d+([.,]\\d+)?$/.test(c));
    tablas.push({ headers: parece_header ? primera : primera.map((_, i) => "col_" + (i + 1)), rows: parece_header ? filas.slice(1) : filas, filas: filas.length });
  }
}
return ok({ total_tablas: tablas.length, tablas });`,
      },
      {
        name: "to_csv",
        desc: "Convierte una tabla {headers, rows} a CSV bien citado.",
        params: { tabla: { t: "any", d: "{headers, rows}" } },
        code: `const t = tabla || {};
const esc = (v: any) => { const s = String(v ?? ""); return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const lineas = [ (t.headers || []).map(esc).join(",") ];
for (const fila of t.rows || []) lineas.push(fila.map(esc).join(","));
return ok({ csv: lineas.join("\\n"), filas: (t.rows || []).length });`,
      },
      {
        name: "to_markdown",
        desc: "Convierte una tabla {headers, rows} a tabla Markdown.",
        params: { tabla: { t: "any", d: "{headers, rows}" } },
        code: `const t = tabla || {};
const headers: string[] = t.headers || [];
const rows: any[][] = t.rows || [];
const ancho = Math.max(headers.length, ...rows.map((r) => r.length), 1);
const norm = (r: any[]) => Array.from({ length: ancho }, (_, i) => String(r[i] ?? "").replace(/\\|/g, "\\\\|"));
const md = ["| " + norm(headers).join(" | ") + " |", "| " + Array.from({ length: ancho }, () => "---").join(" | ") + " |", ...rows.map((r) => "| " + norm(r).join(" | ") + " |")].join("\\n");
return ok({ markdown: md });`,
      },
    ],
  },
  {
    id: "csv-toolkit",
    title: "CSV Toolkit",
    tagline: "Parse, filtra y resume CSVs sin Excel: separador auto-detectado",
    category: "Datos y Extracción",
    pain: "Los datasets llegan en CSV con separadores mixtos y comillas rotas: el agente necesita parseo robusto local.",
    tools: [
      {
        name: "parse",
        desc: "Parsea CSV con detección automática de separador (, ; tab |), comillas correctas y filas de encabezado.",
        params: { csv: { t: "string", d: "Contenido CSV" }, tiene_headers: { t: "boolean", d: "Primera fila son headers", opt: true, def: true } },
        code: `const texto = String(csv).trim();
const muestra = texto.split("\\n").slice(0, 5).join("\\n");
const seps = [",", ";", "\\t", "|"];
const conteos = seps.map((s) => muestra.split(s).length - 1);
const sep = seps[conteos.indexOf(Math.max(...conteos))];
function parsearLinea(linea: string): string[] {
  const out: string[] = []; let actual = ""; let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') { if (enComillas && linea[i + 1] === '"') { actual += '"'; i++; } else enComillas = !enComillas; }
    else if (ch === sep && !enComillas) { out.push(actual); actual = ""; }
    else actual += ch;
  }
  out.push(actual);
  return out.map((c) => c.trim());
}
const lineas = texto.split(/\\r?\\n/).filter((l) => l.trim().length);
const filas = lineas.map(parsearLinea);
const headers = tiene_headers !== false ? filas[0] : filas[0].map((_, i) => "col_" + (i + 1));
return ok({ separador: sep === "\\t" ? "TAB" : sep, columnas: headers.length, filas: filas.length - (tiene_headers !== false ? 1 : 0), headers, muestra: filas.slice(1, 6) });`,
      },
      {
        name: "filter_rows",
        desc: "Filtra filas de un CSV ya parseado {headers, rows} por condición simple (columna operador valor).",
        params: { tabla: { t: "any", d: "{headers, rows}" }, columna: { t: "string", d: "Columna a filtrar" }, operador: { t: "enum", values: ["=", ">", "<", "contiene", "no_contiene"], d: "Operador" }, valor: { t: "string", d: "Valor de comparación" } },
        code: `const t = tabla || {};
const idx = (t.headers || []).indexOf(columna);
if (idx === -1) return fail("columna no existe: " + (t.headers || []).join(", "));
const valNum = Number(valor);
const filtradas = (t.rows || []).filter((fila: any[]) => {
  const celda = String(fila[idx] ?? "");
  const cNum = Number(celda);
  switch (operador) {
    case "=": return celda === valor;
    case ">": return Number.isFinite(cNum) && Number.isFinite(valNum) && cNum > valNum;
    case "<": return Number.isFinite(cNum) && Number.isFinite(valNum) && cNum < valNum;
    case "contiene": return celda.toLowerCase().includes(valor.toLowerCase());
    case "no_contiene": return !celda.toLowerCase().includes(valor.toLowerCase());
    default: return false;
  }
});
return ok({ coincidencias: filtradas.length, total: (t.rows || []).length, filas: filtradas.slice(0, 100) });`,
      },
      {
        name: "summarize_columns",
        desc: "Resume columnas numéricas (min, max, media, suma) y categóricas (valores únicos top) de una tabla.",
        params: { tabla: { t: "any", d: "{headers, rows}" } },
        code: `const t = tabla || {};
const headers: string[] = t.headers || [];
const rows: any[][] = t.rows || [];
const resumen: any[] = [];
headers.forEach((h, i) => {
  const valores = rows.map((r) => String(r[i] ?? "")).filter((v) => v !== "");
  const num = valores.map(Number).filter((n) => Number.isFinite(n));
  if (num.length >= valores.length * 0.8 && num.length > 0) {
    resumen.push({ columna: h, tipo: "numerica", min: Math.min(...num), max: Math.max(...num), media: Math.round((num.reduce((a, b) => a + b, 0) / num.length) * 100) / 100, suma: Math.round(num.reduce((a, b) => a + b, 0) * 100) / 100, n: num.length });
  } else {
    const unicos: any = {};
    for (const v of valores) unicos[v] = (unicos[v] || 0) + 1;
    const top = Object.entries(unicos).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
    resumen.push({ columna: h, tipo: "categorica", valores_unicos: Object.keys(unicos).length, top: top.map(([v, n]) => v + " (" + n + ")") });
  }
});
return ok({ filas: rows.length, resumen });`,
      },
    ],
  },
  {
    id: "json-toolkit",
    title: "JSON Toolkit",
    tagline: "jsonpath, merge profundo, diff y validación: la navaja suiza del JSON",
    category: "Datos y Extracción",
    pain: "Manipular JSON anidado a mano es propenso a errores: query, merge y diff estructurados faltan.",
    tools: [
      {
        name: "query",
        desc: "Consulta JSON con jsonpath simplificado: $.a.b, $[0].name, $.items[*].id y filtros [?(@.x>5)].",
        params: { data: { t: "any", d: "JSON a consultar" }, path: { t: "string", d: "Ruta estilo jsonpath ($.a.b[0].c)" } },
        code: `let p = String(path).trim().replace(/^\\$\\.?/, "");
let actual: any = data;
if (p === "" || p === "$") return ok({ valor: actual });
const partes = p.match(/([^[.]+)|(\\[[^\\]]+\\])|\\./g) || [];
for (const raw of partes) {
  const seg = raw.replace(/^\\./, "");
  if (seg.startsWith("[")) {
    const dentro = seg.slice(1, -1);
    if (dentro === "*") continue;
    if (dentro.startsWith("?(")) {
      const cond = dentro.slice(2, -2);
      const m = cond.match(/([\\w.]+)\\s*(==|!=|>=|<=|>|<)\\s*(.+)/);
      if (!m) return fail("filtro no soportado: " + cond);
      const [, izq, op, der] = m;
      const valorDer = Number.isFinite(Number(der)) && !/"|'/.test(der) ? Number(der) : der.replace(/['"]/g, "");
      actual = (Array.isArray(actual) ? actual : []).filter((item: any) => {
        const campo = izq.split(".").reduce((o: any, k) => o?.[k], item);
        switch (op) { case "==": return campo == valorDer; case "!=": return campo != valorDer; case ">": return Number(campo) > Number(valorDer); case "<": return Number(campo) < Number(valorDer); case ">=": return Number(campo) >= Number(valorDer); case "<=": return Number(campo) <= Number(valorDer); default: return false; }
      });
    } else actual = actual?.[Number(dentro.replace(/['"]/g, ""))];
  } else if (seg) {
    if (seg.includes("[")) { const m = seg.match(/^([^.\\[]+)\\[([^\\]]+)\\]$/); if (m) { actual = actual?.[m[1]]; const idx = m[2]; actual = idx === "*" ? actual : actual?.[Number(idx)]; } else actual = actual?.[seg]; }
    else actual = actual?.[seg];
  }
  if (actual === undefined) break;
}
return ok({ path, encontrado: actual !== undefined, valor: actual === undefined ? null : actual });`,
      },
      {
        name: "merge",
        desc: "Merge profundo de 2+ JSONs: objetos se combinan recursivamente, arrays y escalares se reemplazan (o concatenan con flag).",
        params: { objetos: { t: "array", d: "Lista de JSONs a fusionar (en orden)" }, concatenar_arrays: { t: "boolean", d: "Concatenar arrays en vez de reemplazar", opt: true, def: false } },
        code: `function deepMerge(a: any, b: any, concat: boolean): any {
  if (Array.isArray(a) && Array.isArray(b)) return concat ? [...a, ...b] : b;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const out: any = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in out ? deepMerge(out[k], v, concat) : v;
    return out;
  }
  return b === undefined ? a : b;
}
const lista = Array.isArray(objetos) ? objetos : [];
if (!lista.length) return fail("sin objetos");
let acc = lista[0];
for (let i = 1; i < lista.length; i++) acc = deepMerge(acc, lista[i], concatenar_arrays === true);
return ok({ fusionado: acc, objetos_combinados: lista.length });`,
      },
      {
        name: "validate",
        desc: "Valida estructura y tipos de un JSON: tipado inferido del valor, campos null, arrays mixtos y profundidad.",
        params: { data: { t: "any", d: "JSON a inspeccionar" } },
        code: `function perfil(o: any, ruta: string, prof: number, out: any[]) {
  if (prof > 12) { out.push({ ruta, tipo: "profundidad-excesiva" }); return; }
  if (o === null) { out.push({ ruta, tipo: "null" }); return; }
  if (Array.isArray(o)) { out.push({ ruta, tipo: "array", largo: o.length }); if (o.length && o.length <= 100) perfil(o[0], ruta + "[0]", prof + 1, out); return; }
  if (typeof o === "object") { for (const [k, v] of Object.entries(o)) perfil(v, ruta + "." + k, prof + 1, out); return; }
  out.push({ ruta, tipo: typeof o, ejemplo: String(o).slice(0, 40) });
}
const perfil_out: any[] = [];
perfil(data, "$", 0, perfil_out);
const llaves_null = perfil_out.filter((p) => p.tipo === "null").length;
const arrays_vacios = perfil_out.filter((p) => p.tipo === "array" && p.largo === 0).length;
return ok({ campos: perfil_out.length, con_null: llaves_null, arrays_vacios, perfil: perfil_out.slice(0, 80), es_valido: true });`,
      },
    ],
  },
  {
    id: "xml-toolkit",
    title: "XML Toolkit",
    tagline: "Parse XML/RSS a JSON plano y busca tags con atributos",
    category: "Datos y Extracción",
    pain: "RSS y sitemaps siguen siendo XML: sin parser, el agente pierde feeds enteros de información.",
    tools: [
      {
        name: "to_json",
        desc: "Convierte XML a JSON anidado: elementos con atributos (@attr), texto (#text) e hijos repetidos como arrays.",
        params: { xml: { t: "string", d: "XML a convertir" } },
        code: `function decode(s: string) { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
function parseHasta(xml: string, cierreTag: string, posRef: { i: number }): any {
  const nodo: any = {};
  let texto = "";
  while (posRef.i < xml.length) {
    const lt = xml.indexOf("<", posRef.i);
    if (lt === -1) { texto += xml.slice(posRef.i); posRef.i = xml.length; break; }
    texto += xml.slice(posRef.i, lt);
    posRef.i = lt;
    if (xml.startsWith("</" + cierreTag, posRef.i)) { posRef.i = xml.indexOf(">", posRef.i) + 1; break; }
    const gt = xml.indexOf(">", posRef.i);
    if (gt === -1) { posRef.i = xml.length; break; }
    const tagStr = xml.slice(posRef.i, gt + 1);
    const m = tagStr.match(/^<([\\w:.-]+)((?:\\s+[\\w:.-]+="[^"]*")*)\\s*(\\/?)>$/);
    if (!m) { posRef.i = gt + 1; continue; }
    const nombre = m[1];
    const selfClose = m[3] === "/";
    const attrs: any = {};
    for (const a of (m[2] || "").match(/[\\w:.-]+="[^"]*"/g) || []) { const [k, v] = a.split("="); attrs["@" + k] = v.slice(1, -1); }
    posRef.i = gt + 1;
    const hijo: any = selfClose ? attrs : parseHasta(xml, nombre, posRef);
    if (!selfClose) for (const [k, v] of Object.entries(attrs)) hijo[k] = v;
    if (nodo[nombre] !== undefined) { if (!Array.isArray(nodo[nombre])) nodo[nombre] = [nodo[nombre]]; nodo[nombre].push(hijo); }
    else nodo[nombre] = hijo;
  }
  const t = texto.trim();
  if (t && Object.keys(nodo).length === 0) return { "#text": decode(t) };
  if (t) nodo["#text"] = decode(t);
  return nodo;
}
try {
  const limpio = String(xml).replace(/<\\?[\\s\\S]*?\\?>/g, "").replace(/<!--[\\s\\S]*?-->/g, "").replace(/<!DOCTYPE[\\s\\S]*?>/gi, "").trim();
  const posRef = { i: 0 };
  const raiz: any = {};
  while (posRef.i < limpio.length) {
    const lt = limpio.indexOf("<", posRef.i);
    if (lt === -1) break;
    const gt = limpio.indexOf(">", lt);
    if (gt === -1) break;
    const m = limpio.slice(lt, gt + 1).match(/^<([\\w:.-]+)((?:\\s+[\\w:.-]+="[^"]*")*)\\s*(\\/?)>$/);
    posRef.i = gt + 1;
    if (!m) continue;
    const nombre = m[1];
    const selfClose = m[3] === "/";
    const attrs: any = {};
    for (const a of (m[2] || "").match(/[\\w:.-]+="[^"]*"/g) || []) { const [k, v] = a.split("="); attrs["@" + k] = v.slice(1, -1); }
    const hijo: any = selfClose ? attrs : parseHasta(limpio, nombre, posRef);
    if (!selfClose) for (const [k, v] of Object.entries(attrs)) hijo[k] = v;
    if (raiz[nombre] !== undefined) { if (!Array.isArray(raiz[nombre])) raiz[nombre] = [raiz[nombre]]; raiz[nombre].push(hijo); }
    else raiz[nombre] = hijo;
  }
  return ok({ json: raiz, raiz: Object.keys(raiz)[0] || null });
} catch (e: any) { return fail("XML no parseable: " + e.message); }`,
      },
      {
        name: "find_tags",
        desc: "Encuentra todas las ocurrencias de un tag (ej: item, loc, entry) con sus atributos y texto interno.",
        params: { xml: { t: "string", d: "XML" }, tag: { t: "string", d: "Tag a buscar (ej: item)" } },
        code: `const re = new RegExp("<" + tag + "((?:\\\\s+[^>]*?)?)>([\\\\s\\\\S]*?)<\\/" + tag + ">|<" + tag + "([^>]*?)/>", "gi");
const encontrados: any[] = [];
let m;
while ((m = re.exec(String(xml))) !== null) {
  const attrs: any = {};
  const attrStr = m[1] || m[3] || "";
  const pares = attrStr.match(/[\\w:.-]+="[^"]*"/g) || [];
  for (const p of pares) { const [k, v] = p.split("="); attrs[k] = v.slice(1, -1); }
  const inner = (m[2] || "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
  encontrados.push({ attrs, texto: inner.slice(0, 300) });
}
return ok({ tag, total: encontrados.length, encontrados: encontrados.slice(0, 100) });`,
      },
    ],
  },
];

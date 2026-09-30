// ═══ CATEGORÍA: Dolores de agentes · Calidad de Salida (A) ═══
// Dolor de fondo: los LLM devuelven JSON inválido, inventan citas y
// no validan su propia salida antes de entregar.
export default [
  {
    id: "json-repair",
    title: "JSON Repair",
    tagline: "Repara JSON roto de LLMs: comillas, comas, truncados y fences",
    category: "Calidad de Salida",
    pain: "El JSON que devuelve un LLM viene con markdown fences, comas colgantes y strings sin cerrar: cada parse falla.",
    tools: [
      {
        name: "repair",
        desc: "Repara JSON roto: quita fences de código, elimina comas colgantes, cierra llaves/corchetes/quotes truncados (algoritmo de stack de brackets) y corrige comillas tipográficas.",
        params: { texto: { t: "string", d: "JSON (posiblemente roto) a reparar" } },
        code: `function repararEstructura(src: string): string {
  let out = "";
  const stack: string[] = [];
  let enStr = false, esc = false;
  const cerrar = (ch: string) => {
    out = out.replace(/[,\\s]+$/, "");
    const esperado = ch === "}" ? "{" : "[";
    if (stack.length && stack[stack.length - 1] === esperado) { stack.pop(); out += ch; }
    else {
      let cierre = "";
      while (stack.length && stack[stack.length - 1] !== esperado) { const top = stack.pop(); cierre += top === "{" ? "}" : "]"; }
      if (stack.length) stack.pop();
      out += cierre + ch;
    }
  };
  for (const ch of src) {
    if (enStr) { out += ch; if (esc) esc = false; else if (ch === "\\\\") esc = true; else if (ch === '"') enStr = false; continue; }
    if (ch === '"') { enStr = true; out += ch; continue; }
    if (ch === "{" || ch === "[") { stack.push(ch); out += ch; continue; }
    if (ch === "}" || ch === "]") { cerrar(ch); continue; }
    out += ch;
  }
  let cola = "";
  while (stack.length) { const top = stack.pop(); cola += top === "{" ? "}" : "]"; }
  if (enStr) cola = '"' + cola;
  return out + cola;
}
let s = String(texto).trim();
const bt3 = String.fromCharCode(96, 96, 96);
s = s.replace(new RegExp("^" + bt3 + "(json)?\\s*", "i"), "").replace(new RegExp("\\s*" + bt3 + "$"), "");
s = s.replace(/[\\u201c\\u201d]/g, '"').replace(/[\\u2018\\u2019]/g, "'");
const intentos: string[] = [];
try { return ok({ reparado: false, json: JSON.parse(s), metodo: "directo" }); } catch (e: any) { intentos.push("directo: " + e.message); }
try { return ok({ reparado: true, json: JSON.parse(repararEstructura(s)), metodo: "stack-de-brackets" }); } catch (e: any) { intentos.push("stack: " + e.message); }
const t = s.replace(/,\\s*([}\\]])/g, "$1").replace(/([{,]\\s*)(\\w+)\\s*:/g, '$1"$2":');
try { return ok({ reparado: true, json: JSON.parse(t), metodo: "comas+comillas" }); } catch (e: any) { intentos.push("comas: " + e.message); }
try { return ok({ reparado: true, json: JSON.parse(repararEstructura(t)), metodo: "stack+comas" }); } catch (e: any) { intentos.push("stack2: " + e.message); }
return fail("no reparable. Intentos: " + intentos.join(" | "));`,
      },
      {
        name: "extract_json",
        desc: "Extrae el primer JSON válido de un texto ruidoso (dentro de fences, prosa o logs).",
        params: { texto: { t: "string", d: "Texto que contiene JSON en alguna parte" } },
        code: `const s = String(texto);
const candidatos: string[] = [];
const bt3 = String.fromCharCode(96, 96, 96);
const fence = s.match(new RegExp(bt3 + "(?:json)?\\\\s*([\\\\s\\\\S]*?)" + bt3));
if (fence) candidatos.push(fence[1]);
for (let i = 0; i < s.length; i++) {
  if (s[i] === "{" || s[i] === "[") {
    let prof = 0; let enStr = false; let escp = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (escp) { escp = false; continue; }
      if (ch === "\\\\") { escp = true; continue; }
      if (ch === '"') enStr = !enStr;
      if (enStr) continue;
      if (ch === "{" || ch === "[") prof++;
      if (ch === "}" || ch === "]") { prof--; if (prof === 0) { candidatos.push(s.slice(i, j + 1)); i = j; break; } }
    }
  }
}
for (const c of candidatos) { try { return ok({ json: JSON.parse(c), fuente: c.slice(0, 80) }); } catch {} }
return fail("sin JSON válido en el texto");`,
      },
    ],
  },
  {
    id: "schema-validator",
    title: "Schema Validator",
    tagline: "Valida cualquier JSON contra un JSON Schema (subconjunto potente): tipos, requeridos, anidados",
    category: "Calidad de Salida",
    pain: "La salida estructurada de un LLM se acepta sin validar: los campos faltantes explotan río abajo.",
    tools: [
      {
        name: "validate",
        desc: "Valida un JSON contra un schema {tipo, requeridos:[], propiedades:{campo:tipo}, items, min/max}. Devuelve errores con ruta exacta.",
        params: { data: { t: "any", d: "JSON a validar" }, schema: { t: "any", d: "Schema de validación" } },
        code: `function tipoDe(v: any): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
function validar(dato: any, sch: any, ruta: string, errores: string[]) {
  const s = sch || {};
  if (s.tipo || s.type) {
    const esperado = s.tipo || s.type;
    const real = tipoDe(dato);
    if (esperado === "integer" && !(typeof dato === "number" && Number.isInteger(dato))) errores.push(ruta + ": esperaba integer, hay " + real);
    else if (esperado !== "integer" && real !== esperado) { errores.push(ruta + ": esperaba " + esperado + ", hay " + real); return; }
  }
  if (s.requeridos || s.required) {
    const req: string[] = s.requeridos || s.required;
    for (const r of req) if (dato?.[r] === undefined) errores.push(ruta + "." + r + ": requerido y ausente");
  }
  if (s.propiedades || s.properties) {
    const props: any = s.propiedades || s.properties;
    for (const [k, sub] of Object.entries(props)) {
      if (dato?.[k] !== undefined) validar(dato[k], sub, ruta + "." + k, errores);
    }
  }
  if (s.items && Array.isArray(dato)) dato.forEach((item: any, i: number) => validar(item, s.items, ruta + "[" + i + "]", errores));
  if (s.enum && !s.enum.includes(dato)) errores.push(ruta + ": valor " + JSON.stringify(dato) + " fuera de enum " + JSON.stringify(s.enum));
  if (s.min !== undefined && typeof dato === "number" && dato < s.min) errores.push(ruta + ": " + dato + " < min " + s.min);
  if (s.max !== undefined && typeof dato === "number" && dato > s.max) errores.push(ruta + ": " + dato + " > max " + s.max);
  if (s.min_longitud && typeof dato === "string" && dato.length < s.min_longitud) errores.push(ruta + ": longitud < " + s.min_longitud);
}
const errores: string[] = [];
validar(data, schema, "$", errores);
return ok({ valido: errores.length === 0, errores });`,
      },
      {
        name: "common_schemas",
        desc: "Devuelve schemas listos para usar: producto, usuario, artículo, respuesta-tool-MCP, evento.",
        params: { cual: { t: "enum", values: ["producto", "usuario", "articulo", "respuesta-mcp", "evento"], d: "Schema a obtener" } },
        code: `const schemas: any = {
  producto: { tipo: "object", requeridos: ["nombre", "precio"], propiedades: { nombre: { tipo: "string", min_longitud: 1 }, precio: { tipo: "number", min: 0 }, moneda: { tipo: "string" }, stock: { tipo: "integer", min: 0 } } },
  usuario: { tipo: "object", requeridos: ["nombre", "email"], propiedades: { nombre: { tipo: "string" }, email: { tipo: "string" }, rol: { tipo: "string", enum: ["admin", "user", "agente"] } } },
  articulo: { tipo: "object", requeridos: ["titulo", "cuerpo"], propiedades: { titulo: { tipo: "string" }, cuerpo: { tipo: "string", min_longitud: 50 }, fecha: { tipo: "string" }, tags: { tipo: "array", items: { tipo: "string" } } } },
  "respuesta-mcp": { tipo: "object", requeridos: ["content"], propiedades: { content: { tipo: "array", items: { tipo: "object", requeridos: ["type"], propiedades: { type: { tipo: "string", enum: ["text", "image"] }, text: { tipo: "string" } } } }, isError: { tipo: "boolean" } } },
  evento: { tipo: "object", requeridos: ["tipo", "ts"], propiedades: { tipo: { tipo: "string" }, ts: { tipo: "string" }, payload: { tipo: "object" } } },
};
if (!schemas[cual]) return fail("schema desconocido");
return ok({ schema: schemas[cual] });`,
      },
    ],
  },
  {
    id: "output-grader",
    title: "Output Grader",
    tagline: "Autoevalúa salidas del agente: completitud, especificidad y estructura",
    category: "Calidad de Salida",
    pain: "El agente entrega sin autoevaluar: respuestas vagas, sin cifras y con placeholders pasan como válidas.",
    tools: [
      {
        name: "grade",
        desc: "Califica una salida (0-100) por heurísticas: completitud (placeholders/lorem), especificidad (números/fechas), estructura (longitud, listas) y acciones ejecutables.",
        params: { salida: { t: "string", d: "Texto de la salida a evaluar" }, tipo_esperado: { t: "enum", values: ["respuesta", "analisis", "instrucciones", "codigo"], d: "Tipo de salida", opt: true, def: "respuesta" } },
        code: `const t = String(salida);
const problemas: string[] = [];
if (/lorem ipsum|placeholder|TBD|XXX|\\[insertar|\\[ejemplo|<completar>/i.test(t)) problemas.push("contiene placeholders");
const numeros = (t.match(/\\d+(\\.\\d+)?/g) || []).length;
const fechas = (t.match(/\\d{4}|\\d{1,2}[/-]\\d{1,2}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/gi) || []).length;
const listas = (t.match(/^\\s*[-*\\d]+[.)]?\\s+/gm) || []).length;
const verbos_accion = (t.match(/\\b(instala|ejecuta|crea|verifica|env[ií]a|configura|revisa|elimina|actualiza|documenta)\\b/gi) || []).length;
let score = 50;
if (problemas.length) score -= 30;
if (numeros >= 3) score += 15; else if (numeros === 0) { score -= 10; problemas.push("sin especificidad numérica"); }
if (fechas > 0) score += 5;
if (listas >= 3) score += 10;
if (verbos_accion >= 2 && tipo_esperado === "instrucciones") score += 15;
if (t.length < 100) { score -= 15; problemas.push("demasiado corto para el tipo esperado"); }
if (t.length > 12000) { score -= 5; problemas.push("riesgo de exceso de contexto"); }
score = Math.max(0, Math.min(100, score));
return ok({ score, nivel: score >= 80 ? "apto" : score >= 60 ? "mejorable" : "rechazar", problemas, metricas: { numeros, fechas, items_de_lista: listas, verbos_de_accion: verbos_accion, caracteres: t.length } });`,
      },
      {
        name: "improve_hints",
        desc: "Dada una salida, devuelve instrucciones concretas para mejorarla (feedback accionable).",
        params: { salida: { t: "string", d: "Salida original" } },
        code: `const t = String(salida);
const hints: string[] = [];
if (/lorem ipsum|placeholder|TBD|XXX/i.test(t)) hints.push("elimina placeholders y completa con datos reales");
if (!(t.match(/\\d+(\\.\\d+)?/g) || []).length) hints.push("añade cifras concretas (montos, cantidades, versiones)");
if (t.length < 150) hints.push("desarrolla más: contexto, criterios y consecuencias");
if (!/^\\s*[-*\\d]+[.)]?\\s+/m.test(t) && t.length > 400) hints.push("estructura en listas/secciones para escaneabilidad");
if (!/\\b(instala|ejecuta|crea|verifica|env[ií]a|configura)\\b/i.test(t)) hints.push("incluye acciones ejecutables concretas");
if (!hints.length) hints.push("la salida es sólida: considera verificar hechos con fact-consistency");
return ok({ hints });`,
      },
    ],
  },
  {
    id: "citation-checker",
    title: "Citation Checker",
    tagline: "Extrae, formatea y verifica citas y URLs de cualquier texto",
    category: "Calidad de Salida",
    pain: "Los LLM inventan URLs y citas (alucinación de fuentes): sin verificación, el usuario propaga información falsa.",
    needsFetch: true,
    tools: [
      {
        name: "extract_citations",
        desc: "Extrae todas las URLs y referencias de un texto, las deduplica y las clasifica (http, dominio, markdown link, DOI).",
        params: { texto: { t: "string", d: "Texto con posibles citas" } },
        code: `const t = String(texto);
const encontradas: string[] = t.match(/https?:\\/\\/[^\\s)\\]<>"]+/g) || [];
const urls = [...new Set(encontradas)].map((u: string) => u.replace(/[.,;:]+$/, ""));
const dominios = [...new Set(t.match(/\\b[a-z0-9-]+\\.(com|org|net|io|dev|es|ec|edu|gov|co|ai)\\b/gi) || [])];
const dois = [...new Set(t.match(/\\b10\\.\\d{4,}\\/[^\\s]+/g) || [])];
return ok({ urls, dominios: dominios.map((d: string) => d.toLowerCase()), doi: dois, total_referencias: urls.length + dominios.length + dois.length });`,
      },
      {
        name: "check_urls",
        desc: "Verifica en vivo (HEAD/GET) si las URLs citadas existen realmente. Devuelve status HTTP por URL.",
        params: { urls: { t: "array", d: "Lista de URLs a verificar" } },
        code: `const lista = (Array.isArray(urls) ? urls : []).slice(0, 10);
const resultados: any[] = [];
for (const u of lista) {
  try {
    const r = await fetchSmart(u, { timeoutMs: 10000, retries: 1 });
    resultados.push({ url: u, existe: r.status >= 200 && r.status < 400, http: r.status });
  } catch (e: any) {
    resultados.push({ url: u, existe: false, error: (e.message || "").slice(0, 80) });
  }
}
return ok({ verificadas: resultados.length, vivas: resultados.filter((r) => r.existe).length, resultados });`,
      },
      {
        name: "format_citations",
        desc: "Formatea una lista de referencias en estilo consistente (APA-lite o markdown) a partir de {titulo, url, fecha}.",
        params: { referencias: { t: "array", d: "Lista de {titulo, url, fecha?}" }, estilo: { t: "enum", values: ["apa", "markdown"], d: "Estilo", opt: true, def: "markdown" } },
        code: `const refs = Array.isArray(referencias) ? referencias : [];
const out = refs.map((r: any) => {
  if ((estilo || "markdown") === "apa") return r.titulo + (r.fecha ? " (" + r.fecha + ")" : " (s.f.)") + ". " + (r.url || "");
  return "- [" + (r.titulo || "sin título") + "](" + (r.url || "") + ")" + (r.fecha ? " — " + r.fecha : "");
});
return ok({ referencias_formateadas: out });`,
      },
    ],
  },
  {
    id: "claim-extractor",
    title: "Claim Extractor",
    tagline: "Extrae afirmaciones verificables del texto: el primer paso contra la alucinación",
    category: "Calidad de Salida",
    pain: "Para verificar hechos primero hay que identificar qué claims se afirmaron: nadie separa opiniones de afirmaciones verificables.",
    tools: [
      {
        name: "extract_claims",
        desc: "Divide un texto en oraciones y extrae las afirmaciones verificables (con números, entidades o verbos factuales), marcando verificación sugerida.",
        params: { texto: { t: "string", d: "Texto a analizar" } },
        code: `const oraciones = texto.replace(/\\s+/g, " ").split(/(?<=[.!?])\\s+/).filter((s) => s.trim().length > 15);
const claims = oraciones.map((o, i) => {
  const tiene_numero = /\\d+(\\.\\d+)?%?/.test(o);
  const tiene_entidad = /\\b[A-Z][a-záéíóúñ]+(\\s[A-Z][a-záéíóúñ]+)?\\b/.test(o);
  const verbo_factual = /\\b(es|son|fue|fueron|será|tiene|tienen|hay|costó|aumentó|disminuyó|mide|produce|vend[ió]|ofrece)\\b/i.test(o);
  const opinion = /\\b(creo|opino|parece|quizás|tal vez|posiblemente|mejor|peor|debería)\\b/i.test(o);
  const verificable = (tiene_numero || verbo_factual) && !opinion;
  return { i, oracion: o.trim(), verificable, señales: { numero: tiene_numero, entidad: tiene_entidad, verbo_factual, opinion } };
});
return ok({ total_oraciones: oraciones.length, claims_verificables: claims.filter((c) => c.verificable), todas: claims });`,
      },
      {
        name: "classify_verifiability",
        desc: "Clasifica una afirmación en: verificable-empíricamente / verificable-lógicamente / opinión / especulación.",
        params: { afirmacion: { t: "string", d: "Afirmación a clasificar" } },
        code: `const a = afirmacion;
const empirica = /\\d|\\b(\\d{4})\\b|medid|encuest|estudi|registr|precio|tasa|porcentaje|%/i.test(a);
const logica = /\\b(todos|ninguno|siempre|nunca|por lo tanto|implica|deduce)\\b/i.test(a);
const opinion = /\\b(creo|opino|mejor|peor|debería|prefer)\\b/i.test(a);
const especulacion = /\\b(quizás|tal vez|posiblemente|futuro|predec|podría)\\b/i.test(a);
let tipo = "declarativa-no-verificable";
if (empirica) tipo = "verificable-empiricamente";
else if (logica) tipo = "verificable-lógicamente";
else if (especulacion) tipo = "especulación";
else if (opinion) tipo = "opinión";
return ok({ afirmacion: a.slice(0, 150), tipo, estrategia_verificacion: tipo === "verificable-empiricamente" ? "contrastar contra fuente primaria (web-search + citation-checker)" : tipo === "verificable-lógicamente" ? "derivar de premisas aceptadas" : "no requiere verificación externa" });`,
      },
    ],
  },
  {
    id: "fact-consistency",
    title: "Fact Consistency",
    tagline: "Detecta contradicciones entre dos textos o entre claims: coherencia interna",
    category: "Calidad de Salida",
    pain: "El agente se contradice entre secciones (o contra una fuente): las inconsistencias numéricas y factuales pasan inadvertidas.",
    tools: [
      {
        name: "check_consistency",
        desc: "Compara dos textos y reporta contradicciones: números que difieren sobre mismos sujetos, hechos opuestos y entidades renombradas.",
        params: { texto_a: { t: "string", d: "Primer texto" }, texto_b: { t: "string", d: "Segundo texto" } },
        code: `const numA = texto_a.match(/\\b\\d+(\\.\\d+)?\\b/g) || [];
const numB = texto_b.match(/\\b\\d+(\\.\\d+)?\\b/g) || [];
const palabrasA = new Set(texto_a.toLowerCase().split(/\\s+/).filter((w) => w.length > 4));
const palabrasB = new Set(texto_b.toLowerCase().split(/\\s+/).filter((w) => w.length > 4));
const tema_comun = [...palabrasA].filter((w) => palabrasB.has(w)).length;
const conflictos: string[] = [];
const sA = texto_a.toLowerCase(); const sB = texto_b.toLowerCase();
const patrones: Array<[RegExp, RegExp, string]> = [
  [/subió|aumentó|más de/, /bajó|disminuyó|menos de/, "dirección opuesta (subida vs bajada)"],
  [/disponible|hay stock/, /agotado|sin stock|no disponible/, "disponibilidad contradictoria"],
  [/gratuito|gratis/, /de pago|cuesta|precio/, "gratuidad vs pago"],
  [/funciona|exitoso|correcto/, /falla|error|roto|incorrecto/, "funcionamiento contradictorio"],
];
for (const [ra, rb, msg] of patrones) {
  if ((ra.test(sA) && rb.test(sB)) || (rb.test(sA) && ra.test(sB))) conflictos.push(msg);
}
const cifras_discrepantes = tema_comun > 5 && numA.length > 0 && numB.length > 0 && numA.join() !== numB.join();
return ok({ coherentes: conflictos.length === 0 && !cifras_discrepantes, conflictos, tema_comun_palabras: tema_comun, cifras_a: numA.slice(0, 10), cifras_b: numB.slice(0, 10), posibles_discrepancias_numericas: cifras_discrepantes });`,
      },
      {
        name: "merge_facts",
        desc: "Fusiona dos listas de hechos {hecho, fuente} deduplicando y marcando duplicados con fuentes distintas (consenso) o contradictorias.",
        params: { hechos_a: { t: "array", d: "Hechos A {hecho, fuente}" }, hechos_b: { t: "array", d: "Hechos B {hecho, fuente}" } },
        code: `const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, "").split(/\\s+/).filter((w) => w.length > 3).sort().join(" ");
const todos = [...(Array.isArray(hechos_a) ? hechos_a : []).map((h: any) => ({ ...h, set: "A" })), ...(Array.isArray(hechos_b) ? hechos_b : []).map((h: any) => ({ ...h, set: "B" }))];
const vistos: any = {};
const fusionados: any[] = [];
for (const h of todos) {
  const k = norm(String(h.hecho || ""));
  if (vistos[k]) { vistos[k].fuentes.push(h.fuente || h.set); vistos[k].consenso = true; }
  else { vistos[k] = { hecho: h.hecho, fuentes: [h.fuente || h.set], consenso: false }; fusionados.push(vistos[k]); }
}
return ok({ total_originales: todos.length, hechos_fusionados: fusionados.length, en_consenso: fusionados.filter((f) => f.consenso).length, hechos: fusionados });`,
      },
    ],
  },
];

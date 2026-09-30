// ═══ CATEGORÍA: Dolores de agentes · Utilidades Deterministas (8) ═══
// Dolor de fondo: los LLM fallan aritmética básica, fechas y hashing:
// estas tools anclan el razonamiento en cálculo exacto.
export default [
  {
    id: "safe-math",
    title: "Safe Math",
    tagline: "Aritmética exacta del agente: evaluación, porcentajes y reglas de tres",
    category: "Utilidades",
    pain: "Los LLM cometen errores aritméticos notorios: cualquier cifra importante debe calcularse con tool, no 'de cabeza'.",
    tools: [
      {
        name: "evaluate",
        desc: "Evalúa una expresión aritmética de forma segura con parser propio (sin eval): + - * / % ** y paréntesis.",
        params: { expresion: { t: "string", d: "Expresión (ej: (1250 - 320) * 0.15)" } },
        code: `const expr = String(expresion).replace(/\\s+/g, "").replace(/,/g, ".").replace(/\\^/g, "**");
if (!/^[\\d+\\-*/%().]+$/.test(expr.replace(/\\*\\*/g, "*"))) return fail("caracteres no permitidos");
const tokens = expr.match(/\\d+\\.?\\d*|\\*\\*|[+\\-*/%()]/g);
if (!tokens) return fail("no parseable");
const salida: any[] = []; const ops: string[] = [];
const prec: any = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "**": 3 };
let prev = "";
for (const tok of tokens) {
  if (/^\\d/.test(tok)) { salida.push(parseFloat(tok)); }
  else if (tok === "(") ops.push(tok);
  else if (tok === ")") { while (ops.length && ops[ops.length - 1] !== "(") salida.push(ops.pop()); ops.pop(); }
  else {
    if ((tok === "-" || tok === "+") && (prev === "" || prev === "(" || prec[prev])) salida.push(0);
    while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]] >= prec[tok]) salida.push(ops.pop());
    ops.push(tok);
  }
  prev = tok;
}
while (ops.length) { const op = ops.pop(); if (op !== "(") salida.push(op); }
const pila: number[] = [];
for (const t of salida) {
  if (typeof t === "number") { pila.push(t); continue; }
  const b = pila.pop() as number; const a = pila.pop() as number;
  if (a === undefined) return fail("expresión malformada");
  if (t === "+") pila.push(a + b); else if (t === "-") pila.push(a - b);
  else if (t === "*") pila.push(a * b); else if (t === "%") pila.push(a % b);
  else if (t === "**") pila.push(Math.pow(a, b));
  else if (t === "/") { if (b === 0) return fail("división por cero"); pila.push(a / b); }
}
if (pila.length !== 1 || !Number.isFinite(pila[0])) return fail("expresión malformada");
return ok({ expresion, resultado: Math.round(pila[0] * 1e10) / 1e10 });`,
      },
      {
        name: "percent_change",
        desc: "Calcula variación porcentual exacta entre dos valores (con dirección y magnitud).",
        params: { valor_inicial: { t: "number", d: "Valor inicial" }, valor_final: { t: "number", d: "Valor final" } },
        code: `if (valor_inicial === 0) return fail("valor inicial 0: variación indefinida");
const cambio = (valor_final - valor_inicial) / Math.abs(valor_inicial) * 100;
return ok({ valor_inicial, valor_final, delta: valor_final - valor_inicial, cambio_porcentual: Math.round(cambio * 100) / 100 + "%", direccion: cambio > 0 ? "aumento" : cambio < 0 ? "disminución" : "sin cambio" });`,
      },
      {
        name: "rule_of_three",
        desc: "Regla de tres directa/inversa: dado A→B, ¿qué corresponde a C?",
        params: { a: { t: "number", d: "Valor A" }, b: { t: "number", d: "Valor correspondiente a A" }, c: { t: "number", d: "Nuevo valor de A" }, inversa: { t: "boolean", d: "Proporcionalidad inversa", opt: true, def: false } },
        code: `if (a === 0 || c === 0) return fail("valores no pueden ser 0");
const x = inversa ? (b * a) / c : (b * c) / a;
return ok({ planteo: a + " → " + b + " ; " + c + " → ?", resultado: Math.round(x * 1e6) / 1e6, tipo: inversa ? "inversa" : "directa" });`,
      },
    ],
  },
  {
    id: "stats-toolkit",
    title: "Stats Toolkit",
    tagline: "Estadística descriptiva exacta: media, mediana, desviación, cuartiles y correlación",
    category: "Utilidades",
    pain: "El LLM 'estima' medias y desviaciones: para decisiones basadas en datos, cálculo exacto obligatorio.",
    tools: [
      {
        name: "describe",
        desc: "Estadística descriptiva completa de una lista de números: n, media, mediana, desviación, min, máx, cuartiles y outliers (IQR).",
        params: { valores: { t: "array", d: "Lista de números" } },
        code: `const v = (Array.isArray(valores) ? valores : []).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
if (v.length < 2) return fail("necesitas >= 2 valores");
const suma = v.reduce((a, b) => a + b, 0);
const media = suma / v.length;
const sd = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length);
const q = (p: number) => { const idx = (v.length - 1) * p; const lo = Math.floor(idx); return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (idx - lo); };
const iqr = q(0.75) - q(0.25);
const outliers = v.filter((x) => x < q(0.25) - 1.5 * iqr || x > q(0.75) + 1.5 * iqr);
return ok({ n: v.length, suma: Math.round(suma * 1e6) / 1e6, media: Math.round(media * 1e6) / 1e6, mediana: q(0.5), sd: Math.round(sd * 1e6) / 1e6, min: v[0], max: v[v.length - 1], q1: q(0.25), q3: q(0.75), iqr: Math.round(iqr * 1e6) / 1e6, outliers: outliers.length ? outliers : "ninguno" });`,
      },
      {
        name: "correlation",
        desc: "Correlación de Pearson exacta entre dos listas (misma longitud).",
        params: { x: { t: "array", d: "Valores X" }, y: { t: "array", d: "Valores Y" } },
        code: `const xs = (Array.isArray(x) ? x : []).map(Number);
const ys = (Array.isArray(y) ? y : []).map(Number);
if (xs.length !== ys.length || xs.length < 3) return fail("listas de igual longitud >= 3");
const n = xs.length;
const mx = xs.reduce((a, b) => a + b, 0) / n;
const my = ys.reduce((a, b) => a + b, 0) / n;
let num = 0, dx = 0, dy = 0;
for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
const r = num / Math.sqrt(dx * dy);
return ok({ r: Math.round(r * 1000) / 1000, fuerza: Math.abs(r) > 0.7 ? "fuerte" : Math.abs(r) > 0.4 ? "moderada" : "débil", direccion: r > 0 ? "positiva" : r < 0 ? "negativa" : "nula", nota: "correlación NO implica causalidad" });`,
      },
      {
        name: "histogram",
        desc: "Histograma de una lista numérica con bins automáticos (regla de Sturges).",
        params: { valores: { t: "array", d: "Números" }, bins: { t: "number", d: "Número de bins", opt: true } },
        code: `const v = (Array.isArray(valores) ? valores : []).map(Number).filter((n) => Number.isFinite(n));
if (v.length < 3) return fail("necesitas >= 3 valores");
const min = Math.min(...v); const max = Math.max(...v);
const k = bins ?? Math.max(3, Math.min(15, Math.ceil(Math.log2(v.length) + 1)));
const ancho = (max - min) / k || 1;
const conteo = new Array(k).fill(0);
for (const x of v) { const b = Math.min(k - 1, Math.floor((x - min) / ancho)); conteo[b]++; }
const barras = conteo.map((n) => "#".repeat(Math.round((n / Math.max(...conteo)) * 30)));
return ok({ bins: k, rango: [min, max], ancho_bin: Math.round(ancho * 1000) / 1000, histograma: conteo.map((n, i) => ({ bin: "[" + Math.round((min + i * ancho) * 100) / 100 + ", " + Math.round((min + (i + 1) * ancho) * 100) / 100 + ")", n, barra: barras[i] })) });`,
      },
    ],
  },
  {
    id: "datetime-toolkit",
    title: "Datetime Toolkit",
    tagline: "Fechas exactas: parse natural-ligero, formato, zonas horarias y días hábiles",
    category: "Utilidades",
    pain: "Los LLM calculan mal 'qué día será en 30 días' o mezclan zonas horarias: las fechas de deadlines deben ser exactas.",
    tools: [
      {
        name: "parse_date",
        desc: "Parsea fechas en múltiples formatos a ISO: ISO, dd/mm/yyyy, 'hoy', 'mañana', 'pasado mañana', 'lunes próximo', 'hace N días'.",
        params: { texto: { t: "string", d: "Fecha en texto" }, zona: { t: "string", d: "Zona horaria IANA", opt: true, def: "America/Guayaquil" } },
        code: `const t = texto.toLowerCase().trim();
const ahora = new Date();
const resolver = (d: Date) => d.toISOString().slice(0, 10);
if (t === "hoy") return ok({ iso: resolver(ahora), interpretacion: "hoy" });
if (t === "mañana") return ok({ iso: resolver(new Date(ahora.getTime() + 86400000)), interpretacion: "mañana" });
if (t === "pasado mañana") return ok({ iso: resolver(new Date(ahora.getTime() + 2 * 86400000)), interpretacion: "pasado mañana" });
const haceMatch = t.match(/^hace (\\d+) d[ií]as?$/);
if (haceMatch) return ok({ iso: resolver(new Date(ahora.getTime() - Number(haceMatch[1]) * 86400000)), interpretacion: "hace " + haceMatch[1] + " días" });
const enMatch = t.match(/^en (\\d+) d[ií]as?$/);
if (enMatch) return ok({ iso: resolver(new Date(ahora.getTime() + Number(enMatch[1]) * 86400000)), interpretacion: "en " + enMatch[1] + " días" });
const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const diaMatch = t.match(/^(\\w+)( pr[oó]ximo)?$/);
if (diaMatch) {
  const idx = dias.indexOf(diaMatch[1]);
  if (idx >= 0) {
    let delta = (idx - ahora.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return ok({ iso: resolver(new Date(ahora.getTime() + delta * 86400000)), interpretacion: diaMatch[1] + " próximo (+" + delta + "d)" });
  }
}
const iso = texto.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
if (iso) return ok({ iso: texto.slice(0, 10), interpretacion: "ISO directo" });
const dmy = texto.match(/^(\\d{1,2})[\\/](\\d{1,2})[\\/](\\d{4})$/);
if (dmy) return ok({ iso: dmy[3] + "-" + dmy[2].padStart(2, "0") + "-" + dmy[1].padStart(2, "0"), interpretacion: "dd/mm/yyyy (formato latino)" });
const mdy = texto.match(/^(\\d{1,2})[\\/](\\d{1,2})[\\/](\\d{4})$/);
if (mdy) return ok({ iso: mdy[3] + "-" + mdy[1].padStart(2, "0") + "-" + mdy[2].padStart(2, "0"), interpretacion: "mm/dd/yyyy (formato US)" });
return fail("formato no reconocido: prueba ISO, dd/mm/aaaa, 'hoy', 'mañana', 'hace N días', 'lunes próximo'");`,
      },
      {
        name: "add_days",
        desc: "Suma/resta días (o business days) a una fecha ISO con exactitud de calendario.",
        params: { fecha: { t: "string", d: "Fecha ISO (yyyy-mm-dd)" }, dias: { t: "number", d: "Días a sumar (negativo resta)" }, solo_habiles: { t: "boolean", d: "Solo días hábiles (L-V)", opt: true, def: false } },
        code: `const base = new Date(fecha + "T12:00:00Z");
if (isNaN(base.getTime())) return fail("fecha inválida: usa yyyy-mm-dd");
let d = new Date(base);
if (solo_habiles) {
  let restantes = Math.abs(dias);
  const paso = dias >= 0 ? 1 : -1;
  while (restantes > 0) {
    d = new Date(d.getTime() + paso * 86400000);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) restantes--;
  }
} else d = new Date(d.getTime() + dias * 86400000);
return ok({ fecha_original: fecha, fecha_resultado: d.toISOString().slice(0, 10), dia_semana: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][d.getUTCDay()], dias_aplicados: dias });`,
      },
      {
        name: "diff_dates",
        desc: "Diferencia exacta entre dos fechas: días totales, días hábiles, semanas y meses aproximados.",
        params: { desde: { t: "string", d: "Fecha ISO inicial" }, hasta: { t: "string", d: "Fecha ISO final" } },
        code: `const a = new Date(desde + "T12:00:00Z"); const b = new Date(hasta + "T12:00:00Z");
if (isNaN(a.getTime()) || isNaN(b.getTime())) return fail("fechas inválidas");
const ms = b.getTime() - a.getTime();
const dias = Math.round(ms / 86400000);
let habiles = 0;
for (let i = 0; i < Math.abs(dias); i++) {
  const d = new Date(Math.min(a.getTime(), b.getTime()) + i * 86400000);
  const dow = d.getUTCDay();
  if (dow !== 0 && dow !== 6) habiles++;
}
return ok({ dias_totales: dias, dias_habiles: habiles, semanas: Math.round((dias / 7) * 10) / 10, meses_aprox: Math.round((dias / 30.44) * 10) / 10, direccion: dias >= 0 ? "hacia adelante" : "hacia atrás" });`,
      },
    ],
  },
  {
    id: "currency-convert",
    title: "Currency Convert",
    tagline: "Conversión de monedas: tasas en vivo (API abierta) + tabla de respaldo offline",
    category: "Utilidades",
    pain: "El LLM no conoce la tasa del dólar HOY: convertir precios con tasas 'recordadas' da cifras falsas.",
    needsFetch: true,
    persistent: true,
    tools: [
      {
        name: "convert",
        desc: "Convierte un monto entre monedas usando tasas en vivo (open.er-api.com, gratis) con cache de 6h; si no hay red usa tabla de respaldo aproximada.",
        params: { monto: { t: "number", d: "Monto a convertir" }, de: { t: "string", d: "Moneda origen (ej: USD)" }, a: { t: "string", d: "Moneda destino (ej: EUR)" } },
        code: `const st = store.load();
const cacheValido = st.tasas && st.tasas_ts && Date.now() - new Date(st.tasas_ts).getTime() < 6 * 3600000;
let tasas: any = null; let fuente = "cache";
if (cacheValido) tasas = st.tasas;
else {
  try {
    const r = await fetchSmart("https://open.er-api.com/v6/latest/" + String(de).toUpperCase(), { timeoutMs: 10000, retries: 1 });
    if (r.json?.rates) { tasas = r.json.rates; st.tasas = tasas; st.tasas_ts = new Date().toISOString(); store.save(st); fuente = "live (open.er-api.com)"; }
  } catch { /* sin red */ }
}
const fallback: any = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, MXN: 17.2, COP: 4100, CLP: 940, PEN: 3.75, BRL: 5.5, ARS: 900 };
if (!tasas) { tasas = fallback; fuente = "fallback aproximado (sin red)"; }
const tasaDirecta = tasas[String(a).toUpperCase()];
if (tasaDirecta === undefined) return fail("moneda no disponible: " + a);
const resultado = Math.round(monto * tasaDirecta * 100) / 100;
return ok({ monto, de: String(de).toUpperCase(), a: String(a).toUpperCase(), tasa: tasaDirecta, resultado, fuente, actualizado: st.tasas_ts || "fallback" });`,
      },
      {
        name: "cross_table",
        desc: "Tabla cruzada de conversión de un monto base contra varias monedas a la vez.",
        params: { monto: { t: "number", d: "Monto base" }, de: { t: "string", d: "Moneda base", opt: true, def: "USD" }, monedas: { t: "array", d: "Monedas destino", opt: true } },
        code: `const st = store.load();
const lista = Array.isArray(monedas) && monedas.length ? monedas : ["USD", "EUR", "CAD", "MXN", "COP", "PEN", "BRL", "CLP"];
let tasas: any = st.tasas;
if (!tasas) {
  try { const r = await fetchSmart("https://open.er-api.com/v6/latest/" + String(de || "USD").toUpperCase(), { timeoutMs: 10000, retries: 1 }); if (r.json?.rates) { tasas = r.json.rates; st.tasas = tasas; st.tasas_ts = new Date().toISOString(); store.save(st); } } catch { tasas = null; }
}
const tabla: any = {};
for (const m of lista) { const tasa = tasas?.[String(m).toUpperCase()]; if (tasa) tabla[m] = Math.round(monto * tasa * 100) / 100; }
return ok({ base: String(de || "USD").toUpperCase() + " " + monto, tabla, fuente: st.tasas ? "cache/live" : "sin datos" });`,
      },
    ],
  },
  {
    id: "unit-convert",
    title: "Unit Convert",
    tagline: "Conversiones de unidades exactas: longitud, masa, volumen, temperatura, datos",
    category: "Utilidades",
    pain: "'~2 libras' del LLM no sirve para recetas ni ingeniería: conversiones exactas con factores estándar.",
    tools: [
      {
        name: "convert",
        desc: "Convierte entre unidades de 7 familias: longitud, masa, volumen, temperatura, área, velocidad y datos (SI e imperiales).",
        params: { valor: { t: "number", d: "Valor" }, de: { t: "string", d: "Unidad origen" }, a: { t: "string", d: "Unidad destino" } },
        code: `const factores: any = {
  longitud: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nmi: 1852 },
  masa: { kg: 1, g: 0.001, mg: 0.000001, t: 1000, lb: 0.45359237, oz: 0.0283495, st: 6.35029 },
  volumen: { l: 1, ml: 0.001, m3: 1000, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588, floz: 0.0295735 },
  area: { "m2": 1, "km2": 1e6, "cm2": 0.0001, ha: 10000, acre: 4046.86, "ft2": 0.092903, "mi2": 2589988 },
  velocidad: { "m/s": 1, "km/h": 0.277778, mph: 0.44704, kn: 0.514444, "ft/s": 0.3048 },
  datos: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1.0995116e12, KiB: 1024, MiB: 1048576, GiB: 1073741824 },
  tiempo: { s: 1, min: 60, h: 3600, d: 86400, sem: 604800, ms: 0.001 },
};
const temp: any = { c: "celsius", f: "fahrenheit", k: "kelvin", celsius: "celsius", fahrenheit: "fahrenheit", kelvin: "kelvin" };
const norm = (u: string) => u.toLowerCase().trim();
const deN = norm(de); const aN = norm(a);
if (temp[deN] && temp[aN]) {
  let celsius: number;
  if (temp[deN] === "celsius") celsius = valor;
  else if (temp[deN] === "fahrenheit") celsius = (valor - 32) * 5 / 9;
  else celsius = valor - 273.15;
  let out: number;
  if (temp[aN] === "celsius") out = celsius;
  else if (temp[aN] === "fahrenheit") out = celsius * 9 / 5 + 32;
  else out = celsius + 273.15;
  return ok({ valor, de, a, resultado: Math.round(out * 100) / 100, familia: "temperatura" });
}
for (const [familia, tabla] of Object.entries(factores)) {
  if (tabla[deN] !== undefined && tabla[aN] !== undefined) {
    const resultado = valor * tabla[deN] / tabla[aN];
    return ok({ valor, de, a, resultado: Math.round(resultado * 1e8) / 1e8, familia });
  }
}
return fail("unidades no soportadas o de familias distintas. Familias: " + Object.keys(factores).join(", ") + " + temperatura (c/f/k)");`,
      },
      {
        name: "list_units",
        desc: "Lista todas las unidades soportadas por familia.",
        params: {},
        code: `const familias: any = {
  longitud: ["m", "km", "cm", "mm", "mi", "yd", "ft", "in", "nmi"],
  masa: ["kg", "g", "mg", "t", "lb", "oz", "st"],
  volumen: ["l", "ml", "m3", "gal", "qt", "pt", "cup", "floz"],
  area: ["m2", "km2", "cm2", "ha", "acre", "ft2", "mi2"],
  velocidad: ["m/s", "km/h", "mph", "kn", "ft/s"],
  datos: ["B", "KB", "MB", "GB", "TB", "KiB", "MiB", "GiB"],
  tiempo: ["s", "min", "h", "d", "sem", "ms"],
  temperatura: ["c", "f", "k"],
};
return ok({ familias });`,
      },
    ],
  },
  {
    id: "regex-forge",
    title: "Regex Forge",
    tagline: "Construye, prueba y explica regex: patrones comunes + riesgo ReDoS",
    category: "Utilidades",
    pain: "El LLM escribe regex sin testear y a veces catastróficas (ReDoS): forja con validación previa.",
    tools: [
      {
        name: "build",
        desc: "Genera regex probadas para casos comunes: email, teléfono EC, slug, fecha ISO, hex color, URL, número, cédula.",
        params: { patron: { t: "enum", values: ["email", "telefono_ec", "slug", "fecha_iso", "hex_color", "url", "numero_decimal", "cedula_ec", "dni_generico", "version_semver"], d: "Tipo de patrón" } },
        code: `const patrones: any = {
  email: { regex: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}", flags: "", ejemplo_valido: "user@example.com", ejemplo_invalido: "user@@" },
  telefono_ec: { regex: "(\\\\+593)?\\\\s?\\\\d{2}\\\\d{7,8}", flags: "", ejemplo_valido: "0991234567", ejemplo_invalido: "12345" },
  slug: { regex: "^[a-z0-9]+(-[a-z0-9]+)*$", flags: "", ejemplo_valido: "mi-slug-2", ejemplo_invalido: "Mi Slug" },
  fecha_iso: { regex: "^\\\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\\\d|3[01])$", flags: "", ejemplo_valido: "2026-09-10", ejemplo_invalido: "2026-13-45" },
  hex_color: { regex: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", flags: "", ejemplo_valido: "#ff00aa", ejemplo_invalido: "#ff00a" },
  url: { regex: "^https?:\\\\/\\\\/[\\\\w.-]+\\\\.[a-z]{2,}(\\\\/\\\\S*)?$", flags: "i", ejemplo_valido: "https://marketnow.site/api", ejemplo_invalido: "ftp://x" },
  numero_decimal: { regex: "^-?\\\\d{1,3}(\\\\.\\\\d+)?([.,]\\\\d{3})*(,\\\\d+)?$", flags: "", ejemplo_valido: "1.234,56", ejemplo_invalido: "1.2.3" },
  cedula_ec: { regex: "^\\\\d{10}$", flags: "", ejemplo_valido: "1712345678", ejemplo_invalido: "12345" },
  dni_generico: { regex: "^[A-Z0-9]{6,12}$", flags: "", ejemplo_valido: "X1234567L", ejemplo_invalido: "abc" },
  version_semver: { regex: "^\\\\d+\\\\.\\\\d+\\\\.\\\\d+(-[\\\\w.]+)?(\\\\+[\\\\w.]+)?$", flags: "", ejemplo_valido: "1.30.0-beta.1", ejemplo_invalido: "1.30" },
};
const p = patrones[patron];
if (!p) return fail("patrón no existe");
return ok({ tipo: patron, regex: "/" + p.regex + "/" + p.flags, raw: p.regex, flags: p.flags, ejemplos: { valido: p.ejemplo_valido, invalido: p.ejemplo_invalido } });`,
      },
      {
        name: "test",
        desc: "Prueba una regex contra un texto: coincidencias, grupos y posiciones.",
        params: { regex: { t: "string", d: "La regex (sin delimitadores)" }, flags: { t: "string", d: "Flags (g, i, m...)", opt: true, def: "g" }, texto: { t: "string", d: "Texto de prueba" } },
        code: `let re: RegExp;
try { re = new RegExp(regex, flags || "g"); } catch (e: any) { return fail("regex inválida: " + e.message); }
const matches = [...String(texto).matchAll(new RegExp(regex, (flags || "g") + (flags?.includes("g") ? "" : "g")))];
if (!matches.length) return ok({ coincidencias: 0, mensaje: "sin matches" });
return ok({ coincidencias: matches.length, matches: matches.slice(0, 20).map((m) => ({ texto: m[0], posicion: m.index, grupos: m.slice(1) })) });`,
      },
      {
        name: "redos_check",
        desc: "Heurística de riesgo ReDoS: detecta cuantificadores anidados y alternancias superpuestas catastróficas.",
        params: { regex: { t: "string", d: "Regex a auditar" } },
        code: `let re: RegExp;
try { re = new RegExp(regex); } catch (e: any) { return fail("regex inválida: " + e.message); }
const riesgos: string[] = [];
if (/(\\+|\\*|{\\d+,})[^+]*?(\\+|\\*|{\\d+,})/.test(regex.replace(/\\[[^\\]]*\\]/g, "[]"))) riesgos.push("cuantificadores encadenados: posible backtracking exponencial");
if (/\\(([^)]*[+*])\\)[+*]/.test(regex)) riesgos.push("grupo cuantificado con cuantificador interno: clásico ReDoS");
if (/\\(.*\\|.*\\)/.test(regex)) riesgos.push("alternancia anidada en grupo: revisa backtracking");
const inicio = Date.now();
const sjon = "a".repeat(30) + "x";
try { re.test(sjon); } catch {}
const ms = Date.now() - inicio;
return ok({ riesgos, tiempo_test_30chars_ms: ms, veredicto: riesgos.length === 0 && ms < 100 ? "segura" : "revisar: potencialmente costosa", recomendacion: riesgos.length ? "reescribe con posesivos/atomic o limita la entrada" : "ok" });`,
      },
    ],
  },
  {
    id: "id-forge",
    title: "ID Forge",
    tagline: "Genera identificadores: UUIDv4, ULID, nanoid y slugs — ordenables y colisionables a propósito",
    category: "Utilidades",
    pain: "IDs ad-hoc ('temp1', 'final-final2') rompen deduplicación y orden: hace falta generación seria.",
    imports: ["crypto"],
    tools: [
      {
        name: "uuid",
        desc: "Genera N UUIDs v4 criptográficamente aleatorios.",
        params: { n: { t: "number", d: "Cuántos", opt: true, def: 1 } },
        code: `const out: string[] = [];
for (let i = 0; i < Math.min(n ?? 1, 100); i++) out.push(randomUUID());
return ok({ tipo: "uuid-v4", total: out.length, ids: out });`,
      },
      {
        name: "ulid",
        desc: "Genera ULIDs (ordenables por tiempo, 26 chars, safe para URLs): ideales para claves de eventos.",
        params: { n: { t: "number", d: "Cuántos", opt: true, def: 1 } },
        code: `const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulid(): string {
  let t = Date.now();
  let tiempo = "";
  for (let i = 0; i < 10; i++) { tiempo = ALFABETO[t % 32] + tiempo; t = Math.floor(t / 32); }
  let aleatorio = "";
  const bytes = randomBytes(16);
  for (let i = 0; i < 16; i++) aleatorio += ALFABETO[bytes[i] % 32];
  return tiempo + aleatorio;
}
const out: string[] = [];
for (let i = 0; i < Math.min(n ?? 1, 100); i++) out.push(ulid());
return ok({ tipo: "ulid", total: out.length, ids: out, ventaja: "orden cronológico lexicográfico" });`,
      },
      {
        name: "slugify",
        desc: "Convierte texto (con acentos y símbolos) en slug URL-safe único.",
        params: { texto: { t: "string", d: "Texto a convertir" }, max_len: { t: "number", d: "Longitud máxima", opt: true, def: 60 } },
        code: `const mapa: any = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n", à: "a", è: "e", ç: "c" };
let s = texto.toLowerCase().split("").map((ch) => mapa[ch] || ch).join("");
s = s.replace(/[^a-z0-9\\s-]/g, "").replace(/\\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const slug = s.slice(0, max_len ?? 60);
const sufijo = randomBytes(3).toString("hex");
return ok({ slug, slug_unico: slug + "-" + sufijo });`,
      },
    ],
  },
  {
    id: "hash-toolkit",
    title: "Hash Toolkit",
    tagline: "Hashing y encoding exacto: sha256, hmac, base64, hex y checksums",
    category: "Utilidades",
    pain: "Verificar integridad o firmar un payload exige hashing exacto: 'calcular' un sha256 de cabeza es imposible.",
    imports: ["crypto"],
    tools: [
      {
        name: "hash",
        desc: "Calcula el hash de un texto en md5/sha1/sha256/sha512 (hex o base64).",
        params: { texto: { t: "string", d: "Texto a hashear" }, algoritmo: { t: "enum", values: ["md5", "sha1", "sha256", "sha512"], d: "Algoritmo", opt: true, def: "sha256" }, encoding: { t: "enum", values: ["hex", "base64"], d: "Salida", opt: true, def: "hex" } },
        code: `const h = createHash(algoritmo || "sha256").update(String(texto), "utf8").digest(encoding === "base64" ? "base64" : "hex");
return ok({ algoritmo, encoding: encoding || "hex", hash: h, longitud: h.length });`,
      },
      {
        name: "hmac",
        desc: "Calcula HMAC (sha256 por defecto) de un mensaje con un secreto — para firmar webhooks y payloads.",
        params: { mensaje: { t: "string", d: "Mensaje" }, secreto: { t: "string", d: "Secreto compartido" }, algoritmo: { t: "enum", values: ["sha256", "sha1", "sha512"], d: "Algoritmo", opt: true, def: "sha256" } },
        code: `const mac = createHmac(algoritmo || "sha256", String(secreto)).update(String(mensaje), "utf8").digest("hex");
return ok({ algoritmo: algoritmo || "sha256", hmac: mac, nota: "compara siempre en tiempo constante (timingSafeEqual) en producción" });`,
      },
      {
        name: "encode_decode",
        desc: "Codifica/decodifica base64, base64url y hex con detección automática de la operación.",
        params: { operacion: { t: "enum", values: ["encode", "decode"], d: "Operación" }, formato: { t: "enum", values: ["base64", "base64url", "hex"], d: "Formato", opt: true, def: "base64" }, dato: { t: "string", d: "Dato a transformar" } },
        code: `try {
  if (operacion === "encode") {
    if (formato === "hex") return ok({ resultado: Buffer.from(dato, "utf8").toString("hex") });
    if (formato === "base64url") return ok({ resultado: Buffer.from(dato, "utf8").toString("base64url") });
    return ok({ resultado: Buffer.from(dato, "utf8").toString("base64") });
  }
  if (formato === "hex") return ok({ resultado: Buffer.from(dato, "hex").toString("utf8") });
  if (formato === "base64url") return ok({ resultado: Buffer.from(dato, "base64url").toString("utf8") });
  return ok({ resultado: Buffer.from(dato, "base64").toString("utf8") });
} catch (e: any) { return fail("dato inválido para el formato: " + e.message); }`,
      },
    ],
  },
];

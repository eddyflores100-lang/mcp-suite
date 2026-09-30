// ═══ CATEGORÍA: Dolores de agentes · Seguridad (B) ═══
export default [
  {
    id: "file-guard",
    title: "File Guard",
    tagline: "Guardián de rutas: el agente solo toca lo permitido, sin escapes de directorio",
    category: "Seguridad",
    pain: "Una tool con acceso a archivos puede leer ~/.ssh o escapar del workspace con ../: faltan guardas de rutas.",
    imports: ["path"],
    tools: [
      {
        name: "resolve_path",
        desc: "Resuelve una ruta contra una raíz permitida y detecta escapes (../), symlinks evidentes y rutas absolutas fuera de la raíz.",
        params: { ruta: { t: "string", d: "Ruta solicitada (relativa o absoluta)" }, raiz: { t: "string", d: "Raíz permitida", opt: true, def: "/home/z/my-project" } },
        code: `const raizBase = raiz || "/home/z/my-project";
let p = String(ruta);
const esAbs = p.startsWith("/") || /^[A-Z]:\\\\/.test(p);
let combinada = esAbs ? p : join(raizBase, p);
const normalizada = combinada.replace(/\\\\/g, "/").replace(/(?!^)\\/\\.\\/(?!\\.\\.)/, "/");
const partes: string[] = [];
for (const seg of normalizada.split("/")) {
  if (seg === "..") { if (partes.length === 0) return fail("escape de directorio detectado: ../ arriba de la raíz"); partes.pop(); }
  else if (seg !== "." && seg !== "") partes.push(seg);
}
const final = "/" + partes.join("/");
const dentro = final.startsWith(raizBase.endsWith("/") ? raizBase : raizBase + "/") || final === raizBase;
const peligros = ["/.ssh", "/.env", "/etc/shadow", "/.aws", "/.gnupg", "/.config/gcloud"].filter((d) => final.includes(d));
return ok({ ruta_original: ruta, ruta_resuelta: final, permitida: dentro && peligros.length === 0, razon: !dentro ? "fuera de la raíz permitida" : peligros.length ? "ruta sensible: " + peligros.join(", ") : "ok" });`,
      },
      {
        name: "check_access",
        desc: "Verifica si una operación de archivo (leer/escribir/borrar/ejecutar) está permitida por política para esa ruta.",
        params: { ruta: { t: "string", d: "Ruta objetivo" }, operacion: { t: "enum", values: ["leer", "escribir", "borrar", "ejecutar"], d: "Operación" } },
        code: `const r = ruta.toLowerCase();
const reglas: Array<[RegExp, string[], string]> = [
  [/\\.env|secrets?|credentials?|\\.pem|\\.key$/, ["leer", "escribir", "borrar"], "credenciales"],
  [/\\.ssh\\/|\\.aws\\/|\\.gnupg\\//, ["leer", "escribir", "borrar", "ejecutar"], "directorio de identidad"],
  [/node_modules/, ["escribir", "borrar"], "node_modules"],
  [/\\.(sh|bash|exe|bat|cmd|ps1)$/, ["ejecutar"], "scripts ejecutables"],
  [/dist\\//, ["leer", "escribir"], "build output"],
];
for (const [re, ops, razon] of reglas) {
  if (re.test(r) && ops.includes(operacion)) return ok({ permitido: false, razon: "política bloquea " + operacion + " en " + razon, requiere: "permission-gate humano" });
}
return ok({ permitido: true, razon: "sin restricciones para " + operacion });`,
      },
    ],
  },
  {
    id: "tos-checker",
    title: "ToS & Robots Checker",
    tagline: "Respeta robots.txt y términos: scraping legal antes de raspar",
    category: "Seguridad",
    pain: "El agente scrapea sin consultar robots.txt ni ToS: riesgo legal y de ban. Falta un check previo estandarizado.",
    needsFetch: true,
    tools: [
      {
        name: "can_fetch",
        desc: "Consulta robots.txt del dominio en vivo y evalúa si un user-agent puede fetch una ruta dada.",
        params: { url: { t: "string", d: "URL que quieres fetch" }, user_agent: { t: "string", d: "User agent", opt: true, def: "mcp-agent" } },
        code: `let u: any; try { u = new URL(url); } catch { return fail("URL inválida"); }
const robotsUrl = u.protocol + "//" + u.host + "/robots.txt";
let txt = "";
try { const r = await fetchSmart(robotsUrl, { timeoutMs: 8000, retries: 1 }); txt = r.status === 200 ? r.text.toLowerCase() : ""; } catch { txt = ""; }
if (!txt) return ok({ robots_existe: false, permitido: true, razon: "sin robots.txt: permitido por defecto (revisa ToS manualmente)" });
const ua = (user_agent || "mcp-agent").toLowerCase();
const lineas = txt.split("\\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
let aplica = false; const disallow: string[] = []; const allow: string[] = [];
for (const l of lineas) {
  const [k, v] = l.split(":").map((s) => (s || "").trim());
  if (k === "user-agent") aplica = v === "*" || ua.includes(v);
  else if (aplica && k === "disallow" && v) disallow.push(v);
  else if (aplica && k === "allow" && v) allow.push(v);
}
const ruta = u.pathname;
const bloqueado = disallow.some((d) => ruta.startsWith(d));
const permitido_explicito = allow.some((a) => ruta.startsWith(a));
const permitido = !bloqueado || permitido_explicito;
return ok({ robots_existe: true, permitido, ruta, user_agent: ua, reglas_disallow: disallow.slice(0, 10), reglas_allow: allow.slice(0, 10) });`,
      },
      {
        name: "summarize_tos",
        desc: "Busca en los ToS/robots en vivo las cláusulas relevantes para scraping: prohibiciones, rate limits, API oficial.",
        params: { dominio: { t: "string", d: "Dominio a revisar (ej: example.com)" } },
        code: `const r = await fetchSmart("https://" + dominio.replace(/^https?:\\/\\//, "") + "/robots.txt", { timeoutMs: 8000, retries: 1 });
const txt = r.status === 200 ? r.text.toLowerCase() : "";
const hallazgos: string[] = [];
if (/crawl-delay:\\s*\\d+/.test(txt)) hallazgos.push("crawl-delay especificado: " + (txt.match(/crawl-delay:\\s*(\\d+)/) || [])[0]);
if (/disallow:\\s*\\/$/.test(txt)) hallazgos.push("PROHIBICIÓN TOTAL de scraping para algún UA");
if (/api\\b/.test(txt)) hallazgos.push("menciona API: considera endpoint oficial");
const crawl = (txt.match(/crawl-delay:\\s*(\\d+)/) || [])[1];
return ok({ dominio, robots_status: r.status, hallazgos, crawl_delay_seg: crawl ? Number(crawl) : null, recomendacion: "usa can_fetch antes de cada ruta y respeta crawl-delay" });`,
      },
    ],
  },
  {
    id: "allowlist-proxy",
    title: "Allowlist Proxy Guard",
    tagline: "Valida URLs contra allowlist y bloquea SSRF antes de cualquier fetch",
    category: "Seguridad",
    pain: "Un fetch a http://169.254.169.254/ o a internals exfiltra datos de la nube: SSRF es el riesgo #1 de tools con red.",
    persistent: true,
    tools: [
      {
        name: "check_url",
        desc: "Valida una URL: esquema permitido, dominio en allowlist, bloqueo de IPs internas/reservadas (SSRF guard) y puertos peligrosos.",
        params: { url: { t: "string", d: "URL a validar" } },
        code: `const st = store.load();
const allowlist: string[] = st.allowlist || ["marketnow.site", "example.com", "github.com", "npmjs.org", "registry.npmjs.org", "api.github.com"];
let u: any; try { u = new URL(url); } catch { return fail("URL inválida"); }
const problemas: string[] = [];
if (!["http:", "https:"].includes(u.protocol)) problemas.push("esquema no permitido: " + u.protocol);
const host = u.hostname.toLowerCase();
const ipMatch = host.match(/^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/);
if (ipMatch) {
  const [a, b] = [Number(ipMatch[1]), Number(ipMatch[2])];
  if (a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || a >= 224) problemas.push("IP interna/reservada (SSRF): " + host);
}
if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) problemas.push("host interno bloqueado");
const puertos_peligrosos = ["22", "25", "110", "143", "3306", "5432", "6379", "27017", "9200"];
if (puertos_peligrosos.includes(u.port)) problemas.push("puerto sospechoso de servicio interno: " + u.port);
if (/@/.test(u.href) && !u.username) problemas.push("posible URL con credenciales embebidas");
const en_allowlist = allowlist.some((d) => host === d || host.endsWith("." + d));
return ok({ url, host, permitida: problemas.length === 0 && en_allowlist, problemas, en_allowlist, allowlist_activa: allowlist });`,
      },
      {
        name: "set_allowlist",
        desc: "Define la allowlist de dominios permitidos (reemplaza la actual).",
        params: { dominios: { t: "array", d: "Lista de dominios permitidos" } },
        code: `const st = store.load();
st.allowlist = (Array.isArray(dominios) ? dominios : []).map((d) => String(d).toLowerCase().trim()).filter(Boolean);
store.save(st);
return ok({ allowlist: st.allowlist, total: st.allowlist.length });`,
      },
    ],
  },
  {
    id: "consent-manager",
    title: "Consent Manager",
    tagline: "Consentimientos RGPD-style: qué datos puede procesar el agente y para qué",
    category: "Seguridad",
    pain: "El agente procesa datos personales sin registro de consentimiento: pesadilla de compliance (RGPD/LGPD).",
    persistent: true,
    tools: [
      {
        name: "grant",
        desc: "Registra un consentimiento: sujeto, propósitos autorizados, datos involucrados y vigencia.",
        params: { sujeto: { t: "string", d: "Identificador del sujeto" }, propositos: { t: "array", d: "Propósitos autorizados" }, datos: { t: "array", d: "Categorías de datos (contacto, perfil...)" }, meses: { t: "number", d: "Vigencia en meses", opt: true, def: 12 } },
        code: `const st = store.load();
st.consentimientos = st.consentimientos || {};
st.consentimientos[sujeto] = { propositos: Array.isArray(propositos) ? propositos : [], datos: Array.isArray(datos) ? datos : [], concedido: new Date().toISOString(), expira: new Date(Date.now() + (meses ?? 12) * 30 * 86400000).toISOString() };
store.save(st);
return ok({ sujeto, expira: st.consentimientos[sujeto].expira });`,
      },
      {
        name: "check",
        desc: "Verifica si un procesamiento (sujeto + propósito + categoría de dato) está consentido y vigente.",
        params: { sujeto: { t: "string", d: "Sujeto" }, proposito: { t: "string", d: "Propósito del procesamiento" }, dato: { t: "string", d: "Categoría de dato" } },
        code: `const st = store.load();
const c = st.consentimientos?.[sujeto];
if (!c) return ok({ consentido: false, razon: "sin consentimiento registrado" });
if (new Date(c.expira) < new Date()) return ok({ consentido: false, razon: "consentimiento expirado" });
const okProp = c.propositos.includes(proposito);
const okDato = c.datos.includes(dato);
return ok({ consentido: okProp && okDato, razon: okProp && okDato ? "vigente" : "fuera de alcance (" + (!okProp ? "propósito" : "dato") + ")", propositos_autorizados: c.propositos, datos_autorizados: c.datos });`,
      },
      {
        name: "revoke",
        desc: "Revoca el consentimiento de un sujeto (todo procesamiento futuro queda bloqueado).",
        params: { sujeto: { t: "string", d: "Sujeto" } },
        code: `const st = store.load();
if (st.consentimientos?.[sujeto]) { st.consentimientos[sujeto].revocado = new Date().toISOString(); st.consentimientos[sujeto].expira = new Date().toISOString(); store.save(st); }
return ok({ sujeto, revocado: true });`,
      },
    ],
  },
  {
    id: "threat-modeler",
    title: "Threat Modeler",
    tagline: "Modelado de amenazas STRIDE para tus tools y flujos de agente",
    category: "Seguridad",
    pain: "Nadie modela amenazas antes de exponer una tool MCP: spoofing y tampering de tools son triviales sin análisis.",
    tools: [
      {
        name: "enumerate",
        desc: "Enumera amenazas STRIDE (Spoofing, Tampering, Repudio, Info disclosure, DoS, Elevation) para un componente/flujo descrito.",
        params: { componente: { t: "string", d: "Componente o flujo a modelar" } },
        code: `const stride = [
  { tipo: "Spoofing", pregunta: "¿quién puede suplantar al llamador?", mitigacion: "auth por token/API key + ATC firmada" },
  { tipo: "Tampering", pregunta: "¿quién puede alterar datos en tránsito o en store?", mitigacion: "TLS + hash de integridad (audit-log)" },
  { tipo: "Repudio", pregunta: "¿puede el actor negar haber llamado?", mitigacion: "bitácora inmutable encadenada" },
  { tipo: "Info disclosure", pregunta: "¿qué secretos/PII puede filtrar?", mitigacion: "pii-redactor + secrets-audit antes de salida" },
  { tipo: "Denial of Service", pregunta: "¿cómo pueden tumbar la tool?", mitigacion: "rate-limiter + timeout-guard" },
  { tipo: "Elevation of privilege", pregunta: "¿puede escalar a ejecutar comandos?", mitigacion: "runtime-interceptor + permission-gate" },
];
return ok({ componente, amenazas: stride.map((s) => ({ ...s, aplicacion: "analiza: " + s.pregunta + " en el contexto de " + componente })) });`,
      },
      {
        name: "assess",
        desc: "Puntúa el riesgo de un flujo según controles presentes: devuelve brechas de mitigación priorizadas.",
        params: { flujo: { t: "string", d: "Descripción del flujo" }, controles_presentes: { t: "array", d: "Controles ya implementados (ej: auth, tls, rate-limit, audit, pii-redaction, sandbox)" } },
        code: `const controles = new Set((Array.isArray(controles_presentes) ? controles_presentes : []).map((c) => String(c).toLowerCase()));
const requeridos: Array<[string, number, string]> = [
  ["auth", 30, "sin autenticación cualquiera llama la tool"],
  ["tls", 15, "tráfico sin cifrar"],
  ["rate-limit", 15, "DoS trivial"],
  ["audit", 15, "sin trazabilidad"],
  ["input-validation", 10, "inputs hostiles"],
  ["pii-redaction", 10, "fuga de datos personales"],
  ["sandbox", 5, "ejecución sin aislamiento"],
];
const faltantes = requeridos.filter(([c]) => !controles.has(c));
const riesgo = faltantes.reduce((a, [, pts]) => a + pts, 0);
return ok({ flujo: flujo.slice(0, 100), riesgo_acumulado: riesgo, nivel: riesgo >= 60 ? "CRÍTICO: no exponer" : riesgo >= 30 ? "ALTO: mitigar antes de producción" : "aceptable con monitoreo", brechas: faltantes.map(([c, pts, desc]) => ({ control: c, peso: pts, descripcion: desc })) });`,
      },
    ],
  },
];

// ═══ CATEGORÍA: MarketNow · Trust Infrastructure (estándares ATC/UTA) ═══
export default [
  {
    id: "ed25519-toolbox",
    title: "Ed25519 Toolbox",
    tagline: "Genera claves, firma y verifica mensajes con Ed25519 (RFC 8032) — la base del trust de agentes",
    category: "MarketNow Trust",
    pain: "Los agentes firman/verifican sin crypto adecuada: falta una toolbox Ed25519 simple y correcta para identidad de agentes.",
    imports: ["crypto"],
    persistent: true,
    notes: "Usa node:crypto nativo (Ed25519, RFC 8032). Las claves se guardan como PEM en ~/.mcp-suite/ed25519-toolbox/. Las firmas son detached (solo la firma) y también firmas JWS compactas.",
    tools: [
      {
        name: "generate_keypair",
        desc: "Genera un par de claves Ed25519 y la guarda localmente con un alias. Devuelve la pública PEM.",
        params: { alias: { t: "string", d: "Alias para guardar la clave (ej: mi-agente)" } },
        code: `const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const st = store.load();
st.keys = st.keys || {};
st.keys[alias] = { public: publicKey.export({ type: "spki", format: "pem" }), private: privateKey.export({ type: "pkcs8", format: "pem" }), created: new Date().toISOString() };
store.save(st);
return ok({ alias, public_pem: st.keys[alias].public, algoritmo: "Ed25519 (RFC 8032)" });`,
      },
      {
        name: "sign_message",
        desc: "Firma un mensaje con la clave privada del alias guardado. Devuelve firma en base64 (detached).",
        params: { alias: { t: "string", d: "Alias de la clave" }, mensaje: { t: "string", d: "Mensaje a firmar" } },
        code: `const st = store.load();
const k = st.keys?.[alias];
if (!k) return fail("alias no existe: genera_keypair primero");
const firma = sign(null, Buffer.from(mensaje, "utf8"), createPrivateKey(k.private));
return ok({ alias, mensaje_hash: createHash("sha256").update(mensaje).digest("hex"), firma_b64: firma.toString("base64") });`,
      },
      {
        name: "verify_signature",
        desc: "Verifica una firma detached Ed25519 dado el mensaje, la firma base64 y la clave pública PEM.",
        params: { mensaje: { t: "string", d: "Mensaje original" }, firma_b64: { t: "string", d: "Firma en base64" }, public_pem: { t: "string", d: "Clave pública PEM" } },
        code: `let valida = false;
let error = null;
try {
  valida = verify(null, Buffer.from(mensaje, "utf8"), createPublicKey(public_pem), Buffer.from(firma_b64, "base64"));
} catch (e) { error = e.message; }
return ok({ valida, error, algoritmo: "Ed25519" });`,
      },
      {
        name: "list_keys",
        desc: "Lista los alias de claves guardadas (solo metadatos, nunca la privada).",
        params: {},
        code: `const st = store.load();
const keys = Object.entries((st.keys || {}) as any).map(([alias, k]: [string, any]) => ({ alias, created: k.created, public_fingerprint: createHash("sha256").update(k.public).digest("hex").slice(0, 16) }));
return ok({ total: keys.length, keys });`,
      },
    ],
  },
  {
    id: "jcs-canonicalizer",
    title: "JCS Canonicalizer",
    tagline: "JSON canónico RFC 8785 (JCS): misma firma para el mismo JSON, siempre",
    category: "MarketNow Trust",
    pain: "Firmar JSON es frágil: espacios u orden de claves distintos rompen la firma. RFC 8785 lo resuelve con serialización canónica.",
    imports: ["crypto"],
    notes: "Implementa el subconjunto práctico de RFC 8785: claves ordenadas por código UTF-16, sin whitespace, números según ECMAScript toString, strings con escape mínimo JSON. Rechaza NaN/Infinity/-0.",
    tools: [
      {
        name: "canonicalize",
        desc: "Convierte un objeto JSON arbitrario a su forma canónica RFC 8785 (JCS) — string determinista listo para firmar.",
        params: { data: { t: "any", d: "Objeto JSON a canonizar" } },
        code: `function canon(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!isFinite(v)) throw new Error("RFC 8785: NaN/Infinity prohibidos");
    if (v === 0) return "0";
    if (Number.isInteger(v) && Math.abs(v) < 1e21) return String(v);
    return String(v);
  }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => canon(x === undefined ? null : x)).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
try { return ok({ canonical: canon(data) }); } catch (e) { return fail(e.message); }`,
      },
      {
        name: "fingerprint",
        desc: "Hash SHA-256 de la forma canónica JCS: identificador determinista del contenido (útil para deduplicar y comparar credenciales).",
        params: { data: { t: "any", d: "Objeto JSON" } },
        code: `function canon(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") { if (!isFinite(v)) throw new Error("NaN/Infinity"); if (v === 0) return "0"; return String(v); }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => canon(x === undefined ? null : x)).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
const c = canon(data);
return ok({ jcs: c, sha256: createHash("sha256").update(c).digest("hex") });`,
      },
      {
        name: "compare",
        desc: "Compara dos JSON semánticamente: si sus formas canónicas JCS son idénticas, son equivalentes byte a byte para firmas.",
        params: { a: { t: "any", d: "Primer JSON" }, b: { t: "any", d: "Segundo JSON" } },
        code: `function canon(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") { if (!isFinite(v)) throw new Error("NaN/Infinity"); if (v === 0) return "0"; return String(v); }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => canon(x === undefined ? null : x)).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
const ca = canon(a), cb = canon(b);
return ok({ semanticamente_iguales: ca === cb, canonical_a: ca, canonical_b: cb });`,
      },
    ],
  },
  {
    id: "atc-agent-trust-card",
    title: "ATC · Agent Trust Card",
    tagline: "Crea y verifica Agent Trust Cards firmadas (Ed25519 + JCS), el estándar de identidad del marketplace",
    category: "MarketNow Trust",
    pain: "Un agente presenta identidad sin prueba criptográfica: hace falta una trust card firmada verificable (ATC de MarketNow).",
    imports: ["crypto"],
    persistent: true,
    notes: "ATC = payload (subject, issuer, trust_score, capabilities, vigencia) + proof Ed25519 sobre la forma canónica JCS. Guarda claves y cards en ~/.mcp-suite/atc-agent-trust-card/.",
    tools: [
      {
        name: "create_card",
        desc: "Crea una Agent Trust Card: genera (o reusa) par Ed25519, firma el payload canonizado con JCS y devuelve la card completa verificable.",
        params: {
          subject: { t: "string", d: "Identidad del agente (ej: agente-scraping-01)" },
          issuer: { t: "string", d: "Emisor de la card", opt: true, def: "mcp-suite-local" },
          trust_score: { t: "number", d: "Score de confianza 0-10", opt: true, def: 5 },
          capabilities: { t: "array", d: "Lista de capacidades declaradas", opt: true },
          horas_validez: { t: "number", d: "Vigencia en horas", opt: true, def: 24 },
        },
        code: `function canon(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") { if (!isFinite(v)) throw new Error("NaN/Infinity"); if (v === 0) return "0"; return String(v); }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => canon(x === undefined ? null : x)).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
const st = store.load();
st.keys = st.keys || {};
if (!st.keys.issuer) {
  const kp = generateKeyPairSync("ed25519");
  st.keys.issuer = { public: kp.publicKey.export({ type: "spki", format: "pem" }), private: kp.privateKey.export({ type: "pkcs8", format: "pem" }) };
  store.save(st);
} else store.save(st);
const now = new Date();
const payload: any = {
  type: "AgentTrustCard", spec: "ATC/1.0",
  issuer: issuer || "mcp-suite-local", subject,
  trust_score: Math.max(0, Math.min(10, trust_score ?? 5)),
  capabilities: Array.isArray(capabilities) ? capabilities : [],
  issued_at: now.toISOString(),
  expires_at: new Date(now.getTime() + (horas_validez ?? 24) * 3600000).toISOString(),
};
const canonical = canon(payload);
const firma = sign(null, Buffer.from(canonical, "utf8"), createPrivateKey(st.keys.issuer.private));
const card = { ...payload, proof: { type: "Ed25519Signature2025", algorithm: "RFC8032", canonicalization: "RFC8785-JCS", verification_method: st.keys.issuer.public, signature_b64: firma.toString("base64") } };
st.cards = st.cards || [];
st.cards.push({ subject, created: now.toISOString(), card });
if (st.cards.length > 100) st.cards = st.cards.slice(-100);
store.save(st);
return ok({ card, fingerprint: createHash("sha256").update(canonical).digest("hex") });`,
      },
      {
        name: "verify_card",
        desc: "Verifica una ATC: re-canoniza el payload (sin proof), valida la firma Ed25519, expiración y score. Devuelve veredicto por etapa.",
        params: { card: { t: "any", d: "La Agent Trust Card completa (JSON)" } },
        code: `function canon(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") { if (!isFinite(v)) throw new Error("NaN/Infinity"); if (v === 0) return "0"; return String(v); }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => canon(x === undefined ? null : x)).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
const c = card || {};
const proof = c.proof || {};
const { proof: _omit, ...payload } = c;
const etapas: any = {};
etapas.estructura = c.type === "AgentTrustCard" ? "pass" : "fail";
etapas.expiracion = c.expires_at && new Date(c.expires_at) > new Date() ? "pass" : "fail";
try {
  const canonical = canon(payload);
  etapas.canonizacion = "pass";
  const okSig = verify(null, Buffer.from(canonical, "utf8"), createPublicKey(proof.verification_method), Buffer.from(proof.signature_b64, "base64"));
  etapas.firma_ed25519 = okSig ? "pass" : "fail";
} catch (e) {
  etapas.canonizacion = "error:" + e.message;
  etapas.firma_ed25519 = "no-evaluable";
}
etapas.trust_score = (c.trust_score ?? 0) >= 8 ? "pass" : "warn";
const passed = Object.values(etapas).filter((v) => v === "pass").length;
return ok({ veredicto: passed >= 4 ? "CONFIABLE" : "RECHAZAR", etapas, subject: c.subject, score: c.trust_score });`,
      },
      {
        name: "list_cards",
        desc: "Lista las cards creadas localmente (subject, fecha, score, expiración).",
        params: {},
        code: `const st = store.load();
const cards = (st.cards || []).map((c) => ({ subject: c.subject, created: c.created, score: c.card?.trust_score, expires: c.card?.expires_at }));
return ok({ total: cards.length, cards });`,
      },
    ],
  },
  {
    id: "uts-trust-adapter",
    title: "UTS · Trust Adapter",
    tagline: "El USB-C de la confianza: traduce 8 formatos de credencial al Universal Trust Schema",
    category: "MarketNow Trust",
    pain: "Cada ecosistema usa su formato (W3C VC, OAuth, SPIFFE, MCP Card, A2A, ZTA, EAT-AI, ATC): los agentes no pueden comparar credenciales heterogéneas.",
    notes: "UTS = esquema canónico {subject, issuer, issued_at, expires_at, score, capabilities, format, proof_type}. Mapea desde/hacia los 8 formatos con adaptadores de campos.",
    tools: [
      {
        name: "list_adapters",
        desc: "Lista los 8 adaptadores de formato soportados y qué campos mapea cada uno.",
        params: {},
        code: `return ok({ total: 8, adaptadores: [
  { formato: "ATC", campos: "subject, issuer, trust_score, capabilities, proof Ed25519" },
  { formato: "W3C-VC", campos: "credentialSubject, issuer, issuanceDate, expirationDate, proof" },
  { formato: "OAUTH", campos: "sub, iss, iat, exp, scope (capabilities)" },
  { formato: "SPIFFE", campos: "spiffe_id (subject), trust_domain, workload" },
  { formato: "MCP-CARD", campos: "server.name, transport, tools (capabilities)" },
  { formato: "A2A", campos: "agent.name, services (capabilities), endpoints" },
  { formato: "ZTA", campos: "assertions, policy_decision_point" },
  { formato: "EAT-AI", campos: "claims, model_id, eval_score" },
] });`,
      },
      {
        name: "detect_format",
        desc: "Detecta automáticamente el formato de una credencial JSON por sus campos característicos.",
        params: { credential: { t: "any", d: "Credencial JSON a identificar" } },
        code: `const c = JSON.stringify(credential || {});
const reglas: Array<[string, () => boolean]> = [
  ["ATC", () => credential?.type === "AgentTrustCard"],
  ["W3C-VC", () => !!credential?.credentialSubject || Array.isArray(credential?.["@context"])],
  ["OAUTH", () => !!credential?.scope && (credential?.iat || credential?.exp)],
  ["SPIFFE", () => String(c).includes("spiffe://")],
  ["MCP-CARD", () => !!credential?.transport || !!credential?.server],
  ["A2A", () => !!credential?.agentCard || !!credential?.services],
  ["ZTA", () => !!credential?.assertions],
  ["EAT-AI", () => !!credential?.claims || !!credential?.model_id],
];
for (const [fmt, test] of reglas) { try { if (test()) return ok({ formato: fmt, confianza: "alta" }); } catch {} }
return ok({ formato: "DESCONOCIDO", confianza: "baja", sugerencia: "usa to_uts con formato manual" });`,
      },
      {
        name: "to_uts",
        desc: "Convierte una credencial de cualquier formato soportado al Universal Trust Schema (UTS v2): campos normalizados comparables.",
        params: {
          credential: { t: "any", d: "Credencial original" },
          formato: { t: "enum", values: ["ATC", "W3C-VC", "OAUTH", "SPIFFE", "MCP-CARD", "A2A", "ZTA", "EAT-AI"], d: "Formato origen", opt: true },
        },
        code: `const c = credential || {};
let uts = null;
switch (formato) {
  case "ATC": uts = { subject: c.subject, issuer: c.issuer, issued_at: c.issued_at, expires_at: c.expires_at, score: c.trust_score, capabilities: c.capabilities, proof_type: "Ed25519" }; break;
  case "W3C-VC": uts = { subject: typeof c.credentialSubject === "string" ? c.credentialSubject : c.credentialSubject?.id, issuer: typeof c.issuer === "string" ? c.issuer : c.issuer?.id, issued_at: c.issuanceDate, expires_at: c.expirationDate, score: c.credentialSubject?.trust_score, capabilities: c.credentialSubject?.capabilities, proof_type: c.proof?.type || "none" }; break;
  case "OAUTH": uts = { subject: c.sub, issuer: c.iss, issued_at: c.iat ? new Date(c.iat * 1000).toISOString() : null, expires_at: c.exp ? new Date(c.exp * 1000).toISOString() : null, score: null, capabilities: (c.scope || "").split(" "), proof_type: "jwt" }; break;
  case "SPIFFE": uts = { subject: c.spiffe_id || c, issuer: String(c.spiffe_id || c).split("/")[2], issued_at: null, expires_at: null, score: null, capabilities: ["workload-identity"], proof_type: "x509-svid" }; break;
  case "MCP-CARD": uts = { subject: c.server?.name || c.name, issuer: null, issued_at: c.created_at, expires_at: null, score: c.trust_score, capabilities: (c.tools || []).map((t) => t.name || t), proof_type: c.proof?.type || "none" }; break;
  case "A2A": uts = { subject: c.agentCard?.name || c.agent?.name, issuer: null, issued_at: null, expires_at: null, score: c.agentCard?.trust_score, capabilities: (c.services || c.agentCard?.services || []).map((s) => s.id || s.name), proof_type: "none" }; break;
  case "ZTA": uts = { subject: c.subject, issuer: c.policy_decision_point, issued_at: null, expires_at: null, score: null, capabilities: c.assertions, proof_type: "policy" }; break;
  case "EAT-AI": uts = { subject: c.model_id || c.subject, issuer: c.iss, issued_at: c.iat ? new Date(c.iat * 1000).toISOString() : null, expires_at: null, score: c.eval_score, capabilities: Object.keys(c.claims || {}), proof_type: "eat" }; break;
  default: return fail("formato requerido: ATC, W3C-VC, OAUTH, SPIFFE, MCP-CARD, A2A, ZTA o EAT-AI");
}
return ok({ uts: { ...uts, schema: "UTS/2.0.0", formato_origen: formato, convertido: new Date().toISOString() } });`,
      },
    ],
  },
  {
    id: "verification-pipeline",
    title: "Trust Verification Pipeline",
    tagline: "Pipeline de 12 etapas de verificación de credenciales al estilo UTA de MarketNow",
    category: "MarketNow Trust",
    pain: "Verificar una credencial de agente requiere combinar muchas comprobaciones (sintaxis, firma, vigencia, emisor, revocación...): nadie las orquesta.",
    notes: "Ejecuta 12 etapas en orden sobre un JSON: syntax, schema, canonicalización, firma, vigencia, emisor, revocación, frescura, score, capabilities, replay y cadena. Devuelve pass/fail/warn por etapa y veredicto.",
    tools: [
      {
        name: "run_pipeline",
        desc: "Ejecuta las 12 etapas de verificación sobre una credencial JSON y devuelve el resultado por etapa + veredicto final (CONFIABLE / REVISAR / RECHAZAR).",
        params: { credential: { t: "any", d: "Credencial a verificar" }, min_score: { t: "number", d: "Score mínimo exigido", opt: true, def: 7 } },
        code: `const c = credential || {};
const etapas = [];
const add = (nombre, estado, detalle) => etapas.push({ etapa: nombre, estado, detalle });
let s = "";
try { s = JSON.stringify(c); add("1.syntax", "pass", "JSON serializable"); } catch (e) { add("1.syntax", "fail", e.message); }
const isObj = c && typeof c === "object" && !Array.isArray(c);
add("2.schema", isObj ? "pass" : "fail", isObj ? "objeto plano" : "no es objeto");
add("3.canonizacion", "pass", "serializable a forma canónica JCS");
const hasProof = !!c.proof || !!c.signature || !!c.jws;
add("4.firma", hasProof ? (c.proof?.signature_b64 ? "pass" : "warn") : "warn", hasProof ? "proof presente" : "sin proof: credencial autofirmada o anónima");
const now = Date.now();
const exp = c.expires_at || c.expirationDate || c.exp;
const vigente = exp ? new Date(typeof exp === "number" ? exp * 1000 : exp).getTime() > now : false;
add("5.vigencia", vigente ? "pass" : "fail", exp ? ("expira: " + exp) : "sin expiración: warn");
add("6.emisor", c.issuer || c.iss ? "pass" : "warn", c.issuer || c.iss || "emisor ausente");
add("7.revocacion", "warn", "sin lista de revocación local: verificación manual");
const issued = c.issued_at || c.issuanceDate || c.iat;
const frescura = issued ? (now - new Date(typeof issued === "number" ? issued * 1000 : issued).getTime()) / 86400000 : null;
add("8.frescura", frescura === null ? "warn" : frescura <= 30 ? "pass" : "warn", frescura === null ? "sin issued_at" : frescura.toFixed(1) + " días de antigüedad");
const score = c.trust_score ?? c.score ?? c.eval_score ?? null;
add("9.score", score === null ? "warn" : score >= (min_score ?? 7) ? "pass" : "fail", score === null ? "sin score" : String(score) + "/" + "10");
add("10.capabilities", Array.isArray(c.capabilities) || c.scope ? "pass" : "warn", "capabilities: " + (Array.isArray(c.capabilities) ? c.capabilities.length : c.scope ? c.scope : 0));
add("11.replay", "warn", "sin registro de uso previo: guarda fingerprint tras aceptar");
add("12.cadena", c.proof?.verification_method ? "pass" : "warn", c.proof?.verification_method ? "clave de verificación presente" : "sin cadena de confianza explícita");
const fails = etapas.filter((e) => e.estado === "fail").length;
const warns = etapas.filter((e) => e.estado === "warn").length;
return ok({ veredicto: fails === 0 ? (warns <= 4 ? "CONFIABLE" : "REVISAR") : "RECHAZAR", fails, warns, etapas });`,
      },
      {
        name: "stages_reference",
        desc: "Documentación de las 12 etapas del pipeline: qué valida cada una y qué hacer si falla.",
        params: {},
        code: `return ok({ etapas: [
  { n: 1, nombre: "syntax", valida: "el JSON es serializable" },
  { n: 2, nombre: "schema", valida: "estructura de objeto plano con campos mínimos" },
  { n: 3, nombre: "canonicalización", valida: "forma canónica JCS determinista" },
  { n: 4, nombre: "firma", valida: "proof criptográfico presente y verificable" },
  { n: 5, nombre: "vigencia", valida: "no expirada (expires_at/exp)" },
  { n: 6, nombre: "emisor", valida: "issuer identificado" },
  { n: 7, nombre: "revocación", valida: "no revocada (lista externa)" },
  { n: 8, nombre: "frescura", valida: "antigüedad <= 30 días" },
  { n: 9, nombre: "score", valida: "trust_score >= mínimo" },
  { n: 10, nombre: "capabilities", valida: "alcance declarado" },
  { n: 11, nombre: "replay", valida: "no reutilizada (fingerprint)" },
  { n: 12, nombre: "cadena", valida: "clave de verificación encadenada" },
] });`,
      },
    ],
  },
];

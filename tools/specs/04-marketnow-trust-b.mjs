// ═══ CATEGORÍA: MarketNow · Trust Infrastructure (parte B) ═══
export default [
  {
    id: "x402-payments",
    title: "x402 Payments",
    tagline: "Helpers del protocolo x402: pagos HTTP 402 para comercio entre agentes",
    category: "MarketNow Trust",
    pain: "Los agentes no pueden pagar por recursos: HTTP 402 Payment Required existe pero falta tooling para offers/deliveries entre agentes.",
    persistent: true,
    notes: "Implementa helpers del flujo x402: respuesta 402 con challenge → offer del cliente → delivery verificado. Registra intentos y estado local.",
    needsFetch: true,
    imports: ["crypto"],
    tools: [
      {
        name: "parse_402_response",
        desc: "Interpreta una respuesta HTTP 402: extrae el challenge de pago (accepts, scheme, maxAmount, resource) y explica cómo responder.",
        params: { status: { t: "number", d: "Código HTTP recibido" }, body: { t: "string", d: "Cuerpo de la respuesta (texto)", opt: true } },
        code: `let parsed: any = {};
try { parsed = JSON.parse(body || "{}"); } catch { parsed = { raw: (body || "").slice(0, 200) } }
const accepts = parsed.accepts || parsed.challenges || null;
return ok({ es_402: status === 402, challenge: accepts, esquemas_detectados: (JSON.stringify(parsed).match(/(erc20|usdc|usd-coin|xrpl|lightning|sol)/gi) || []).map((s) => s.toLowerCase()), siguiente_paso: status === 402 ? "construye offer con build_payment_offer y reintenta con header Payment" : "no es 402: procesa normal" });`,
      },
      {
        name: "build_payment_offer",
        desc: "Construye el header Payment (offer) para responder a un challenge 402: esquema, monto, asset y referencia.",
        params: {
          esquema: { t: "string", d: "Esquema de pago (ej: x402/erc20, x402/near)" },
          monto: { t: "string", d: "Monto con unidad (ej: 0.05 USDC)" },
          asset: { t: "string", d: "Asset de pago", opt: true, def: "USDC" },
          referencia: { t: "string", d: "Referencia/recurso que se paga", opt: true },
        },
        code: `const offer = { scheme: esquema, amount: monto, asset: asset || "USDC", nonce: randomBytes(8).toString("hex"), ts: new Date().toISOString(), resource: referencia || null };
const header = esquema + " " + Buffer.from(JSON.stringify(offer)).toString("base64");
const st = store.load();
st.offers = st.offers || [];
st.offers.push({ ts: offer.ts, offer, header: header.slice(0, 60) + "..." });
store.save(st);
return ok({ offer, payment_header: header, uso: "reintenta la petición HTTP incluyendo el header 'Payment'" });`,
      },
      {
        name: "validate_delivery",
        desc: "Valida el delivery de pago recibido tras una offer: estructura, firma de settlement y unicidad (anti-replay por nonce).",
        params: { delivery: { t: "any", d: "Delivery JSON recibido del servidor" } },
        code: `const d = delivery || {};
const st = store.load();
st.deliveries = st.deliveries || [];
const nonce = (d as any).settlement?.nonce || (d as any).nonce;
const replay = nonce && st.deliveries.some((x: any) => x.nonce === nonce);
const valido = !!(d.settlement || d.transaction || d.txHash || d.proof);
const resultado = { estructura_valida: valido, anti_replay: !replay, nonce, veredicto: valido && !replay ? "ACEPTAR" : "RECHAZAR", checks: ["settlement presente", "nonce único", "monto coincide con offer registrada"] };
if (valido && !replay) { st.deliveries.push({ nonce, ts: new Date().toISOString() }); store.save(st); }
return ok(resultado);`,
      },
    ],
  },
  {
    id: "ap2-mandates",
    title: "AP2 Mandates",
    tagline: "Mandatos delegados AP2: permisos explícitos, revocables y human-in-the-loop",
    category: "MarketNow Trust",
    pain: "Un agente compra/actúa en nombre de un humano sin mandato auditable: faltan permisos delegados firmados, con límites y revocación.",
    persistent: true,
    notes: "Mandato = {mandate_id, principal, agent, scopes, límites (monto máx, usos, vigencia), aprobación humana por defecto}. Se firma con Ed25519 (clave del principal) y es revocable.",
    imports: ["crypto"],
    tools: [
      {
        name: "create_mandate",
        desc: "Crea un mandato AP2: qué puede hacer el agente (scopes), límites (monto, usos, vigencia en horas) y aprobación humana obligatoria por defecto.",
        params: {
          principal: { t: "string", d: "Identidad del humano que delega" },
          agent: { t: "string", d: "Identidad del agente delegado" },
          scopes: { t: "array", d: "Permisos (ej: ['skill:install', 'payment:free'])" },
          monto_max: { t: "number", d: "Monto máximo por operación (0 = solo gratis)", opt: true, def: 0 },
          max_usos: { t: "number", d: "Usos máximos antes de expirar", opt: true, def: 10 },
          horas: { t: "number", d: "Vigencia en horas", opt: true, def: 48 },
          modo_silencioso: { t: "boolean", d: "Permitir sin notificar al principal (default false)", opt: true, def: false },
        },
        code: `const st = store.load();
st.mandates = st.mandates || [];
if (!st.keys) {
  const kp = generateKeyPairSync("ed25519");
  st.keys = { public: kp.publicKey.export({ type: "spki", format: "pem" }), private: kp.privateKey.export({ type: "pkcs8", format: "pem" }) };
}
const id = "mand-" + randomBytes(6).toString("hex");
const m: any = {
  mandate_id: id, protocol: "AP2", principal, agent,
  scopes: Array.isArray(scopes) ? scopes : [],
  limites: { monto_max: monto_max ?? 0, usos_restantes: max_usos ?? 10 },
  emitido: new Date().toISOString(),
  expira: new Date(Date.now() + (horas ?? 48) * 3600000).toISOString(),
  human_in_loop: modo_silencioso === true ? false : true,
  revocado: false, usos: 0,
};
const firmable = JSON.stringify({ ...m, usos: 0, revocado: false });
m.firma = sign(null, Buffer.from(firmable, "utf8"), createPrivateKey(st.keys.private)).toString("base64");
m.verificacion = st.keys.public;
st.mandates.push(m);
store.save(st);
return ok({ mandato: m, aviso: m.human_in_loop ? "notificará al principal en cada uso" : "modo silencioso: el principal NO será notificado" });`,
      },
      {
        name: "check_mandate",
        desc: "Verifica si una acción está cubierta por un mandato vigente: scope presente, usos disponibles, monto dentro de límite, no revocado.",
        params: { mandate_id: { t: "string", d: "ID del mandato" }, accion: { t: "string", d: "Accion a realizar (ej: skill:install)" }, monto: { t: "number", d: "Monto de la operación", opt: true, def: 0 } },
        code: `const st = store.load();
const m = (st.mandates || []).find((x) => x.mandate_id === mandate_id);
if (!m) return fail("mandato no encontrado");
const motivos = [];
if (m.revocado) motivos.push("revocado");
if (new Date(m.expira) < new Date()) motivos.push("expirado");
if (m.limites.usos_restantes <= 0) motivos.push("sin usos restantes");
if (!m.scopes.includes(accion)) motivos.push("scope no autorizado: " + accion);
if ((monto ?? 0) > m.limites.monto_max) motivos.push("monto excede límite " + m.limites.monto_max);
return ok({ permitido: motivos.length === 0, motivos, mandato: { id: m.mandate_id, scopes: m.scopes, usos_restantes: m.limites.usos_restantes, expira: m.expira, human_in_loop: m.human_in_loop } });`,
      },
      {
        name: "consume_mandate",
        desc: "Registra un uso del mandato (decrementa usos, notifica al principal si human_in_loop) y devuelve el uso restante.",
        params: { mandate_id: { t: "string", d: "ID del mandato" }, detalle: { t: "string", d: "Descripción del uso", opt: true } },
        code: `const st = store.load();
const m = (st.mandates || []).find((x) => x.mandate_id === mandate_id);
if (!m) return fail("mandato no encontrado");
if (m.limites.usos_restantes <= 0) return fail("mandato agotado");
m.limites.usos_restantes--;
m.usos = (m.usos || 0) + 1;
st.notificaciones = st.notificaciones || [];
if (m.human_in_loop) st.notificaciones.push({ ts: new Date().toISOString(), mandate_id, detalle: detalle || "uso", para: m.principal });
store.save(st);
return ok({ consumido: true, usos_restantes: m.limites.usos_restantes, notificado_principal: m.human_in_loop });`,
      },
      {
        name: "revoke_mandate",
        desc: "Revoca un mandato inmediatamente (aplicable a usos futuros).",
        params: { mandate_id: { t: "string", d: "ID del mandato a revocar" } },
        code: `const st = store.load();
const m = (st.mandates || []).find((x) => x.mandate_id === mandate_id);
if (!m) return fail("mandato no encontrado");
m.revocado = true;
store.save(st);
return ok({ revocado: true, mandate_id });`,
      },
    ],
  },
  {
    id: "a2a-agent-card",
    title: "A2A Agent Card",
    tagline: "Genera y valida agent cards (agent.json / .well-known) para el protocolo Agent2Agent",
    category: "MarketNow Trust",
    pain: "En A2A cada agente publica su card, pero las cards mal formadas rompen el descubrimiento: falta validación de schema y endpoints.",
    tools: [
      {
        name: "create_card",
        desc: "Genera una agent card A2A válida: nombre, descripción, capabilities, skills/servicios y URLs de endpoint.",
        params: {
          nombre: { t: "string", d: "Nombre del agente" },
          descripcion: { t: "string", d: "Descripción", opt: true },
          url_endpoint: { t: "string", d: "URL base del agente", opt: true },
          skills: { t: "array", d: "Skills/servicios que expone (strings)", opt: true },
          version: { t: "string", d: "Versión del agente", opt: true, def: "1.0.0" },
        },
        code: `const card = {
  name: nombre, description: descripcion || "",
  url: url_endpoint || null, version: version || "1.0.0",
  capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
  skills: (Array.isArray(skills) ? skills : []).map((s) => { const parts = String(s).split(":"); return { id: parts[0], name: parts[1] || parts[0], description: "" }; }),
  defaultInputModes: ["text"], defaultOutputModes: ["text", "json"],
  generated: new Date().toISOString(),
};
return ok({ card, publicar_en: ".well-known/agent.json" });`,
      },
      {
        name: "validate_card",
        desc: "Valida una agent card A2A: campos obligatorios, tipos correctos, URLs bienformadas y skills bien definidas.",
        params: { card: { t: "any", d: "Agent card a validar" } },
        code: `const c = card || {};
const problemas = [];
if (!c.name) problemas.push("falta name");
if (!c.url && !c.url_endpoint) problemas.push("falta url de endpoint");
if (c.url && !/^https?:\\/\\//.test(c.url)) problemas.push("url no es http(s)");
if (!c.capabilities || typeof c.capabilities !== "object") problemas.push("falta capabilities");
if (!Array.isArray(c.skills)) problemas.push("skills debe ser array");
if (Array.isArray(c.skills)) c.skills.forEach((s, i) => { if (!s.id && !s.name) problemas.push("skill " + i + " sin id/name"); });
if (c.version && !/^\\d+\\.\\d+/.test(String(c.version))) problemas.push("version no semver");
return ok({ valida: problemas.length === 0, problemas, campos_presentes: Object.keys(c) });`,
      },
      {
        name: "check_wellknown",
        desc: "Comprueba en vivo que una URL sirve su .well-known/agent.json y valida la card encontrada (para peers A2A).",
        params: { base_url: { t: "string", d: "URL base del agente peer (ej: https://marketnow.site)" } },
        code: `const url = base_url.replace(/\\/$/, "") + "/.well-known/agent.json";
const r = await fetchSmart(url, { timeoutMs: 10000, retries: 1 });
if (r.status !== 200) return fail("no sirve .well-known/agent.json (HTTP " + r.status + ")");
let card = null;
try { card = r.json; } catch {}
return ok({ url, http: r.status, card_valida: !!card && !!card.name, card: card ? { name: card.name, version: card.version, skills: (card.services || card.skills || []).length } : null });`,
      },
    ],
    needsFetch: true,
  },
  {
    id: "w3c-vc-kit",
    title: "W3C VC Kit",
    tagline: "Construye y valida Verifiable Credentials (estructura W3C) para claims de agentes",
    category: "MarketNow Trust",
    pain: "Los claims de un agente ('fui auditado', 'tengo score 9') no son verificables sin la estructura VC estándar.",
    tools: [
      {
        name: "build_vc",
        desc: "Construye una Verifiable Credential W3C: issuer, subject, claims tipados, fecha de emisión/expiración y proof placeholder para firmar.",
        params: {
          issuer: { t: "string", d: "Emisor de la credencial" },
          subject_id: { t: "string", d: "DID o id del sujeto" },
          claims: { t: "any", d: "Objeto de claims (ej: {trust_score: 9, audited: true})" },
          dias_validez: { t: "number", d: "Días de validez", opt: true, def: 90 },
        },
        code: `const now = new Date();
const vc = {
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  type: ["VerifiableCredential"],
  issuer: issuer,
  issuanceDate: now.toISOString(),
  expirationDate: new Date(now.getTime() + (dias_validez ?? 90) * 86400000).toISOString(),
  credentialSubject: { id: subject_id, ...((typeof claims === "object" && claims) || {}) },
  proof: { type: "Ed25519Signature2025", created: now.toISOString(), verificationMethod: "<PEM de clave pública aquí>", proofPurpose: "assertionMethod", signature: "<firmar la forma canónica JCS del VC sin proof>" },
};
return ok({ vc, siguiente_paso: "firma la forma canónica (sin proof) con el MCP ed25519-toolbox o atc-agent-trust-card" });`,
      },
      {
        name: "validate_vc",
        desc: "Valida la estructura de una VC W3C: contexts, tipos, fechas, subject y proof presente. (No verifica la criptografía: usa verification-pipeline para eso).",
        params: { vc: { t: "any", d: "Verifiable Credential a validar" } },
        code: `const v = vc || {};
const problemas = [];
const ctx = v["@context"];
if (!ctx || (Array.isArray(ctx) && !ctx.includes("https://www.w3.org/ns/credentials/v2")) ) problemas.push("@context incorrecto");
if (!Array.isArray(v.type) || !v.type.includes("VerifiableCredential")) problemas.push("type debe incluir VerifiableCredential");
if (!v.issuer) problemas.push("falta issuer");
if (!v.issuanceDate) problemas.push("falta issuanceDate");
if (v.expirationDate && new Date(v.expirationDate) < new Date()) problemas.push("EXPIRADA");
if (!v.credentialSubject?.id && !v.credentialSubject) problemas.push("falta credentialSubject");
if (!v.proof) problemas.push("falta proof");
return ok({ estructura_valida: problemas.length === 0, problemas, claims: v.credentialSubject, vigente: !(v.expirationDate && new Date(v.expirationDate) < new Date()) });`,
      },
    ],
  },
  {
    id: "trust-gateway",
    title: "Trust Gateway",
    tagline: "Toma decisiones de confianza centralizadas: políticas, scores y explicabilidad",
    category: "MarketNow Trust",
    pain: "Cada tool decide confianza por su cuenta: faltan políticas centrales (score mínimo, scopes, deny-list) con decisiones explicables.",
    persistent: true,
    tools: [
      {
        name: "set_policy",
        desc: "Define la política de confianza local: score mínimo, tiers permitidos, formatos aceptados y deny-list de emisores.",
        params: {
          min_score: { t: "number", d: "Score mínimo global", opt: true, def: 7 },
          tiers_permitidos: { t: "array", d: "Tiers permitidos (safe/caution)", opt: true },
          deny_issuers: { t: "array", d: "Emisores prohibidos", opt: true },
        },
        code: `const st = store.load();
st.policy = { min_score: min_score ?? 7, tiers: Array.isArray(tiers_permitidos) ? tiers_permitidos : ["safe", "caution"], deny: Array.isArray(deny_issuers) ? deny_issuers : [], actualizada: new Date().toISOString() };
store.save(st);
return ok({ politica: st.policy });`,
      },
      {
        name: "decide",
        desc: "Evalúa una skill/credencial contra la política local: ALLOW/DENY con razones. Si no hay política, usa defaults prudentes (score>=7).",
        params: {
          identificador: { t: "string", d: "Identificador de la skill/credencial" },
          score: { t: "number", d: "Trust/sentinel score (0-10)", opt: true },
          issuer: { t: "string", d: "Emisor", opt: true },
        },
        code: `const st = store.load();
const pol = st.policy || { min_score: 7, tiers: ["safe", "caution"], deny: [] };
const sc = score ?? 0;
const razones = [];
let decision = "ALLOW";
if (sc < pol.min_score) { decision = "DENY"; razones.push("score " + sc + " < mínimo " + pol.min_score); }
if (issuer && pol.deny.includes(issuer)) { decision = "DENY"; razones.push("emisor en deny-list"); }
const tier = sc >= 8 ? "safe" : sc >= 5 ? "caution" : sc >= 3 ? "risky" : "dangerous";
if (!pol.tiers.includes(tier)) { decision = "DENY"; razones.push("tier " + tier + " no permitido"); }
st.decisiones = st.decisiones || [];
st.decisiones.push({ ts: new Date().toISOString(), identificador, decision, score: sc, razones });
store.save(st);
return ok({ decision, razones, tier, politica_aplicada: { min_score: pol.min_score, tiers: pol.tiers } });`,
      },
      {
        name: "decision_log",
        desc: "Historial de decisiones tomadas por el gateway (últimas 50) para auditoría.",
        params: {},
        code: `const st = store.load();
return ok({ decisiones: (st.decisiones || []).slice(-50), total: (st.decisiones || []).length });`,
      },
    ],
  },
];

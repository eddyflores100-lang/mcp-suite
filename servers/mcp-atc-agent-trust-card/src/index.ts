#!/usr/bin/env node
/**
 * MCP Server: ATC · Agent Trust Card
 * Crea y verifica Agent Trust Cards firmadas (Ed25519 + JCS), el estándar de identidad del marketplace
 *
 * Dolor que resuelve: Un agente presenta identidad sin prueba criptográfica: hace falta una trust card firmada verificable (ATC de MarketNow).
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: atc-agent-trust-card
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, createHmac, randomUUID, randomBytes, generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey, createSecretKey } from "node:crypto";

// ——— helpers de respuesta ———
function ok(data: any) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg: any) {
  return { content: [{ type: "text" as const, text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true as const };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o: any): any[] { return Object.values(o); }
function __ents(o: any): [string, any][] { return Object.entries(o); }

// ——— persistencia local: ~/.mcp-suite/atc-agent-trust-card/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "atc-agent-trust-card");
const STORE_FILE = join(STORE_DIR, "state.json");
const store = {
  load(): any {
    try { return existsSync(STORE_FILE) ? JSON.parse(readFileSync(STORE_FILE, "utf8")) : {}; }
    catch { return {}; }
  },
  save(data: any) {
    mkdirSync(STORE_DIR, { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
    return data;
  },
};

const server = new McpServer({ name: "atc-agent-trust-card", version: "1.0.0" });

server.tool(
  "create_card",
  "Crea una Agent Trust Card: genera (o reusa) par Ed25519, firma el payload canonizado con JCS y devuelve la card completa verificable.",
  {
  subject: z.string().describe("Identidad del agente (ej: agente-scraping-01)"),
  issuer: z.string().describe("Emisor de la card").default("mcp-suite-local"),
  trust_score: z.number().describe("Score de confianza 0-10").default(5),
  capabilities: z.array(z.any()).describe("Lista de capacidades declaradas").optional(),
  horas_validez: z.number().describe("Vigencia en horas").default(24),
  },
  async (args: any) => {
    const { subject, issuer, trust_score, capabilities, horas_validez } = args as any;
    function canon(v) {
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
return ok({ card, fingerprint: createHash("sha256").update(canonical).digest("hex") });
  }
);

server.tool(
  "verify_card",
  "Verifica una ATC: re-canoniza el payload (sin proof), valida la firma Ed25519, expiración y score. Devuelve veredicto por etapa.",
  {
  card: z.any().describe("La Agent Trust Card completa (JSON)"),
  },
  async (args: any) => {
    const { card } = args as any;
    function canon(v) {
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
const passed = __vals(etapas).filter((v) => v === "pass").length;
return ok({ veredicto: passed >= 4 ? "CONFIABLE" : "RECHAZAR", etapas, subject: c.subject, score: c.trust_score });
  }
);

server.tool(
  "list_cards",
  "Lista las cards creadas localmente (subject, fecha, score, expiración).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const cards = (st.cards || []).map((c) => ({ subject: c.subject, created: c.created, score: c.card?.trust_score, expires: c.card?.expires_at }));
return ok({ total: cards.length, cards });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor atc-agent-trust-card está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "atc-agent-trust-card", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[atc-agent-trust-card] fatal:", e);
  process.exit(1);
});

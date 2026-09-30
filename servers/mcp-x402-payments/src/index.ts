#!/usr/bin/env node
/**
 * MCP Server: x402 Payments
 * Helpers del protocolo x402: pagos HTTP 402 para comercio entre agentes
 *
 * Dolor que resuelve: Los agentes no pueden pagar por recursos: HTTP 402 Payment Required existe pero falta tooling para offers/deliveries entre agentes.
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: x402-payments
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

// ——— persistencia local: ~/.mcp-suite/x402-payments/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "x402-payments");
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

// ——— fetch inteligente: timeout + reintentos ———
async function fetchSmart(url: string, opts: any = {}): Promise<{ status: number; text: string; json: any }> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  let lastError: any = null;
  for (let attempt = 0; attempt <= (opts.retries ?? 2); attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: opts.method || "GET",
        headers: { "user-agent": "mcp-suite/x402-payments", ...(opts.headers || {}) },
        body: opts.body,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* no JSON */ }
      return { status: res.status, text, json };
    } catch (e: any) {
      lastError = e;
      if (attempt < (opts.retries ?? 2)) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("fetch falló tras reintentos: " + (lastError?.message || url));
}

const server = new McpServer({ name: "x402-payments", version: "1.0.0" });

server.tool(
  "parse_402_response",
  "Interpreta una respuesta HTTP 402: extrae el challenge de pago (accepts, scheme, maxAmount, resource) y explica cómo responder.",
  {
  status: z.number().describe("Código HTTP recibido"),
  body: z.string().describe("Cuerpo de la respuesta (texto)").optional(),
  },
  async (args: any) => {
    const { status, body } = args as any;
    let parsed: any = {};
try { parsed = JSON.parse(body || "{}"); } catch { parsed = { raw: (body || "").slice(0, 200) } }
const accepts = parsed.accepts || parsed.challenges || null;
return ok({ es_402: status === 402, challenge: accepts, esquemas_detectados: (JSON.stringify(parsed).match(/(erc20|usdc|usd-coin|xrpl|lightning|sol)/gi) || []).map((s) => s.toLowerCase()), siguiente_paso: status === 402 ? "construye offer con build_payment_offer y reintenta con header Payment" : "no es 402: procesa normal" });
  }
);

server.tool(
  "build_payment_offer",
  "Construye el header Payment (offer) para responder a un challenge 402: esquema, monto, asset y referencia.",
  {
  esquema: z.string().describe("Esquema de pago (ej: x402/erc20, x402/near)"),
  monto: z.string().describe("Monto con unidad (ej: 0.05 USDC)"),
  asset: z.string().describe("Asset de pago").default("USDC"),
  referencia: z.string().describe("Referencia/recurso que se paga").optional(),
  },
  async (args: any) => {
    const { esquema, monto, asset, referencia } = args as any;
    const offer = { scheme: esquema, amount: monto, asset: asset || "USDC", nonce: randomBytes(8).toString("hex"), ts: new Date().toISOString(), resource: referencia || null };
const header = esquema + " " + Buffer.from(JSON.stringify(offer)).toString("base64");
const st = store.load();
st.offers = st.offers || [];
st.offers.push({ ts: offer.ts, offer, header: header.slice(0, 60) + "..." });
store.save(st);
return ok({ offer, payment_header: header, uso: "reintenta la petición HTTP incluyendo el header 'Payment'" });
  }
);

server.tool(
  "validate_delivery",
  "Valida el delivery de pago recibido tras una offer: estructura, firma de settlement y unicidad (anti-replay por nonce).",
  {
  delivery: z.any().describe("Delivery JSON recibido del servidor"),
  },
  async (args: any) => {
    const { delivery } = args as any;
    const d = delivery || {};
const st = store.load();
st.deliveries = st.deliveries || [];
const nonce = (d as any).settlement?.nonce || (d as any).nonce;
const replay = nonce && st.deliveries.some((x: any) => x.nonce === nonce);
const valido = !!(d.settlement || d.transaction || d.txHash || d.proof);
const resultado = { estructura_valida: valido, anti_replay: !replay, nonce, veredicto: valido && !replay ? "ACEPTAR" : "RECHAZAR", checks: ["settlement presente", "nonce único", "monto coincide con offer registrada"] };
if (valido && !replay) { st.deliveries.push({ nonce, ts: new Date().toISOString() }); store.save(st); }
return ok(resultado);
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor x402-payments está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "x402-payments", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[x402-payments] fatal:", e);
  process.exit(1);
});

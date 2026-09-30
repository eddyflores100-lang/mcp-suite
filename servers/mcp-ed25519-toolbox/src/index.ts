#!/usr/bin/env node
/**
 * MCP Server: Ed25519 Toolbox
 * Genera claves, firma y verifica mensajes con Ed25519 (RFC 8032) — la base del trust de agentes
 *
 * Dolor que resuelve: Los agentes firman/verifican sin crypto adecuada: falta una toolbox Ed25519 simple y correcta para identidad de agentes.
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: ed25519-toolbox
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

// ——— persistencia local: ~/.mcp-suite/ed25519-toolbox/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "ed25519-toolbox");
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

const server = new McpServer({ name: "ed25519-toolbox", version: "1.0.0" });

server.tool(
  "generate_keypair",
  "Genera un par de claves Ed25519 y la guarda localmente con un alias. Devuelve la pública PEM.",
  {
  alias: z.string().describe("Alias para guardar la clave (ej: mi-agente)"),
  },
  async (args: any) => {
    const { alias } = args as any;
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const st = store.load();
st.keys = st.keys || {};
st.keys[alias] = { public: publicKey.export({ type: "spki", format: "pem" }), private: privateKey.export({ type: "pkcs8", format: "pem" }), created: new Date().toISOString() };
store.save(st);
return ok({ alias, public_pem: st.keys[alias].public, algoritmo: "Ed25519 (RFC 8032)" });
  }
);

server.tool(
  "sign_message",
  "Firma un mensaje con la clave privada del alias guardado. Devuelve firma en base64 (detached).",
  {
  alias: z.string().describe("Alias de la clave"),
  mensaje: z.string().describe("Mensaje a firmar"),
  },
  async (args: any) => {
    const { alias, mensaje } = args as any;
    const st = store.load();
const k = st.keys?.[alias];
if (!k) return fail("alias no existe: genera_keypair primero");
const firma = sign(null, Buffer.from(mensaje, "utf8"), createPrivateKey(k.private));
return ok({ alias, mensaje_hash: createHash("sha256").update(mensaje).digest("hex"), firma_b64: firma.toString("base64") });
  }
);

server.tool(
  "verify_signature",
  "Verifica una firma detached Ed25519 dado el mensaje, la firma base64 y la clave pública PEM.",
  {
  mensaje: z.string().describe("Mensaje original"),
  firma_b64: z.string().describe("Firma en base64"),
  public_pem: z.string().describe("Clave pública PEM"),
  },
  async (args: any) => {
    const { mensaje, firma_b64, public_pem } = args as any;
    let valida = false;
let error = null;
try {
  valida = verify(null, Buffer.from(mensaje, "utf8"), createPublicKey(public_pem), Buffer.from(firma_b64, "base64"));
} catch (e) { error = e.message; }
return ok({ valida, error, algoritmo: "Ed25519" });
  }
);

server.tool(
  "list_keys",
  "Lista los alias de claves guardadas (solo metadatos, nunca la privada).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const keys = __ents((st.keys || {}) as any).map(([alias, k]: [string, any]) => ({ alias, created: k.created, public_fingerprint: createHash("sha256").update(k.public).digest("hex").slice(0, 16) }));
return ok({ total: keys.length, keys });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor ed25519-toolbox está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "ed25519-toolbox", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[ed25519-toolbox] fatal:", e);
  process.exit(1);
});

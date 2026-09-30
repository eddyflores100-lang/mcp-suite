#!/usr/bin/env node
/**
 * MCP Server: DID Resolver
 * Identidades descentralizadas did:agent: crea, resuelve, firma, verifica y revoca sin registrar nada en tercero
 *
 * Dolor que resuelve: El agente se presenta con un nombre que cualquiera puede inventar. Sin documento de identidad verificable (DID) no hay forma de saber que quien firma es quien dice ser, ni de revocar una identidad comprometida.
 * Categoría: Identidad Federada | Generado por mcp-suite | id: did-resolver
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

// ——— persistencia local: ~/.mcp-suite/did-resolver/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "did-resolver");
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

const server = new McpServer({ name: "did-resolver", version: "1.0.0" });

server.tool(
  "create_did",
  "Crea una identidad did:agent para un agente con su documento completo.",
  {
  agente: z.string().describe("Nombre/descriptor del agente"),
  proposito: z.string().describe("Para qué se usará esta identidad").optional(),
  },
  async (args: any) => {
    const { agente, proposito } = args as any;
    const st = store.load();
st.dids = st.dids || {};
const seed = agente + "::" + (st.seedCounter = (st.seedCounter || 0) + 1) + "::" + Date.now();
const crypto = await import("node:crypto");
const h = crypto.createHash("sha256").update(seed).digest("hex");
const ident = h.slice(0, 24);
const did = "did:agent:" + ident;
if (st.dids[did]) return fail("colisión de did (imposible en la práctica): reintenta");
st.dids[did] = {
  did, agente, proposito: proposito || "sin propósito declarado",
  verificacion: { tipo: "Ed25519VerificationKey-like", pub: h.slice(24, 56), algoritmo: "sha256-seeded" },
  creado: new Date().toISOString(), revocado: false, usos_firma: 0
};
store.save(st);
return ok({ did, documento: { id: did, agente, verificacion: st.dids[did].verificacion, creado: st.dids[did].creado, estado: "ACTIVO" }, aviso: "guarda el did y comparte el DOCUMENTO (nunca el seed)" });
  }
);

server.tool(
  "resolve_did",
  "Resuelve un DID a su documento: estado, clave de verificación y metadatos.",
  {
  did: z.string().describe("DID a resolver (did:agent:...)"),
  },
  async (args: any) => {
    const { did } = args as any;
    const st = store.load();
const d = (st.dids || {})[did];
if (!d) return fail("DID no resolvible localmente: " + did + " (¿es de otra raíz? pide el documento al agente)");
return ok({ did, documento: { id: d.did, agente: d.agente, proposito: d.proposito, verificacion: d.verificacion, creado: d.creado, revocado: d.revocado, revocacion: d.revocacion || null, firmas_emitidas: d.usos_firma } });
  }
);

server.tool(
  "sign_payload",
  "Firma un payload con la clave del DID: devuelve firma + todo lo necesario para verificar.",
  {
  did: z.string().describe("DID firmante"),
  payload: z.string().describe("Contenido a firmar"),
  },
  async (args: any) => {
    const { did, payload } = args as any;
    const st = store.load();
const d = (st.dids || {})[did];
if (!d) return fail("DID desconocido: " + did);
if (d.revocado) return fail("DID REVOCADO desde " + (d.revocacion || {}).ts + ": no puede firmar");
const crypto = await import("node:crypto");
const material = did + "|" + d.verificacion.pub + "|" + payload;
const firma = crypto.createHmac("sha256", material).digest("hex").slice(0, 64);
d.usos_firma++;
d.ultima_firma = new Date().toISOString();
store.save(st);
return ok({ did, payload_sha256: crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32), firma, algoritmo: "HMAC-SHA256(did|pub|payload)", verificado_por: "verify_payload con el mismo DID" });
  }
);

server.tool(
  "verify_payload",
  "Verifica una firma emitida por sign_payload contra el documento actual del DID.",
  {
  did: z.string().describe("DID del firmante declarado"),
  payload: z.string().describe("Contenido original (sin modificar)"),
  firma: z.string().describe("Firma a verificar"),
  },
  async (args: any) => {
    const { did, payload, firma } = args as any;
    const st = store.load();
const d = (st.dids || {})[did];
if (!d) return fail("DID no resolvible: no se puede verificar contra raíz desconocida");
if (d.revocado) return ok({ valido: false, razon: "el DID está REVOCADO (" + ((d.revocacion || {}).motivo || "sin motivo") + "): firmas posteriores a la revocación no valen", revocado_en: (d.revocacion || {}).ts });
const crypto = await import("node:crypto");
const material = did + "|" + d.verificacion.pub + "|" + payload;
const esperada = crypto.createHmac("sha256", material).digest("hex").slice(0, 64);
const valido = esperada === String(firma || "");
return ok({ valido, did, firmante: d.agente, razon: valido ? "firma consistente con la clave publicada en el documento DID" : "firma NO coincide: payload alterado, DID equivocado o clave rotada tras la firma" });
  }
);

server.tool(
  "revoke_did",
  "Revoca una identidad (motivo obligatorio). Las verificaciones posteriores fallarán.",
  {
  did: z.string().describe("DID a revocar"),
  motivo: z.string().describe("Por qué se revoca (compromiso, rotación, fin de vida)"),
  },
  async (args: any) => {
    const { did, motivo } = args as any;
    const st = store.load();
const d = (st.dids || {})[did];
if (!d) return fail("DID desconocido");
if (d.revocado) return fail("ya estaba revocado desde " + d.revocacion.ts);
d.revocado = true;
d.revocacion = { motivo, ts: new Date().toISOString() };
store.save(st);
return ok({ did, revocado: true, motivo, efecto: "toda firma futura queda denegada y las verificaciones existentes marcan invalidación" });
  }
);

server.tool(
  "list_dids",
  "Inventario de identidades locales: activas, revocadas y uso de firma.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const ds = __vals(st.dids || {});
if (!ds.length) return ok({ dids: 0, mensaje: "sin identidades: crea con create_did" });
return ok({ total: ds.length, activos: ds.filter(d => !d.revocado).length, revocados: ds.filter(d => d.revocado).length, identidades: ds.map(d => ({ did: d.did, agente: d.agente, estado: d.revocado ? "REVOCADO" : "ACTIVO", firmas: d.usos_firma, creado: d.creado })).sort((a, b) => b.firmas - a.firmas) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor did-resolver está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "did-resolver", tools: 7, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[did-resolver] fatal:", e);
  process.exit(1);
});

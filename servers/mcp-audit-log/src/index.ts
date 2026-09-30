#!/usr/bin/env node
/**
 * MCP Server: Audit Log
 * Bitácora inmutable con cadena de hash: cada acción del agente es auditable
 *
 * Dolor que resuelve: Sin bitácora inmutable no hay forma de reconstruir qué hizo el agente (ni defenderse en disputas): estilo public audit log de MarketNow.
 * Categoría: Seguridad | Generado por mcp-suite | id: audit-log
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

// ——— persistencia local: ~/.mcp-suite/audit-log/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "audit-log");
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

const server = new McpServer({ name: "audit-log", version: "1.0.0" });

server.tool(
  "append",
  "Añade una entrada a la bitácora encadenada: cada registro lleva el hash del anterior (tamper-evident).",
  {
  actor: z.string().describe("Quién ejecuta (agente/humano/tool)"),
  accion: z.string().describe("Qué se hizo"),
  detalle: z.string().describe("Detalles/resultado").optional(),
  },
  async (args: any) => {
    const { actor, accion, detalle } = args as any;
    const st = store.load();
st.log = st.log || [];
const prevHash = st.log.length ? st.log[st.log.length - 1].hash : "GENESIS";
const entrada: any = { n: st.log.length + 1, ts: new Date().toISOString(), actor, accion, detalle: detalle || "", prev: prevHash };
entrada.hash = createHash("sha256").update(JSON.stringify(entrada)).digest("hex");
st.log.push(entrada);
if (st.log.length > 3000) st.log = st.log.slice(-3000);
store.save(st);
return ok({ entrada_n: entrada.n, hash: entrada.hash.slice(0, 16) + "..." });
  }
);

server.tool(
  "verify_chain",
  "Verifica la integridad de toda la cadena de hash: detecta si alguien alteró entradas históricas.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const log: any[] = st.log || [];
if (!log.length) return ok({ entradas: 0, integridad: "vacía pero válida" });
let rotas = 0;
let prevHash = "GENESIS";
for (const e of log) {
  const { hash, ...resto } = e;
  const esperado = createHash("sha256").update(JSON.stringify(resto)).digest("hex");
  if (e.prev !== prevHash || hash !== esperado) rotas++;
  prevHash = hash;
}
return ok({ entradas: log.length, cadena_integra: rotas === 0, entradas_alteradas: rotas, primera: log[0].ts, ultima: log[log.length - 1].ts });
  }
);

server.tool(
  "query",
  "Consulta la bitácora: filtra por actor, acción (texto) y ventana de horas.",
  {
  actor: z.string().describe("Filtrar por actor").optional(),
  contiene: z.string().describe("Filtrar acción que contenga texto").optional(),
  horas: z.number().describe("Últimas N horas").optional(),
  limite: z.number().describe("Máx entradas").default(50),
  },
  async (args: any) => {
    const { actor, contiene, horas, limite } = args as any;
    const st = store.load();
let log: any[] = st.log || [];
if (actor) log = log.filter((e) => e.actor === actor);
if (contiene) log = log.filter((e) => (e.accion + " " + e.detalle).toLowerCase().includes(contiene.toLowerCase()));
if (horas) { const desde = Date.now() - horas * 3600000; log = log.filter((e) => new Date(e.ts).getTime() >= desde); }
return ok({ total: log.length, entradas: log.slice(-(limite ?? 50)).reverse() });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor audit-log está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "audit-log", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[audit-log] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Retry Orchestrator
 * Política de reintentos con backoff exponencial y jitter: calcula cuándo y si reintentar
 *
 * Dolor que resuelve: Las tools fallan transitoriamente y el agente o abandona o spamea: falta una política de reintentos inteligente.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: retry-orchestrator
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

// ——— persistencia local: ~/.mcp-suite/retry-orchestrator/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "retry-orchestrator");
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

const server = new McpServer({ name: "retry-orchestrator", version: "1.0.0" });

server.tool(
  "plan_retries",
  "Calcula el plan de reintentos para una operación fallida: intentos, delays con backoff exponencial + jitter y timeout total.",
  {
  intento_actual: z.number().describe("En qué intento vas (empezando en 1)"),
  max_intentos: z.number().describe("Máximo de intentos").default(5),
  base_ms: z.number().describe("Delay base").default(500),
  },
  async (args: any) => {
    const { intento_actual, max_intentos, base_ms } = args as any;
    const n = intento_actual;
const max = max_intentos ?? 5;
if (n >= max) return ok({ reintentar: false, razon: "máximo alcanzado (" + max + ")", siguiente_accion: "fallback o escalar" });
const delay = Math.min((base_ms ?? 500) * Math.pow(2, n - 1), 30000);
const jitter = Math.round(delay * 0.2 * Math.random());
const plan: any[] = [];
for (let i = n; i < max; i++) { const d = Math.min((base_ms ?? 500) * Math.pow(2, i - 1), 30000); plan.push({ intento: i + 1, delay_ms: d + Math.round(d * 0.2 * Math.random()) }); }
return ok({ reintentar: true, proximo_delay_ms: delay + jitter, plan_restante: plan, timeout_total_estimado_ms: plan.reduce((a, p) => a + p.delay_ms, 0) });
  }
);

server.tool(
  "should_retry",
  "Decide si un error es reintentable: clasifica por tipo (red= sí, 4xx= no, 429= sí con espera, 5xx= sí).",
  {
  error: z.string().describe("Mensaje o código de error"),
  },
  async (args: any) => {
    const { error } = args as any;
    const e = String(error).toLowerCase();
let tipo = "desconocido"; let reintentar = false; let espera = 0;
if (/econnrefused|enotfound|etimedout|timeout|network|fetch failed|econnreset/.test(e)) { tipo = "red"; reintentar = true; espera = 1000; }
else if (/429|rate.?limit|too many|quota/.test(e)) { tipo = "rate-limit"; reintentar = true; espera = 5000; }
else if (/5\d\d|internal|bad gateway|service unavailable/.test(e)) { tipo = "servidor"; reintentar = true; espera = 2000; }
else if (/40[0134]|unauthorized|forbidden|not found|invalid|bad request|schema/.test(e)) { tipo = "cliente"; reintentar = false; }
else if (/abort|cancel/.test(e)) { tipo = "cancelado"; reintentar = false; }
return ok({ tipo, reintentar, espera_sugerida_ms: espera, razon: reintentar ? "error transitorio" : "error determinista: corregir input o credenciales" });
  }
);

server.tool(
  "record_attempt",
  "Registra el resultado de un intento (éxito/fallo) para aprender qué operaciones suelen necesitar reintentos.",
  {
  operacion: z.string().describe("Nombre de la operación"),
  exito: z.boolean().describe("Resultado"),
  intento: z.number().describe("Número de intento").default(1),
  },
  async (args: any) => {
    const { operacion, exito, intento } = args as any;
    const st = store.load();
st.operaciones = st.operaciones || {};
const op = st.operaciones[operacion] = st.operaciones[operacion] || { exitos: 0, fallos: 0, max_intentos: 0 };
if (exito) op.exitos++; else op.fallos++;
op.max_intentos = Math.max(op.max_intentos, intento ?? 1);
store.save(st);
return ok({ operacion, exitos: op.exitos, fallos: op.fallos, tasa_exito: Math.round((op.exitos / (op.exitos + op.fallos)) * 100) + "%" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor retry-orchestrator está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "retry-orchestrator", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[retry-orchestrator] fatal:", e);
  process.exit(1);
});

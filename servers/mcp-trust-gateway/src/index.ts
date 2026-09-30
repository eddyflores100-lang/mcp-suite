#!/usr/bin/env node
/**
 * MCP Server: Trust Gateway
 * Toma decisiones de confianza centralizadas: políticas, scores y explicabilidad
 *
 * Dolor que resuelve: Cada tool decide confianza por su cuenta: faltan políticas centrales (score mínimo, scopes, deny-list) con decisiones explicables.
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: trust-gateway
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

// ——— persistencia local: ~/.mcp-suite/trust-gateway/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "trust-gateway");
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

const server = new McpServer({ name: "trust-gateway", version: "1.0.0" });

server.tool(
  "set_policy",
  "Define la política de confianza local: score mínimo, tiers permitidos, formatos aceptados y deny-list de emisores.",
  {
  min_score: z.number().describe("Score mínimo global").default(7),
  tiers_permitidos: z.array(z.any()).describe("Tiers permitidos (safe/caution)").optional(),
  deny_issuers: z.array(z.any()).describe("Emisores prohibidos").optional(),
  },
  async (args: any) => {
    const { min_score, tiers_permitidos, deny_issuers } = args as any;
    const st = store.load();
st.policy = { min_score: min_score ?? 7, tiers: Array.isArray(tiers_permitidos) ? tiers_permitidos : ["safe", "caution"], deny: Array.isArray(deny_issuers) ? deny_issuers : [], actualizada: new Date().toISOString() };
store.save(st);
return ok({ politica: st.policy });
  }
);

server.tool(
  "decide",
  "Evalúa una skill/credencial contra la política local: ALLOW/DENY con razones. Si no hay política, usa defaults prudentes (score>=7).",
  {
  identificador: z.string().describe("Identificador de la skill/credencial"),
  score: z.number().describe("Trust/sentinel score (0-10)").optional(),
  issuer: z.string().describe("Emisor").optional(),
  },
  async (args: any) => {
    const { identificador, score, issuer } = args as any;
    const st = store.load();
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
return ok({ decision, razones, tier, politica_aplicada: { min_score: pol.min_score, tiers: pol.tiers } });
  }
);

server.tool(
  "decision_log",
  "Historial de decisiones tomadas por el gateway (últimas 50) para auditoría.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
return ok({ decisiones: (st.decisiones || []).slice(-50), total: (st.decisiones || []).length });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor trust-gateway está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "trust-gateway", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[trust-gateway] fatal:", e);
  process.exit(1);
});

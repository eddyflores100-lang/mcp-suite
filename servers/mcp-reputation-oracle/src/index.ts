#!/usr/bin/env node
/**
 * MCP Server: Reputation Oracle
 * Agrega señales heterogéneas en un score de reputación explicable para sellers y skills
 *
 * Dolor que resuelve: Score = caja negra: el comprador no sabe cómo se compone la reputación de una skill ni qué señales pesan.
 * Categoría: MarketNow Ops | Generado por mcp-suite | id: reputation-oracle
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

// ——— persistencia local: ~/.mcp-suite/reputation-oracle/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "reputation-oracle");
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

const server = new McpServer({ name: "reputation-oracle", version: "1.0.0" });

server.tool(
  "score_from_signals",
  "Calcula score de reputación 0-100 desde señales: stars GitHub, downloads npm, sentinel score, antigüedad, tasa de issues. Pesos ajustables.",
  {
  estrellas: z.number().describe("Estrellas GitHub").default(0),
  downloads: z.number().describe("Descargas semanales npm").default(0),
  sentinel: z.number().describe("Sentinel score 0-10").default(0),
  issues_abiertos: z.number().describe("Issues abiertos").default(0),
  antiguedad_meses: z.number().describe("Meses desde primer release").default(0),
  },
  async (args: any) => {
    const { estrellas, downloads, sentinel, issues_abiertos, antiguedad_meses } = args as any;
    const estrellas_pts = Math.min(30, Math.log10(1 + (estrellas ?? 0)) * 12);
const downloads_pts = Math.min(25, Math.log10(1 + (downloads ?? 0)) * 10);
const sentinel_pts = ((sentinel ?? 0) / 10) * 30;
const issues_pen = Math.min(10, Math.log10(1 + (issues_abiertos ?? 0)) * 5);
const madurez_pts = Math.min(15, Math.log10(1 + (antiguedad_meses ?? 0)) * 8);
const total = Math.round(Math.max(0, Math.min(100, estrellas_pts + downloads_pts + sentinel_pts + madurez_pts - issues_pen)));
return ok({ score: total, desglose: { estrellas: Math.round(estrellas_pts), downloads: Math.round(downloads_pts), sentinel: Math.round(sentinel_pts), madurez: Math.round(madurez_pts), penalizacion_issues: -Math.round(issues_pen) }, interpretacion: total >= 70 ? "alta reputación" : total >= 40 ? "reputación media" : "reputación baja: verificar manualmente" });
  }
);

server.tool(
  "suspicious_patterns",
  "Detecta patrones de manipulación de reputación: reviews duplicadas, spikes de descargas, puntuaciones inconsistentes.",
  {
  reviews: z.array(z.any()).describe("Lista de reviews [{autor, texto, estrellas, fecha}]"),
  },
  async (args: any) => {
    const { reviews } = args as any;
    const rs = Array.isArray(reviews) ? reviews : [];
const alertas = [];
const textos = rs.map((r) => String(r.texto || "").toLowerCase());
const dup = textos.filter((t, i) => textos.indexOf(t) !== i);
if (dup.length) alertas.push({ tipo: "reviews-duplicadas", n: dup.length });
const cinco = rs.filter((r) => r.estrellas === 5).length;
if (rs.length > 5 && cinco / rs.length > 0.95) alertas.push({ tipo: "todo-5-estrellas", proporcion: Math.round((cinco / rs.length) * 100) + "%" });
const mismo_dia = new Set(rs.map((r) => String(r.fecha || "").slice(0, 10))).size;
if (rs.length > 4 && mismo_dia === 1) alertas.push({ tipo: "burst-un-dia", detalle: "todas el mismo día" });
return ok({ sospechoso: alertas.length > 0, alertas, total_reviews: rs.length });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor reputation-oracle está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "reputation-oracle", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[reputation-oracle] fatal:", e);
  process.exit(1);
});

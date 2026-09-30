#!/usr/bin/env node
/**
 * MCP Server: Usage Analytics
 * Analítica de uso de tools: qué se usa, qué nunca, y tendencias
 *
 * Dolor que resuelve: Mantener MCP instalados que no se usan drena contexto y tokens: falta analítica de uso real.
 * Categoría: Observabilidad | Generado por mcp-suite | id: usage-analytics
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

// ——— persistencia local: ~/.mcp-suite/usage-analytics/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "usage-analytics");
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

const server = new McpServer({ name: "usage-analytics", version: "1.0.0" });

server.tool(
  "record_tool_use",
  "Registra el uso de una tool (éxito o no, duración).",
  {
  tool: z.string().describe("Nombre de la tool"),
  exito: z.boolean().describe("Resultado").default(true),
  duracion_ms: z.number().describe("Duración").optional(),
  },
  async (args: any) => {
    const { tool, exito, duracion_ms } = args as any;
    const st = store.load();
st.uso = st.uso || {};
st.uso[tool] = st.uso[tool] || { llamadas: 0, exitos: 0, duraciones: [] };
const u = st.uso[tool];
u.llamadas++;
if (exito ?? true) u.exitos++;
if (duracion_ms) u.duraciones = u.duraciones.concat(duracion_ms).slice(-100);
u.ultima = new Date().toISOString();
store.save(st);
return ok({ tool, llamadas: u.llamadas });
  }
);

server.tool(
  "top_tools",
  "Ranking de tools por uso, con tasa de éxito y duración media. Marca candidatas a desinstalar.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const rows = __ents(st.uso || {}).map(([tool, u]: [string, any]) => {
  const dur = u.duraciones || [];
  return { tool, llamadas: u.llamadas, tasa_exito: Math.round((u.exitos / u.llamadas) * 100) + "%", duracion_media_ms: dur.length ? Math.round(dur.reduce((a: number, b: number) => a + b, 0) / dur.length) : null, ultima: u.ultima };
}).sort((a: any, b: any) => b.llamadas - a.llamadas);
return ok({ total_tools_usadas: rows.length, ranking: rows, candidatas_desinstalar: rows.filter((r) => r.llamadas <= 2 && rows.indexOf(r) > 5).map((r) => r.tool) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor usage-analytics está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "usage-analytics", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[usage-analytics] fatal:", e);
  process.exit(1);
});

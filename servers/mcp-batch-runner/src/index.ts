#!/usr/bin/env node
/**
 * MCP Server: Batch Runner
 * Divide y vencerás: lotes y chunks con control de concurrencia
 *
 * Dolor que resuelve: Procesar 1000 items de golpe revienta rate limits y memoria: falta división en lotes con concurrencia limitada.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: batch-runner
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";


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

const server = new McpServer({ name: "batch-runner", version: "1.0.0" });

server.tool(
  "make_batches",
  "Divide una lista de items en lotes de tamaño N con opciones de stride/interleaved.",
  {
  items: z.array(z.any()).describe("Items a dividir"),
  tamano: z.number().describe("Items por lote").default(10),
  intercalado: z.boolean().describe("Reparto round-robin entre lotes").default(false),
  },
  async (args: any) => {
    const { items, tamano, intercalado } = args as any;
    const list = Array.isArray(items) ? items : [];
const n = Math.max(1, tamano ?? 10);
let lotes: any[] = [];
if (intercalado) {
  const num_lotes = Math.ceil(list.length / n);
  lotes = Array.from({ length: num_lotes }, () => []);
  list.forEach((item, i) => lotes[i % num_lotes].push(item));
} else {
  for (let i = 0; i < list.length; i += n) lotes.push(list.slice(i, i + n));
}
return ok({ total_items: list.length, total_lotes: lotes.length, tamano_lote: n, lotes });
  }
);

server.tool(
  "concurrency_plan",
  "Calcula plan de concurrencia: dado N items, costo por item y rate limit, cuántos en paralelo y cuánto tarda.",
  {
  total_items: z.number().describe("Total de items"),
  ms_por_item: z.number().describe("Duración de un item (ms)"),
  max_concurrencia: z.number().describe("Límite de paralelismo").default(5),
  rate_por_minuto: z.number().describe("Límite de llamadas/min").optional(),
  },
  async (args: any) => {
    const { total_items, ms_por_item, max_concurrencia, rate_por_minuto } = args as any;
    const conc = Math.max(1, max_concurrencia ?? 5);
let efectiva = conc;
if (rate_por_minuto) efectiva = Math.min(conc, Math.max(1, Math.floor(rate_por_minuto / 60)));
const tandas = Math.ceil(total_items / efectiva);
const tiempo_total = tandas * (ms_por_item ?? 1000);
return ok({ concurrencia_efectiva: efectiva, tandas, tiempo_estimado_ms: tiempo_total, tiempo_estimado_legible: Math.round(tiempo_total / 1000) + "s", limitante: rate_por_minuto && efectiva < conc ? "rate-limit" : "paralelismo" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor batch-runner está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "batch-runner", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[batch-runner] fatal:", e);
  process.exit(1);
});

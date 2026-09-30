#!/usr/bin/env node
/**
 * MCP Server: Output Diff
 * Diffs de JSON y texto: qué cambió entre dos versiones de una salida
 *
 * Dolor que resuelve: Regenerar una respuesta y no saber qué cambió respecto a la anterior: imposible evaluar mejoras.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: output-diff
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

const server = new McpServer({ name: "output-diff", version: "1.0.0" });

server.tool(
  "diff_json",
  "Diff estructural de dos JSON: rutas añadidas, eliminadas y con valor cambiado.",
  {
  a: z.any().describe("JSON base"),
  b: z.any().describe("JSON nuevo"),
  },
  async (args: any) => {
    const { a, b } = args as any;
    function caminar(obj: any, ruta: string, out: any) {
  if (obj === null || typeof obj !== "object") { out[ruta] = obj; return; }
  for (const [k, v] of __ents(obj)) caminar(v, ruta ? ruta + "." + k : k, out);
}
const flatA: any = {}; const flatB: any = {};
caminar(a, "", flatA); caminar(b, "", flatB);
const añadidas: string[] = []; const eliminadas: string[] = []; const cambiadas: any[] = [];
for (const k of Object.keys(flatB)) if (!(k in flatA)) añadidas.push(k);
for (const k of Object.keys(flatA)) if (!(k in flatB)) eliminadas.push(k);
for (const k of Object.keys(flatA)) if (k in flatB && JSON.stringify(flatA[k]) !== JSON.stringify(flatB[k])) cambiadas.push({ ruta: k, antes: flatA[k], ahora: flatB[k] });
return ok({ añadidas, eliminadas, cambiadas, resumen: { "+": añadidas.length, "-": eliminadas.length, "~": cambiadas.length } });
  }
);

server.tool(
  "diff_text",
  "Diff línea a línea de dos textos (LCS simple): añadidas, eliminadas y contexto.",
  {
  a: z.string().describe("Texto base"),
  b: z.string().describe("Texto nuevo"),
  },
  async (args: any) => {
    const { a, b } = args as any;
    const la = a.split("\n"); const lb = b.split("\n");
const m = la.length, n = lb.length;
const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = la[i] === lb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
const cambios: any[] = [];
let i = 0, j = 0;
while (i < m && j < n) {
  if (la[i] === lb[j]) { i++; j++; }
  else if (dp[i + 1][j] >= dp[i][j + 1]) { cambios.push({ tipo: "-", linea: i + 1, texto: la[i] }); i++; }
  else { cambios.push({ tipo: "+", linea: j + 1, texto: lb[j] }); j++; }
}
while (i < m) { cambios.push({ tipo: "-", linea: i + 1, texto: la[i] }); i++; }
while (j < n) { cambios.push({ tipo: "+", linea: j + 1, texto: lb[j] }); j++; }
return ok({ lineas_base: m, lineas_nuevas: n, cambios: cambios.slice(0, 200), total_cambios: cambios.length });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor output-diff está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "output-diff", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[output-diff] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Stats Toolkit
 * Estadística descriptiva exacta: media, mediana, desviación, cuartiles y correlación
 *
 * Dolor que resuelve: El LLM 'estima' medias y desviaciones: para decisiones basadas en datos, cálculo exacto obligatorio.
 * Categoría: Utilidades | Generado por mcp-suite | id: stats-toolkit
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

const server = new McpServer({ name: "stats-toolkit", version: "1.0.0" });

server.tool(
  "describe",
  "Estadística descriptiva completa de una lista de números: n, media, mediana, desviación, min, máx, cuartiles y outliers (IQR).",
  {
  valores: z.array(z.any()).describe("Lista de números"),
  },
  async (args: any) => {
    const { valores } = args as any;
    const v = (Array.isArray(valores) ? valores : []).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
if (v.length < 2) return fail("necesitas >= 2 valores");
const suma = v.reduce((a, b) => a + b, 0);
const media = suma / v.length;
const sd = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length);
const q = (p: number) => { const idx = (v.length - 1) * p; const lo = Math.floor(idx); return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (idx - lo); };
const iqr = q(0.75) - q(0.25);
const outliers = v.filter((x) => x < q(0.25) - 1.5 * iqr || x > q(0.75) + 1.5 * iqr);
return ok({ n: v.length, suma: Math.round(suma * 1e6) / 1e6, media: Math.round(media * 1e6) / 1e6, mediana: q(0.5), sd: Math.round(sd * 1e6) / 1e6, min: v[0], max: v[v.length - 1], q1: q(0.25), q3: q(0.75), iqr: Math.round(iqr * 1e6) / 1e6, outliers: outliers.length ? outliers : "ninguno" });
  }
);

server.tool(
  "correlation",
  "Correlación de Pearson exacta entre dos listas (misma longitud).",
  {
  x: z.array(z.any()).describe("Valores X"),
  y: z.array(z.any()).describe("Valores Y"),
  },
  async (args: any) => {
    const { x, y } = args as any;
    const xs = (Array.isArray(x) ? x : []).map(Number);
const ys = (Array.isArray(y) ? y : []).map(Number);
if (xs.length !== ys.length || xs.length < 3) return fail("listas de igual longitud >= 3");
const n = xs.length;
const mx = xs.reduce((a, b) => a + b, 0) / n;
const my = ys.reduce((a, b) => a + b, 0) / n;
let num = 0, dx = 0, dy = 0;
for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
const r = num / Math.sqrt(dx * dy);
return ok({ r: Math.round(r * 1000) / 1000, fuerza: Math.abs(r) > 0.7 ? "fuerte" : Math.abs(r) > 0.4 ? "moderada" : "débil", direccion: r > 0 ? "positiva" : r < 0 ? "negativa" : "nula", nota: "correlación NO implica causalidad" });
  }
);

server.tool(
  "histogram",
  "Histograma de una lista numérica con bins automáticos (regla de Sturges).",
  {
  valores: z.array(z.any()).describe("Números"),
  bins: z.number().describe("Número de bins").optional(),
  },
  async (args: any) => {
    const { valores, bins } = args as any;
    const v = (Array.isArray(valores) ? valores : []).map(Number).filter((n) => Number.isFinite(n));
if (v.length < 3) return fail("necesitas >= 3 valores");
const min = Math.min(...v); const max = Math.max(...v);
const k = bins ?? Math.max(3, Math.min(15, Math.ceil(Math.log2(v.length) + 1)));
const ancho = (max - min) / k || 1;
const conteo = new Array(k).fill(0);
for (const x of v) { const b = Math.min(k - 1, Math.floor((x - min) / ancho)); conteo[b]++; }
const barras = conteo.map((n) => "#".repeat(Math.round((n / Math.max(...conteo)) * 30)));
return ok({ bins: k, rango: [min, max], ancho_bin: Math.round(ancho * 1000) / 1000, histograma: conteo.map((n, i) => ({ bin: "[" + Math.round((min + i * ancho) * 100) / 100 + ", " + Math.round((min + (i + 1) * ancho) * 100) / 100 + ")", n, barra: barras[i] })) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor stats-toolkit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "stats-toolkit", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[stats-toolkit] fatal:", e);
  process.exit(1);
});

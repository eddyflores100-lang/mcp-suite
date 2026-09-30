#!/usr/bin/env node
/**
 * MCP Server: Context Compressor
 * Comprime contextos largos: extrae lo esencial antes de desbordar la ventana
 *
 * Dolor que resuelve: El contexto crece hasta desbordar la ventana: falta compresión extractiva determinista antes de gastar tokens en reintentos.
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: context-compressor
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

const server = new McpServer({ name: "context-compressor", version: "1.0.0" });

server.tool(
  "compress",
  "Compresión extractiva de un texto largo: selecciona las oraciones más informativas (frecuencia de términos) reduciendo a ~40% del original.",
  {
  texto: z.string().describe("Texto largo a comprimir"),
  ratio: z.number().describe("Fracción a conservar (0.1-0.9)").default(0.4),
  },
  async (args: any) => {
    const { texto, ratio } = args as any;
    const oraciones = texto.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
if (oraciones.length <= 3) return ok({ comprimido: texto, oraciones: oraciones.length, nota: "ya es corto" });
const freq: any = {};
const clean = (s: string) => s.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, "");
for (const o of oraciones) for (const w of clean(o).split(/\s+/)) if (w.length > 3) freq[w] = (freq[w] || 0) + 1;
const puntuadas = oraciones.map((o, i) => {
  const words = clean(o).split(/\s+/).filter((w) => w.length > 3);
  const score = words.reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(words.length || 1);
  return { i, o, score };
}).sort((a, b) => b.score - a.score);
const conservar = Math.max(3, Math.round(oraciones.length * (ratio ?? 0.4)));
const indices = puntuadas.slice(0, conservar).map((p) => p.i).sort((a, b) => a - b);
const comprimido = indices.map((i) => oraciones[i]).join(" ");
return ok({ original_caracteres: texto.length, comprimido_caracteres: comprimido.length, reduccion: Math.round((1 - comprimido.length / texto.length) * 100) + "%", oraciones_originales: oraciones.length, oraciones_conservadas: conservar, comprimido });
  }
);

server.tool(
  "key_points",
  "Extrae los N puntos clave de un texto (oraciones top por informatividad), sin reordenar el original.",
  {
  texto: z.string().describe("Texto a analizar"),
  n: z.number().describe("Cuántos puntos").default(5),
  },
  async (args: any) => {
    const { texto, n } = args as any;
    const oraciones = texto.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15);
const freq: any = {};
for (const o of oraciones) for (const w of o.toLowerCase().split(/\s+/)) if (w.length > 4) freq[w] = (freq[w] || 0) + 1;
const top = oraciones.map((o, i) => ({ i, o, score: o.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4).reduce((a: number, w: string) => a + (freq[w] || 0), 0) })).sort((a, b) => b.score - a.score).slice(0, n ?? 5);
return ok({ puntos_clave: top.map((t) => t.o), total_oraciones: oraciones.length });
  }
);

server.tool(
  "stats",
  "Estadísticas del texto: caracteres, palabras, oraciones, tokens estimados y densidad informativa.",
  {
  texto: z.string().describe("Texto a medir"),
  },
  async (args: any) => {
    const { texto } = args as any;
    const palabras = texto.split(/\s+/).filter(Boolean);
const oraciones = texto.split(/[.!?]+/).filter((s) => s.trim().length > 0);
const unicas = new Set(palabras.map((w) => w.toLowerCase().replace(/[^a-záéíóúñü0-9]/g, ""))).size;
return ok({ caracteres: texto.length, palabras: palabras.length, oraciones: oraciones.length, tokens_estimados: Math.ceil(texto.length / 4), palabras_unicas: unicas, riqueza_lexica: palabras.length ? Math.round((unicas / palabras.length) * 100) + "%" : "0%" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor context-compressor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "context-compressor", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[context-compressor] fatal:", e);
  process.exit(1);
});

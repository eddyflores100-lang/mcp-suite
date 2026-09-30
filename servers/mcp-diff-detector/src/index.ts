#!/usr/bin/env node
/**
 * MCP Server: Diff Detector
 * Detecta cambios entre versiones de texto/HTML/JSON con similitud
 *
 * Dolor que resuelve: Saber si algo cambió (y cuánto) entre dos versiones es la base del monitoreo: falta diff con score.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: diff-detector
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

const server = new McpServer({ name: "diff-detector", version: "1.0.0" });

server.tool(
  "similarity",
  "Similitud entre dos textos: Jaccard de palabras + shingles de 3 palabras + ratio de longitud.",
  {
  a: z.string().describe("Texto A"),
  b: z.string().describe("Texto B"),
  },
  async (args: any) => {
    const { a, b } = args as any;
    const wa = a.toLowerCase().split(/\s+/).filter(Boolean);
const wb = b.toLowerCase().split(/\s+/).filter(Boolean);
const setA = new Set(wa); const setB = new Set(wb);
const inter1 = [...setA].filter((w) => setB.has(w)).length;
const jaccard = inter1 / (setA.size + setB.size - inter1 || 1);
const shingles = (words: string[]) => { const out = new Set<string>(); for (let i = 0; i + 2 < words.length; i++) out.add(words.slice(i, i + 3).join(" ")); return out; };
const sA = shingles(wa); const sB = shingles(wb);
const interS = [...sA].filter((s) => sB.has(s)).length;
const shingleSim = sA.size + sB.size ? interS / (sA.size + sB.size - interS) : 1;
const lenRatio = Math.min(a.length, b.length) / (Math.max(a.length, b.length) || 1);
return ok({ similitud_global: Math.round(((jaccard + shingleSim) / 2) * 1000) / 10 + "%", jaccard_palabras: Math.round(jaccard * 1000) / 10 + "%", similitud_frases: Math.round(shingleSim * 1000) / 10 + "%", ratio_longitud: Math.round(lenRatio * 1000) / 10 + "%", veredicto: shingleSim > 0.9 ? "prácticamente idénticos" : shingleSim > 0.6 ? "mismo contenido con cambios" : shingleSim > 0.3 ? "contenido relacionado" : "contenido distinto" });
  }
);

server.tool(
  "changed_sections",
  "Divide dos HTML/textos en secciones por encabezados (h1-h3 o líneas en blanco) y reporta qué secciones cambian, se añaden o desaparecen.",
  {
  version_anterior: z.string().describe("Versión vieja"),
  version_nueva: z.string().describe("Versión nueva"),
  },
  async (args: any) => {
    const { version_anterior, version_nueva } = args as any;
    function seccionar(t: string): any[] {
  const limpio = t.replace(/<[^>]+>/g, "\n");
  const partes = limpio.split(/\n(?=#{1,3}\s)|\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 30);
  return partes.map((p) => ({ titulo: (p.match(/^#{1,3}\s+(.+)/) || [])[1]?.slice(0, 60) || p.slice(0, 60), hash: String(p.length) + ":" + p.slice(0, 100) }));
}
const sa = seccionar(version_anterior);
const sb = seccionar(version_nueva);
const hashA = new Map<any, any>(sa.map((s) => [s.hash, s.titulo]));
const hashB = new Map<any, any>(sb.map((s) => [s.hash, s.titulo]));
const desaparecidas = [...hashA.entries()].filter(([h]) => !hashB.has(h)).map(([, t]) => t);
const añadidas = [...hashB.entries()].filter(([h]) => !hashA.has(h)).map(([, t]) => t);
const estables = [...hashA.keys()].filter((h) => hashB.has(h)).length;
return ok({ secciones_antes: sa.length, secciones_ahora: sb.length, estables, añadidas: añadidas.slice(0, 20), desaparecidas: desaparecidas.slice(0, 20), cambio_detectado: añadidas.length + desaparecidas.length > 0 });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor diff-detector está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "diff-detector", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[diff-detector] fatal:", e);
  process.exit(1);
});

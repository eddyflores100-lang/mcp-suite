#!/usr/bin/env node
/**
 * MCP Server: Report Builder
 * Construye reportes markdown sección a sección con control de completitud
 *
 * Dolor que resuelve: Los reportes del agente son un muro de texto: sin estructura por secciones ni checklist de completitud.
 * Categoría: Comunicación y Humano | Generado por mcp-suite | id: report-builder
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

// ——— persistencia local: ~/.mcp-suite/report-builder/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "report-builder");
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

const server = new McpServer({ name: "report-builder", version: "1.0.0" });

server.tool(
  "add_section",
  "Añade una sección al reporte activo: título y contenido markdown.",
  {
  reporte: z.string().describe("Nombre del reporte"),
  titulo: z.string().describe("Título de la sección"),
  contenido: z.string().describe("Contenido markdown"),
  },
  async (args: any) => {
    const { reporte, titulo, contenido } = args as any;
    const st = store.load();
st.reportes = st.reportes || {};
const r = st.reportes[reporte] = st.reportes[reporte] || { secciones: [], creado: new Date().toISOString() };
r.secciones.push({ titulo, contenido, ts: new Date().toISOString() });
store.save(st);
return ok({ reporte, secciones: r.secciones.length });
  }
);

server.tool(
  "render",
  "Renderiza el reporte completo a markdown: TOC + secciones + checklist de calidad.",
  {
  reporte: z.string().describe("Reporte a renderizar"),
  },
  async (args: any) => {
    const { reporte } = args as any;
    const st = store.load();
const r = st.reportes?.[reporte];
if (!r?.secciones?.length) return fail("reporte vacío o inexistente");
const toc = r.secciones.map((s: any, i: number) => (i + 1) + ". " + s.titulo).join("\n");
const cuerpo = r.secciones.map((s: any) => "## " + s.titulo + "\n\n" + s.contenido).join("\n\n");
const checks = [
  r.secciones.some((s: any) => /resumen|conclusión|síntesis/i.test(s.titulo)) || null,
  r.secciones.some((s: any) => /datos|cifras|métricas|resultado/i.test(s.titulo)) || null,
  r.secciones.some((s: any) => /siguientes|acción|recomendaci|próximos/i.test(s.titulo)) || null,
];
const faltantes = ["sección de resumen/conclusión", "sección con datos/cifras", "sección de próximos pasos"].filter((_, i) => !checks[i]);
return ok({ markdown: "# Reporte: " + reporte + "\n\n**Generado:** " + new Date().toISOString() + "\n\n## Contenido\n\n" + toc + "\n\n---\n\n" + cuerpo, secciones: r.secciones.length, completitud: faltantes.length === 0 ? "completo" : "faltan: " + faltantes.join(", ") });
  }
);

server.tool(
  "outline_check",
  "Verifica que el reporte cubra el esqueleto estándar ejecutivo: contexto, hallazgos, cifras, riesgos y acción.",
  {
  reporte: z.string().describe("Reporte a chequear"),
  },
  async (args: any) => {
    const { reporte } = args as any;
    const st = store.load();
const r = st.reportes?.[reporte];
if (!r) return fail("reporte no existe");
const titulos = r.secciones.map((s: any) => s.titulo.toLowerCase()).join(" | ");
const requeridas = [
  ["contexto|introducción|antecedentes", "contexto"],
  ["hallazgo|análisis|observaciones", "hallazgos"],
  ["cifra|métrica|dato|número", "cifras"],
  ["riesgo|limitación|caveats", "riesgos"],
  ["acción|recomendaci|próximo|siguiente", "próximos pasos"],
];
const faltan = requeridas.filter(([pat]) => !new RegExp(pat).test(titulos)).map(([, n]) => n);
return ok({ completo: faltan.length === 0, faltan, secciones_actuales: r.secciones.map((s: any) => s.titulo) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor report-builder está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "report-builder", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[report-builder] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Run Reporter
 * Reportes de ejecución: pasos, duración, hallazgos y resultado final
 *
 * Dolor que resuelve: Al terminar una tarea no queda reporte de qué se hizo: el conocimiento de la ejecución se evapora.
 * Categoría: Observabilidad | Generado por mcp-suite | id: run-reporter
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

// ——— persistencia local: ~/.mcp-suite/run-reporter/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "run-reporter");
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

const server = new McpServer({ name: "run-reporter", version: "1.0.0" });

server.tool(
  "start_run",
  "Inicia una ejecución con objetivo y contexto. Devuelve run_id.",
  {
  objetivo: z.string().describe("Objetivo de la ejecución"),
  contexto: z.string().describe("Contexto").optional(),
  },
  async (args: any) => {
    const { objetivo, contexto } = args as any;
    const st = store.load();
st.runs = st.runs || [];
const run = { id: "run-" + (st.runs.length + 1), objetivo, contexto: contexto || "", inicio: new Date().toISOString(), pasos: [], estado: "en_curso" };
st.runs.push(run);
store.save(st);
return ok({ run_id: run.id });
  }
);

server.tool(
  "add_step",
  "Añade un paso a la ejecución: descripción, resultado, duración y artefactos.",
  {
  run_id: z.string().describe("ID de la ejecución"),
  paso: z.string().describe("Descripción del paso"),
  resultado: z.string().describe("Resultado").optional(),
  duracion_ms: z.number().describe("Duración").optional(),
  artefactos: z.array(z.any()).describe("Archivos/deliverables generados").optional(),
  },
  async (args: any) => {
    const { run_id, paso, resultado, duracion_ms, artefactos } = args as any;
    const st = store.load();
const run = (st.runs || []).find((r) => r.id === run_id);
if (!run) return fail("run no existe");
run.pasos.push({ n: run.pasos.length + 1, paso, resultado: resultado || "", duracion_ms: duracion_ms ?? null, artefactos: Array.isArray(artefactos) ? artefactos : [], ts: new Date().toISOString() });
store.save(st);
return ok({ run_id, total_pasos: run.pasos.length });
  }
);

server.tool(
  "finish_run",
  "Cierra la ejecución con éxito/fallo y genera el reporte completo (markdown).",
  {
  run_id: z.string().describe("ID de la ejecución"),
  exito: z.boolean().describe("Resultado global"),
  resumen: z.string().describe("Resumen final").optional(),
  },
  async (args: any) => {
    const { run_id, exito, resumen } = args as any;
    const st = store.load();
const run = (st.runs || []).find((r) => r.id === run_id);
if (!run) return fail("run no existe");
run.estado = exito ? "exito" : "fallo";
run.resumen = resumen || "";
run.fin = new Date().toISOString();
const duracion_total = (new Date(run.fin).getTime() - new Date(run.inicio).getTime()) / 1000;
store.save(st);
const md = ["# Reporte " + run.id, "", "**Objetivo:** " + run.objetivo, "**Estado:** " + run.estado.toUpperCase(), "**Duración:** " + Math.round(duracion_total) + "s", "", "## Pasos", ...run.pasos.map((p: any) => "- [" + p.n + "] " + p.paso + (p.resultado ? " → " + p.resultado : "") + (p.duracion_ms ? " (" + p.duracion_ms + "ms)" : "")), "", "**Resumen:** " + (run.resumen || "n/a")].join("\n");
return ok({ run_id, estado: run.estado, duracion_seg: Math.round(duracion_total), pasos: run.pasos.length, reporte_markdown: md });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor run-reporter está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "run-reporter", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[run-reporter] fatal:", e);
  process.exit(1);
});

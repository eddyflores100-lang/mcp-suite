#!/usr/bin/env node
/**
 * MCP Server: Experiment Log
 * A/B de prompts y configs: variantes, resultados y conclusión estadística ligera
 *
 * Dolor que resuelve: Se cambian prompts sin medir: sin experimentos registrados, la mejora es anécdota.
 * Categoría: Observabilidad | Generado por mcp-suite | id: experiment-log
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

// ——— persistencia local: ~/.mcp-suite/experiment-log/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "experiment-log");
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

const server = new McpServer({ name: "experiment-log", version: "1.0.0" });

server.tool(
  "start",
  "Inicia un experimento: hipótesis, métrica y variantes (con config).",
  {
  nombre: z.string().describe("Nombre del experimento"),
  hipotesis: z.string().describe("Qué crees que mejorará"),
  metrica: z.string().describe("Métrica a comparar (ej: tasa_exito, score)"),
  variantes: z.array(z.any()).describe("Nombres de variantes (ej: [control, prompt-v2])"),
  },
  async (args: any) => {
    const { nombre, hipotesis, metrica, variantes } = args as any;
    const st = store.load();
st.experimentos = st.experimentos || [];
const exp = { nombre, hipotesis, metrica, variantes: Array.isArray(variantes) ? variantes : ["control", "tratamiento"], resultados: {}, estado: "activo", inicio: new Date().toISOString() };
st.experimentos.push(exp);
store.save(st);
return ok({ experimento: nombre, variantes: exp.variantes });
  }
);

server.tool(
  "variant_result",
  "Registra el resultado de una variante (valor de la métrica). Acumula muestras.",
  {
  experimento: z.string().describe("Nombre del experimento"),
  variante: z.string().describe("Variante"),
  valor: z.number().describe("Valor observado"),
  },
  async (args: any) => {
    const { experimento, variante, valor } = args as any;
    const st = store.load();
const exp = (st.experimentos || []).find((e) => e.nombre === experimento && e.estado === "activo");
if (!exp) return fail("experimento activo no encontrado");
exp.resultados[variante] = (exp.resultados[variante] || []).concat(valor).slice(-100);
store.save(st);
return ok({ experimento, variante, n: exp.resultados[variante].length });
  }
);

server.tool(
  "conclude",
  "Concluye el experimento: medias por variante, diferencia relativa y ganadora preliminar.",
  {
  experimento: z.string().describe("Nombre del experimento"),
  },
  async (args: any) => {
    const { experimento } = args as any;
    const st = store.load();
const exp = (st.experimentos || []).find((e) => e.nombre === experimento);
if (!exp) return fail("no existe");
exp.estado = "concluido";
exp.fin = new Date().toISOString();
store.save(st);
const stats = __ents(exp.resultados).map(([variante, vals]: [string, any]) => ({ variante, n: vals.length, media: vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 1000) / 1000 : null }));
stats.sort((a: any, b: any) => (b.media ?? -Infinity) - (a.media ?? -Infinity));
const control = stats.find((s) => s.variante === "control") || stats[stats.length - 1];
const ganadora = stats[0];
return ok({ stats, ganadora: ganadora?.variante, mejora_vs_control: control?.media ? Math.round(((ganadora.media - control.media) / control.media) * 1000) / 10 + "%" : "n/a", nota: stats.every((s) => s.n >= 5) ? "muestras suficientes" : "ADVERTENCIA: <5 muestras por variante" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor experiment-log está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "experiment-log", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[experiment-log] fatal:", e);
  process.exit(1);
});

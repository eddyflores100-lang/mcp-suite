#!/usr/bin/env node
/**
 * MCP Server: Risk Register
 * Registro de riesgos: probabilidad × impacto con mitigaciones y dueños
 *
 * Dolor que resuelve: El agente ignora riesgos hasta que explotan: sin register, la mitigación es reactiva.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: risk-register
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

// ——— persistencia local: ~/.mcp-suite/risk-register/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "risk-register");
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

const server = new McpServer({ name: "risk-register", version: "1.0.0" });

server.tool(
  "add_risk",
  "Registra un riesgo: descripción, probabilidad (1-5), impacto (1-5), mitigación y dueño.",
  {
  descripcion: z.string().describe("El riesgo"),
  probabilidad: z.number().describe("Probabilidad 1-5"),
  impacto: z.number().describe("Impacto 1-5"),
  mitigacion: z.string().describe("Cómo mitigarlo").optional(),
  dueno: z.string().describe("Responsable").optional(),
  },
  async (args: any) => {
    const { descripcion, probabilidad, impacto, mitigacion, dueno } = args as any;
    const st = store.load();
st.riesgos = st.riesgos || [];
const p = Math.max(1, Math.min(5, probabilidad)); const i = Math.max(1, Math.min(5, impacto));
const r = { id: "R" + (st.riesgos.length + 1), descripcion, probabilidad: p, impacto: i, score: p * i, nivel: p * i >= 15 ? "critico" : p * i >= 8 ? "alto" : p * i >= 4 ? "medio" : "bajo", mitigacion: mitigacion || "", dueno: dueno || "", estado: "abierto", creado: new Date().toISOString() };
st.riesgos.push(r);
store.save(st);
return ok({ riesgo: r });
  }
);

server.tool(
  "top_risks",
  "Top riesgos abiertos ordenados por score, con mitigaciones pendientes.",
  {
  n: z.number().describe("Cuántos").default(10),
  },
  async (args: any) => {
    const { n } = args as any;
    const st = store.load();
const abiertos = (st.riesgos || []).filter((r) => r.estado === "abierto").sort((a: any, b: any) => b.score - a.score);
return ok({ total_abiertos: abiertos.length, criticos: abiertos.filter((r) => r.nivel === "critico").length, top: abiertos.slice(0, n ?? 10) });
  }
);

server.tool(
  "close_risk",
  "Cierra un riesgo (ocurrió, se mitigó o se aceptó).",
  {
  id: z.string().describe("ID del riesgo"),
  desenlace: z.enum(["mitigado","ocurrio","aceptado"]).describe("Desenlace"),
  nota: z.string().describe("Nota").optional(),
  },
  async (args: any) => {
    const { id, desenlace, nota } = args as any;
    const st = store.load();
const r = (st.riesgos || []).find((x) => x.id === id);
if (!r) return fail("riesgo no existe");
r.estado = "cerrado";
r.desenlace = desenlace;
r.nota_final = nota || "";
r.cerrado = new Date().toISOString();
store.save(st);
return ok({ id, estado: "cerrado", desenlace });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor risk-register está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "risk-register", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[risk-register] fatal:", e);
  process.exit(1);
});

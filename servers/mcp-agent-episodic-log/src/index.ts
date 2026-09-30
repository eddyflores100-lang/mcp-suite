#!/usr/bin/env node
/**
 * MCP Server: Agent Episodic Log
 * Bitácora cronológica de episodios: qué pasó, cuándo y con qué resultado
 *
 * Dolor que resuelve: Sin bitácora temporal el agente no puede reconstruir qué hizo ni cuándo: debugging y auditoría imposibles.
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: agent-episodic-log
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

// ——— persistencia local: ~/.mcp-suite/agent-episodic-log/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "agent-episodic-log");
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

const server = new McpServer({ name: "agent-episodic-log", version: "1.0.0" });

server.tool(
  "log_event",
  "Registra un episodio con timestamp: acción, resultado, contexto y severidad.",
  {
  accion: z.string().describe("Qué se hizo"),
  resultado: z.string().describe("Resultado (éxito/fallo/detalle)"),
  contexto: z.string().describe("Contexto adicional").optional(),
  severidad: z.enum(["info","warn","error"]).describe("Severidad").default("info"),
  },
  async (args: any) => {
    const { accion, resultado, contexto, severidad } = args as any;
    const st = store.load();
st.eventos = st.eventos || [];
const e = { ts: new Date().toISOString(), accion, resultado, contexto: contexto || "", severidad: severidad || "info" };
st.eventos.push(e);
if (st.eventos.length > 2000) st.eventos = st.eventos.slice(-2000);
store.save(st);
return ok({ registrado: e, total_eventos: st.eventos.length });
  }
);

server.tool(
  "timeline",
  "Devuelve la línea de tiempo de eventos (filtrable por severidad y ventana de tiempo en horas).",
  {
  severidad: z.enum(["info","warn","error"]).describe("Filtrar severidad").optional(),
  horas: z.number().describe("Solo últimas N horas").optional(),
  limite: z.number().describe("Máx eventos").default(50),
  },
  async (args: any) => {
    const { severidad, horas, limite } = args as any;
    const st = store.load();
let evs = st.eventos || [];
if (severidad) evs = evs.filter((e: any) => e.severidad === severidad);
if (horas) { const desde = Date.now() - horas * 3600000; evs = evs.filter((e: any) => new Date(e.ts).getTime() >= desde); }
return ok({ total: evs.length, eventos: evs.slice(-(limite ?? 50)).reverse() });
  }
);

server.tool(
  "search_events",
  "Busca eventos por texto (en acción, resultado o contexto).",
  {
  texto: z.string().describe("Texto a buscar"),
  limite: z.number().describe("Máx resultados").default(20),
  },
  async (args: any) => {
    const { texto, limite } = args as any;
    const st = store.load();
const t = texto.toLowerCase();
const evs = (st.eventos || []).filter((e: any) => (e.accion + " " + e.resultado + " " + e.contexto).toLowerCase().includes(t));
return ok({ total: evs.length, eventos: evs.slice(-(limite ?? 20)).reverse() });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor agent-episodic-log está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "agent-episodic-log", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[agent-episodic-log] fatal:", e);
  process.exit(1);
});

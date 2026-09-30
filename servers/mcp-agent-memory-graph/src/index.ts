#!/usr/bin/env node
/**
 * MCP Server: Agent Memory Graph
 * Memoria de entidades y relaciones: el grafo de conocimiento del agente
 *
 * Dolor que resuelve: La memoria plana pierde las RELACIONES (quién trabaja con quién, qué depende de qué): los agentes necesitan memoria estructural.
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: agent-memory-graph
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

// ——— persistencia local: ~/.mcp-suite/agent-memory-graph/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "agent-memory-graph");
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

const server = new McpServer({ name: "agent-memory-graph", version: "1.0.0" });

server.tool(
  "add_entity",
  "Añade una entidad al grafo de memoria (persona, proyecto, concepto, herramienta...).",
  {
  id: z.string().describe("Identificador único"),
  tipo: z.string().describe("Tipo (persona/proyecto/concepto)"),
  props: z.any().describe("Propiedades adicionales").optional(),
  },
  async (args: any) => {
    const { id, tipo, props } = args as any;
    const st = store.load();
st.entidades = st.entidades || {};
st.entidades[id] = { tipo, props: props || {}, creado: new Date().toISOString() };
store.save(st);
return ok({ entidad: id, tipo, total_entidades: Object.keys(st.entidades).length });
  }
);

server.tool(
  "link",
  "Crea una relación dirigida entre dos entidades (ej: alice -> trabaja_en -> proyecto-x).",
  {
  desde: z.string().describe("Entidad origen"),
  hacia: z.string().describe("Entidad destino"),
  relacion: z.string().describe("Nombre de la relación"),
  },
  async (args: any) => {
    const { desde, hacia, relacion } = args as any;
    const st = store.load();
st.aristas = st.aristas || [];
if (!st.entidades?.[desde]) return fail("entidad origen no existe: add_entity primero");
if (!st.entidades?.[hacia]) return fail("entidad destino no existe: add_entity primero");
st.aristas.push({ desde, hacia, relacion, ts: new Date().toISOString() });
store.save(st);
return ok({ arista: desde + " -" + relacion + "-> " + hacia, total_aristas: st.aristas.length });
  }
);

server.tool(
  "neighbors",
  "Devuelve vecinos de una entidad: relaciones entrantes y salientes con nombres.",
  {
  entidad: z.string().describe("Entidad a consultar"),
  },
  async (args: any) => {
    const { entidad } = args as any;
    const st = store.load();
const salientes = (st.aristas || []).filter((a: any) => a.desde === entidad).map((a: any) => ({ relacion: a.relacion, destino: a.hacia }));
const entrantes = (st.aristas || []).filter((a: any) => a.hacia === entidad).map((a: any) => ({ origen: a.desde, relacion: a.relacion }));
return ok({ entidad, tipo: st.entidades?.[entidad]?.tipo, salientes, entrantes });
  }
);

server.tool(
  "query_path",
  "Encuentra caminos de hasta 2 saltos entre dos entidades (quién conecta con quién).",
  {
  origen: z.string().describe("Entidad origen"),
  destino: z.string().describe("Entidad destino"),
  },
  async (args: any) => {
    const { origen, destino } = args as any;
    const st = store.load();
const aristas: any[] = st.aristas || [];
const caminos: any[] = [];
for (const a of aristas.filter((a) => a.desde === origen && a.hacia === destino)) caminos.push({ camino: [origen, destino], via: a.relacion });
for (const a1 of aristas.filter((a) => a.desde === origen)) {
  for (const a2 of aristas.filter((a) => a.desde === a1.hacia && a.hacia === destino)) {
    caminos.push({ camino: [origen, a1.hacia, destino], via: a1.relacion + " -> " + a2.relacion });
  }
}
return ok({ origen, destino, caminos, conectados: caminos.length > 0 });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor agent-memory-graph está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "agent-memory-graph", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[agent-memory-graph] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Tool Registry
 * Registro local de herramientas: catálogo, tags y búsqueda semántica ligera
 *
 * Dolor que resuelve: Con decenas de MCP instalados el agente no sabe qué tools existen ni qué hacen: falta un registro consultable.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: tool-registry
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

// ——— persistencia local: ~/.mcp-suite/tool-registry/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "tool-registry");
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

const server = new McpServer({ name: "tool-registry", version: "1.0.0" });

server.tool(
  "register",
  "Registra una herramienta: nombre, servidor MCP, descripción, tags y coste estimado por llamada.",
  {
  nombre: z.string().describe("Nombre de la tool"),
  servidor: z.string().describe("Servidor MCP dueño"),
  descripcion: z.string().describe("Qué hace"),
  tags: z.array(z.any()).describe("Tags para búsqueda").optional(),
  costo_llamada: z.string().describe("Coste/latencia estimada (ej: $0.001, 800ms)").optional(),
  },
  async (args: any) => {
    const { nombre, servidor, descripcion, tags, costo_llamada } = args as any;
    const st = store.load();
st.tools = st.tools || {};
st.tools[nombre] = { servidor, descripcion, tags: Array.isArray(tags) ? tags : [], costo: costo_llamada || "desconocido", registrado: new Date().toISOString() };
store.save(st);
return ok({ tool: nombre, total_tools: Object.keys(st.tools).length });
  }
);

server.tool(
  "search",
  "Busca tools por texto (nombre/desc/tags) y devuelve las mejores coincidencias con su servidor.",
  {
  consulta: z.string().describe("Qué necesitas hacer"),
  limite: z.number().describe("Máx resultados").default(8),
  },
  async (args: any) => {
    const { consulta, limite } = args as any;
    const st = store.load();
const tools = __ents(st.tools || {});
if (!tools.length) return fail("registro vacío: registra tools primero");
const q = consulta.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
const scored = tools.map(([nombre, t]: [string, any]) => {
  const texto = (nombre + " " + t.descripcion + " " + (t.tags || []).join(" ")).toLowerCase();
  const hits = q.filter((w) => texto.includes(w)).length;
  return { nombre, servidor: t.servidor, descripcion: t.descripcion, score: hits };
}).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limite ?? 8);
return ok({ consulta, resultados: scored, sin_match: scored.length === 0 });
  }
);

server.tool(
  "list_all",
  "Lista todas las tools registradas agrupadas por servidor.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const por_servidor: any = {};
for (const [nombre, t] of __ents((st.tools || {}) as Record<string, any>)) {
  por_servidor[t.servidor] = por_servidor[t.servidor] || [];
  por_servidor[t.servidor].push(nombre);
}
return ok({ total_tools: Object.keys(st.tools || {}).length, servidores: por_servidor });
  }
);

server.tool(
  "unregister",
  "Elimina una tool del registro (cuando desinstalas su servidor).",
  {
  nombre: z.string().describe("Tool a eliminar"),
  },
  async (args: any) => {
    const { nombre } = args as any;
    const st = store.load();
if (!st.tools?.[nombre]) return fail("no registrada");
delete st.tools[nombre];
store.save(st);
return ok({ eliminada: nombre, restantes: Object.keys(st.tools).length });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor tool-registry está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "tool-registry", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[tool-registry] fatal:", e);
  process.exit(1);
});

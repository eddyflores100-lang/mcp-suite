#!/usr/bin/env node
/**
 * MCP Server: Tool Router
 * Enruta cada intención a la mejor tool: menos decisiones erróneas del modelo
 *
 * Dolor que resuelve: Con 100+ tools disponibles el LLM elige mal o llama la incorrecta (dolor #1 reportado por merge.dev sobre MCP).
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: tool-router
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

// ——— persistencia local: ~/.mcp-suite/tool-router/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "tool-router");
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

const server = new McpServer({ name: "tool-router", version: "1.0.0" });

server.tool(
  "add_route",
  "Define una regla de ruteo: patrón de intención → tool concreta (con prioridad).",
  {
  intencion: z.string().describe("Patrón de intención (ej: leer página web)"),
  tool: z.string().describe("Tool a enrutar"),
  prioridad: z.number().describe("Prioridad (mayor = primero)").default(1),
  },
  async (args: any) => {
    const { intencion, tool, prioridad } = args as any;
    const st = store.load();
st.rutas = st.rutas || [];
st.rutas.push({ intencion, tool, prioridad: prioridad ?? 1, usos: 0 });
st.rutas.sort((a: any, b: any) => b.prioridad - a.prioridad);
store.save(st);
return ok({ rutas: st.rutas.length });
  }
);

server.tool(
  "route",
  "Dada una intención en texto, devuelve la tool recomendada (match por similitud de intención) y registra el uso.",
  {
  intencion: z.string().describe("Qué se quiere hacer"),
  },
  async (args: any) => {
    const { intencion } = args as any;
    const st = store.load();
const rutas: any[] = st.rutas || [];
if (!rutas.length) return fail("sin rutas definidas: add_route primero");
const q = intencion.toLowerCase();
const words = q.split(/\s+/).filter((w) => w.length > 3);
const scored = rutas.map((r) => {
  const rtext = r.intencion.toLowerCase();
  const hits = words.filter((w) => rtext.includes(w)).length;
  return { r, score: hits + r.prioridad * 0.1 };
}).sort((a, b) => b.score - a.score);
const mejor = scored[0];
if (mejor.score <= 0) return ok({ tool: null, razon: "ninguna ruta matchea; define con add_route" });
mejor.r.usos = (mejor.r.usos || 0) + 1;
store.save(st);
return ok({ tool: mejor.r.tool, intencion_detectada: mejor.r.intencion, score: Math.round(mejor.score * 10) / 10, alternativas: scored.slice(1, 3).map((s) => s.r.tool) });
  }
);

server.tool(
  "stats",
  "Estadísticas de ruteo: qué rutas se usan más (para ajustar prioridades).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const rutas = (st.rutas || []).map((r: any) => ({ intencion: r.intencion, tool: r.tool, usos: r.usos || 0, prioridad: r.prioridad }));
return ok({ rutas, total_usos: rutas.reduce((a: number, r: any) => a + r.usos, 0) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor tool-router está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "tool-router", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[tool-router] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Prompt Dependency Graph
 * Grafo de dependencias entre prompts, tools y datos: cambia X sabiendo exactamente qué se rompe
 *
 * Dolor que resuelve: Se edita el prompt de resumen y silenciosamente se rompe el pipeline de reportes que lo consumía: nadie mantiene el mapa de qué-prompt-usa-qué-tool-usa-qué-dato. El impacto de un cambio se descubre por el colapso.
 * Categoría: Agent CI/CD | Generado por mcp-suite | id: prompt-dependency-graph
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

// ——— persistencia local: ~/.mcp-suite/prompt-dependency-graph/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "prompt-dependency-graph");
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

const server = new McpServer({ name: "prompt-dependency-graph", version: "1.0.0" });

server.tool(
  "add_dependency",
  "Declara que un nodo depende de otro (prompt→tool, tool→dato, prompt→prompt...).",
  {
  nodo: z.string().describe("Nodo dependiente (ej: prompt:resumen-daily)"),
  depende_de: z.string().describe("Nodo del que depende (ej: tool:pdf-extractor)"),
  tipo: z.string().describe("Naturaleza de la dependencia (invoca, lee, hereda)").default("invoca"),
  },
  async (args: any) => {
    const { nodo, depende_de, tipo } = args as any;
    const st = store.load();
st.nodos = st.nodos || {};
st.aristas = st.aristas || [];
st.nodos[nodo] = st.nodos[nodo] || { id: nodo, tipo: nodo.split(":")[0] || "desconocido", creado: new Date().toISOString() };
st.nodos[depende_de] = st.nodos[depende_de] || { id: depende_de, tipo: depende_de.split(":")[0] || "desconocido", creado: new Date().toISOString() };
const yaExiste = st.aristas.some(a => a.nodo === nodo && a.depende_de === depende_de);
if (yaExiste) return fail("dependencia ya declarada: " + nodo + " -> " + depende_de);
st.aristas.push({ nodo, depende_de, tipo });
store.save(st);
return ok({ arista: nodo + " -> " + depende_de, tipo, nodos_totales: Object.keys(st.nodos).length, aristas_totales: st.aristas.length });
  }
);

server.tool(
  "impact_analysis",
  "Análisis de impacto: si cambio/rompo X, ¿qué se ve afectado hacia arriba (dependientes transitivos)?",
  {
  objetivo: z.string().describe("Nodo que va a cambiar"),
  },
  async (args: any) => {
    const { objetivo } = args as any;
    const st = store.load();
st.nodos = st.nodos || {};
st.aristas = st.aristas || [];
if (!st.nodos[objetivo] && !st.aristas.some(a => a.nodo === objetivo || a.depende_de === objetivo)) return fail("nodo desconocido: " + objetivo);
const dependientes = {};
const cola = [[objetivo, 0]];
while (cola.length) {
  const [actual, nivel] = cola.shift();
  st.aristas.filter(a => a.depende_de === actual).forEach(a => {
    if (dependientes[a.nodo] === undefined) {
      dependientes[a.nodo] = nivel + 1;
      cola.push([a.nodo, nivel + 1]);
    }
  });
}
const afectados = Object.keys(dependientes).map(n => ({ nodo: n, tipo: (n.split(":")[0] || "?"), distancia: dependientes[n], ruta: dependientes[n] === 1 ? "directo" : "a " + dependientes[n] + " saltos" }));
const criticos = afectados.filter(a => a.tipo === "prompt" && a.distancia <= 2);
return ok({ objetivo, afectados_total: afectados.length, afectados: afectados.sort((a, b) => a.distancia - b.distancia), criticos_directos: criticos.map(c => c.nodo), veredicto: afectados.length === 0 ? "nodo hoja: puedes cambiarlo sin efecto colateral" : afectados.length <= 2 ? "impacto contenido: avisa a " + afectados.map(a => a.nodo).join(", ") : "impacto AMPLIO (" + afectados.length + " nodos): corre los tests de " + criticos.map(c => c.nodo).join(", ") + " antes de cambiar" });
  }
);

server.tool(
  "topological_order",
  "Orden de arranque/carga: qué inicializar primero para que ninguna dependencia esté ausente.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const aristas = st.aristas || [];
const nodos = Object.keys(st.nodos || {});
if (!nodos.length) return fail("grafo vacío: declara nodos con add_dependency");
const indeg = {};
nodos.forEach(n => { indeg[n] = 0; });
aristas.forEach(a => { if (indeg[a.nodo] !== undefined) indeg[a.nodo]++; });
const cola = nodos.filter(n => indeg[n] === 0);
const orden = [];
const visitadas = new Set();
while (cola.length) {
  const actual = cola.shift();
  orden.push(actual);
  visitadas.add(actual);
  aristas.filter(a => a.depende_de === actual).forEach(a => {
    if (!visitadas.has(a.nodo)) {
      indeg[a.nodo]--;
      if (indeg[a.nodo] === 0) cola.push(a.nodo);
    }
  });
}
const ciclos = nodos.filter(n => !orden.includes(n));
return ok({ orden_recomendado: orden, fases: orden.map((n, i) => ({ fase: i + 1, nodo: n, tipo: n.split(":")[0] })), ciclos_detectados: ciclos, aviso: ciclos.length ? "CICLO en: " + ciclos.join(", ") + ": rompe la circularidad antes de desplegar" : "grafo acíclico: orden válido" });
  }
);

server.tool(
  "orphan_check",
  "Detecta nodos huérfanos (nadie los usa) y nodos fantasma (dependen de algo que no existe).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const nodos = Object.keys(st.nodos || {});
const aristas = st.aristas || [];
if (!nodos.length) return fail("grafo vacío");
const usados = new Set(aristas.map(a => a.depende_de));
const consumidores = new Set(aristas.map(a => a.nodo));
const huerfanos = nodos.filter(n => !usados.has(n) && !consumidores.has(n));
const nodosSinUso = nodos.filter(n => !usados.has(n) && consumidores.has(n));
const fantasmas = aristas.filter(a => !nodos.includes(a.depende_de)).map(a => ({ arista: a.nodo + " -> " + a.depende_de, problema: "el destino no existe: typo o nodo eliminado" }));
return ok({ nodos: nodos.length, aristas: aristas.length, huerfanos_totales: huerfanos, raices_sin_consumidores: nodosSinUso, aristas_rotas: fantasmas, accion: huerfanos.length ? "los " + huerfanos.length + " huérfanos no participan en nada: elimínalos o conéctalos" : fantasmas.length ? "corrige las aristas rotas primero" : "grafo limpio" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor prompt-dependency-graph está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "prompt-dependency-graph", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[prompt-dependency-graph] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Lesson Library
 * Biblioteca de lecciones recuperables por situación: el agente recuerda lo que ya aprendió
 *
 * Dolor que resuelve: El conocimiento aprendido ('con ese proveedor, valida el JSON antes de parsear') no sobrevive la sesión: cada instancia del agente vuelve a cometer el error porque no hay biblioteca consultable.
 * Categoría: Aprendizaje de Habilidades | Generado por mcp-suite | id: lesson-library
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

// ——— persistencia local: ~/.mcp-suite/lesson-library/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "lesson-library");
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

const server = new McpServer({ name: "lesson-library", version: "1.0.0" });

server.tool(
  "add_lesson",
  "Añade una lección: situación en que aplica, la regla y etiquetas para recuperación.",
  {
  situacion: z.string().describe("Cuándo aplica (situación observable)"),
  regla: z.string().describe("Qué hacer (accionable)"),
  etiquetas: z.array(z.any()).describe("Etiquetas temáticas").default([]),
  origen: z.string().describe("De dónde viene (postmortem, humano, manual)").default("manual"),
  },
  async (args: any) => {
    const { situacion, regla, etiquetas, origen } = args as any;
    const st = store.load();
st.lecciones = st.lecciones || [];
if (st.lecciones.some(l => l.regla === regla)) return fail("regla ya registrada");
st.lecciones.push({ id: "ls_" + Date.now().toString(36), situacion, regla, etiquetas: etiquetas || [], origen, usada: 0, creada: new Date().toISOString() });
store.save(st);
return ok({ leccion_id: st.lecciones.at(-1).id, total: st.lecciones.length });
  }
);

server.tool(
  "recall_lessons",
  "Recupera lecciones relevantes para la situación actual (match lexical + etiquetas) con score.",
  {
  situacion_actual: z.string().describe("Qué está a punto de hacer el agente"),
  max: z.number().describe("Máximo a devolver").default(5),
  },
  async (args: any) => {
    const { situacion_actual, max } = args as any;
    const st = store.load();
const lecciones = st.lecciones || [];
if (!lecciones.length) return ok({ lecciones: 0, sugerencia: "añade lecciones con add_lesson" });
const tokens = (s) => new Set(String(s).toLowerCase().split(/\W+/).filter(w => w.length > 3));
const act = tokens(situacion_actual);
const scored = lecciones.map(l => {
  const sit = tokens(l.situacion);
  const inter = [...sit].filter(w => act.has(w)).length;
  const tagHit = (l.etiquetas || []).filter(t => situacion_actual.toLowerCase().includes(String(t).toLowerCase())).length;
  const score = inter / Math.max(sit.size, 1) + tagHit * 0.3;
  return { id: l.id, situacion: l.situacion, regla: l.regla, score: Number(score.toFixed(2)) };
}).filter(x => x.score > 0.15).sort((a, b) => b.score - a.score);
const top = scored.slice(0, Math.max(1, Math.min(max, 10)));
if (top.length) {
  for (const t of top) { const l = st.lecciones.find(x => x.id === t.id); l.usada++; }
  store.save(st);
}
return ok({
  relevantes: top.length,
  lecciones: top,
  aviso: top.length ? "aplica estas reglas ANTES de actuar en esta situación" : "sin lecciones previas para esta situación",
});
  }
);

server.tool(
  "most_used",
  "Lecciones más reutilizadas: cuáles están demostrando valor real.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const ls = st.lecciones || [];
if (!ls.length) return ok({ lecciones: 0 });
const top = [...ls].sort((a, b) => b.usada - a.usada).slice(0, 10).map(l => ({ regla: l.regla.slice(0, 90), usada: l.usada, etiquetas: l.etiquetas }));
return ok({ total: ls.length, nunca_usadas: ls.filter(l => l.usada === 0).length, top: top.filter(t => t.usada > 0) });
  }
);

server.tool(
  "retire_lesson",
  "Retira una lección obsoleta (ya no aplica porque cambió el entorno), con motivo.",
  {
  leccion_id: z.string().describe("ID de la lección"),
  motivo: z.string().describe("Por qué ya no aplica"),
  },
  async (args: any) => {
    const { leccion_id, motivo } = args as any;
    const st = store.load();
const l = (st.lecciones || []).find(x => x.id === leccion_id);
if (!l) return fail("lección no encontrada");
l.retirada = { motivo, ts: new Date().toISOString() };
store.save(st);
return ok({ retirada: true, regla: l.regla.slice(0, 80) });
  }
);

server.tool(
  "library_stats",
  "Salud de la biblioteca: tamaño, tasa de uso, cobertura por etiqueta y antigüedad.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const ls = (st.lecciones || []).filter(l => !l.retirada);
if (!ls.length) return ok({ activas: 0 });
const porEtiqueta = {};
for (const l of ls) for (const t of l.etiquetas || []) porEtiqueta[t] = (porEtiqueta[t] || 0) + 1;
return ok({
  activas: ls.length,
  retiradas: (st.lecciones || []).length - ls.length,
  tasa_uso_media: Number((ls.reduce((s, l) => s + l.usada, 0) / ls.length).toFixed(1)),
  por_etiqueta: porEtiqueta,
  mas_antigua_dias: Number(((Date.now() - new Date(ls.reduce((a, b) => a.creada < b.creada ? a : b).creada).getTime()) / 86400000).toFixed(0)),
  consejo: ls.filter(l => l.usada === 0).length > ls.length / 2 ? "media biblioteca nunca se usa: revisa la situación/redacción (recall falla)" : "biblioteca viva",
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor lesson-library está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "lesson-library", tools: 6, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[lesson-library] fatal:", e);
  process.exit(1);
});

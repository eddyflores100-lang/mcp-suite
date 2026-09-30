#!/usr/bin/env node
/**
 * MCP Server: Task Tracker
 * Tareas del agente con estados, prioridades y bloqueos
 *
 * Dolor que resuelve: Sin tracker de tareas el agente pierde el hilo entre sesiones y no sabe qué está bloqueado.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: task-tracker
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

// ——— persistencia local: ~/.mcp-suite/task-tracker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "task-tracker");
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

const server = new McpServer({ name: "task-tracker", version: "1.0.0" });

server.tool(
  "add",
  "Añade una tarea: título, detalle, prioridad y etiquetas. Devuelve ID.",
  {
  titulo: z.string().describe("Título de la tarea"),
  detalle: z.string().describe("Detalle").optional(),
  prioridad: z.enum(["alta","media","baja"]).describe("Prioridad").default("media"),
  etiquetas: z.array(z.any()).describe("Tags").optional(),
  },
  async (args: any) => {
    const { titulo, detalle, prioridad, etiquetas } = args as any;
    const st = store.load();
st.tareas = st.tareas || [];
st.seq = (st.seq || 0) + 1;
const t = { id: "T" + st.seq, titulo, detalle: detalle || "", prioridad: prioridad || "media", etiquetas: Array.isArray(etiquetas) ? etiquetas : [], estado: "pendiente", creada: new Date().toISOString() };
st.tareas.push(t);
store.save(st);
return ok({ tarea: t, total: st.tareas.length });
  }
);

server.tool(
  "update_status",
  "Actualiza el estado de una tarea: pendiente → en_progreso → done | bloqueada (con motivo).",
  {
  id: z.string().describe("ID de la tarea"),
  estado: z.enum(["pendiente","en_progreso","done","bloqueada"]).describe("Nuevo estado"),
  motivo: z.string().describe("Motivo (para bloqueos)").optional(),
  },
  async (args: any) => {
    const { id, estado, motivo } = args as any;
    const st = store.load();
const t = (st.tareas || []).find((x) => x.id === id);
if (!t) return fail("tarea no existe: " + id);
t.estado = estado;
t.actualizada = new Date().toISOString();
if (estado === "bloqueada") t.bloqueo = motivo || "sin motivo";
if (estado === "done") t.completada = new Date().toISOString();
store.save(st);
return ok({ id, estado });
  }
);

server.tool(
  "pending",
  "Lista tareas pendientes/en progreso ordenadas por prioridad, con bloqueadas destacadas.",
  {
  etiqueta: z.string().describe("Filtrar por etiqueta").optional(),
  },
  async (args: any) => {
    const { etiqueta } = args as any;
    const st = store.load();
let tareas: any[] = (st.tareas || []).filter((t) => t.estado !== "done");
if (etiqueta) tareas = tareas.filter((t) => (t.etiquetas || []).includes(etiqueta));
const orden: any = { alta: 0, media: 1, baja: 2 };
tareas.sort((a, b) => (orden[a.prioridad] ?? 1) - (orden[b.prioridad] ?? 1));
return ok({ pendientes: tareas.length, bloqueadas: tareas.filter((t) => t.estado === "bloqueada").length, en_progreso: tareas.filter((t) => t.estado === "en_progreso").length, tareas });
  }
);

server.tool(
  "summary",
  "Resumen de productividad: completadas hoy/semana, tasa de finalización y tareas estancadas.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const tareas: any[] = st.tareas || [];
const ahora = Date.now();
const done = tareas.filter((t) => t.estado === "done");
const hoy = done.filter((t) => new Date(t.completada).getTime() > ahora - 86400000).length;
const semana = done.filter((t) => new Date(t.completada).getTime() > ahora - 7 * 86400000).length;
const estancadas = tareas.filter((t) => t.estado === "en_progreso" && (!t.actualizada || ahora - new Date(t.actualizada).getTime() > 86400000));
return ok({ total: tareas.length, completadas: done.length, completadas_hoy: hoy, completadas_7d: semana, tasa_finalizacion: tareas.length ? Math.round((done.length / tareas.length) * 100) + "%" : "0%", estancadas_24h: estancadas.map((t) => t.id + " " + t.titulo) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor task-tracker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "task-tracker", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[task-tracker] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Job Queue
 * Cola de trabajos durable: encola, procesa y nunca pierde una tarea
 *
 * Dolor que resuelve: Sin cola, un crash pierde las tareas en vuelo: el agente necesita encolar trabajos con reintentos y prioridad.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: queue-mcp
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

// ——— persistencia local: ~/.mcp-suite/queue-mcp/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "queue-mcp");
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

const server = new McpServer({ name: "queue-mcp", version: "1.0.0" });

server.tool(
  "enqueue",
  "Encola un trabajo {tipo, payload, prioridad}: devuelve posición e ID para seguimiento.",
  {
  tipo: z.string().describe("Tipo de trabajo"),
  payload: z.any().describe("Datos del trabajo"),
  prioridad: z.number().describe("Prioridad (mayor = antes)").default(0),
  },
  async (args: any) => {
    const { tipo, payload, prioridad } = args as any;
    const st = store.load();
st.cola = st.cola || [];
st.seq = (st.seq || 0) + 1;
const job = { id: "job-" + st.seq, tipo, payload, prioridad: prioridad ?? 0, estado: "pendiente", encolado: new Date().toISOString(), intentos: 0 };
st.cola.push(job);
st.cola.sort((a: any, b: any) => b.prioridad - a.prioridad);
store.save(st);
return ok({ job_id: job.id, posicion: st.cola.findIndex((j: any) => j.id === job.id) + 1, pendientes: st.cola.filter((j: any) => j.estado === "pendiente").length });
  }
);

server.tool(
  "dequeue",
  "Saca el siguiente trabajo pendiente (mayor prioridad, FIFO entre iguales) y lo marca en_progreso.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const job = (st.cola || []).find((j: any) => j.estado === "pendiente");
if (!job) return ok({ job: null, pendientes: 0 });
job.estado = "in_progress";
job.tomado = new Date().toISOString();
store.save(st);
return ok({ job, pendientes: st.cola.filter((j: any) => j.estado === "pendiente").length });
  }
);

server.tool(
  "complete",
  "Marca un trabajo como completado (o fallido: vuelve a pendiente si le quedan reintentos).",
  {
  job_id: z.string().describe("ID del trabajo"),
  exito: z.boolean().describe("Resultado"),
  resultado: z.string().describe("Detalle del resultado").optional(),
  max_reintentos: z.number().describe("Reintentos permitidos").default(3),
  },
  async (args: any) => {
    const { job_id, exito, resultado, max_reintentos } = args as any;
    const st = store.load();
const job = (st.cola || []).find((j: any) => j.id === job_id);
if (!job) return fail("job no encontrado");
if (exito) { job.estado = "done"; job.resultado = resultado || ""; }
else { job.intentos = (job.intentos || 0) + 1; job.estado = job.intentos > (max_reintentos ?? 3) ? "failed" : "pendiente"; job.error = resultado || ""; }
job.finalizado = new Date().toISOString();
store.save(st);
return ok({ job_id, estado: job.estado, intentos: job.intentos });
  }
);

server.tool(
  "stats",
  "Estadísticas de la cola: pendientes, en progreso, completados, fallidos y oldest pendiente.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const cola: any[] = st.cola || [];
const conteo: any = {};
for (const j of cola) conteo[j.estado] = (conteo[j.estado] || 0) + 1;
const pendientes = cola.filter((j) => j.estado === "pendiente");
return ok({ total: cola.length, ...conteo, pendiente_mas_viejo: pendientes[0]?.encolado || null });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor queue-mcp está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "queue-mcp", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[queue-mcp] fatal:", e);
  process.exit(1);
});

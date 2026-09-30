#!/usr/bin/env node
/**
 * MCP Server: Competency Tracker
 * Matriz de competencias del agente: en qué es fiable, en qué necesita supervisión humana
 *
 * Dolor que resuelve: No se sabe en qué es bueno el agente: se le delega tareas donde falla sistemáticamente y se le supervisa tareas que ya domina. Sin matriz de competencias, la delegación es a ciegas.
 * Categoría: Aprendizaje de Habilidades | Generado por mcp-suite | id: competency-tracker
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

// ——— persistencia local: ~/.mcp-suite/competency-tracker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "competency-tracker");
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

const server = new McpServer({ name: "competency-tracker", version: "1.0.0" });

server.tool(
  "define_competency",
  "Define una competencia rastreable (área, descripción, cómo se mide).",
  {
  nombre: z.string().describe("Nombre de la competencia"),
  area: z.string().describe("Área (datos, código, redacción, análisis...)"),
  como_se_mide: z.string().describe("Evidencia de éxito (qué cuenta como acierto)"),
  },
  async (args: any) => {
    const { nombre, area, como_se_mide } = args as any;
    const st = store.load();
st.competencias = st.competencias || {};
if (st.competencias[nombre]) return fail("competencia existente");
st.competencias[nombre] = { nombre, area, como_se_mide, exitos: 0, fallos: 0, historial: [], creado: new Date().toISOString() };
store.save(st);
return ok({ competencia: nombre, area });
  }
);

server.tool(
  "record_outcome",
  "Registra un resultado (éxito/fallo) de la competencia en una tarea concreta.",
  {
  nombre: z.string().describe("Competencia"),
  exito: z.boolean().describe("¿La tarea salió bien?"),
  tarea: z.string().describe("Tarea concreta").optional(),
  },
  async (args: any) => {
    const { nombre, exito, tarea } = args as any;
    const st = store.load();
const c = (st.competencias || {})[nombre];
if (!c) return fail("competencia no encontrada");
if (exito) c.exitos++; else c.fallos++;
c.historial.push({ exito, tarea: tarea || null, ts: new Date().toISOString() });
store.save(st);
const total = c.exitos + c.fallos;
return ok({ competencia: nombre, exitos: c.exitos, fallos: c.fallos, tasa: Number((c.exitos / total).toFixed(2)) });
  }
);

server.tool(
  "competency_matrix",
  "Matriz completa: nivel por competencia (novato/competente/experto) y qué necesita supervisión.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const cs = __vals(st.competencias || {});
if (!cs.length) return ok({ competencias: 0, sugerencia: "define competencias con define_competency" });
const filas = cs.map(c => {
  const total = c.exitos + c.fallos;
  const tasa = total ? c.exitos / total : null;
  let nivel = "sin datos";
  if (total >= 10 && tasa >= 0.9) nivel = "experto (delegable sin supervisión)";
  else if (total >= 5 && tasa >= 0.75) nivel = "competente (supervisión ligera)";
  else if (total >= 3) nivel = "aprendiz (revisar salida siempre)";
  else if (total > 0) nivel = "novato (datos insuficientes)";
  return { competencia: c.nombre, area: c.area, exitos: c.exitos, fallos: c.fallos, tasa: tasa === null ? null : Number(tasa.toFixed(2)), nivel };
});
return ok({
  competencias: filas.length,
  matriz: filas.sort((a, b) => (b.tasa ?? -1) - (a.tasa ?? -1)),
  delegables_sin_supervision: filas.filter(f => f.nivel.startsWith("experto")).map(f => f.competencia),
  prohibido_delegar_solo: filas.filter(f => f.nivel.startsWith("aprendiz") || (f.tasa !== null && f.tasa < 0.5)).map(f => f.competencia),
});
  }
);

server.tool(
  "learning_progress",
  "Progreso de aprendizaje por competencia: ¿la tasa de éxito mejora con la práctica?",
  {
  nombre: z.string().describe("Competencia"),
  },
  async (args: any) => {
    const { nombre } = args as any;
    const st = store.load();
const c = (st.competencias || {})[nombre];
if (!c) return fail("competencia no encontrada");
const h = c.historial || [];
if (h.length < 6) return ok({ competencia: nombre, datos: h.length, progreso: "insuficiente (mínimo 6 tareas)" });
const mitad = Math.floor(h.length / 2);
const tasaPrimera = h.slice(0, mitad).filter(x => x.exito).length / mitad;
const tasaSegunda = h.slice(mitad).filter(x => x.exito).length / (h.length - mitad);
return ok({
  competencia: nombre, tareas: h.length,
  tasa_primeras: Number(tasaPrimera.toFixed(2)),
  tasa_ultimas: Number(tasaSegunda.toFixed(2)),
  mejora: Number((tasaSegunda - tasaPrimera).toFixed(2)),
  veredicto: tasaSegunda - tasaPrimera > 0.15 ? "aprendiendo: la práctica está funcionando" : tasaSegunda - tasaPrimera < -0.1 ? "degradando: algo cambió (modelo, datos o contexto)" : "meseta: para subir de nivel necesita feedback explícito, no más práctica",
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor competency-tracker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "competency-tracker", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[competency-tracker] fatal:", e);
  process.exit(1);
});

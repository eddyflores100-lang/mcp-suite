#!/usr/bin/env node
/**
 * MCP Server: Mission Checkpoint
 * Checkpoints verificables de misiones largas: pausa, reanuda y recupera sin repetir trabajo
 *
 * Dolor que resuelve: Las misiones largas mueren al reiniciarse: no hay checkpoints, así que el agente rehace horas de trabajo ya validado o pierde el hilo de lo que faltaba exactamente.
 * Categoría: Objetivos y Largo Plazo | Generado por mcp-suite | id: mission-checkpoint
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

// ——— persistencia local: ~/.mcp-suite/mission-checkpoint/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "mission-checkpoint");
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

const server = new McpServer({ name: "mission-checkpoint", version: "1.0.0" });

server.tool(
  "start_mission",
  "Abre una misión de largo aliento con fases esperadas y plan de checkpoints.",
  {
  mision: z.string().describe("Nombre de la misión"),
  fases: z.array(z.any()).describe("Fases esperadas en orden"),
  },
  async (args: any) => {
    const { mision, fases } = args as any;
    const st = store.load();
st.misiones = st.misiones || [];
const id = "ms_" + Date.now().toString(36);
st.misiones.push({ id, mision, fases: (fases || []).map((f, i) => ({ n: i + 1, fase: String(f), estado: "pendiente" })), checkpoints: [], estado: "activa", inicio: new Date().toISOString() });
store.save(st);
return ok({ mision_id: id, fases: (fases || []).length, politica: "crea un checkpoint al final de cada fase y antes de cualquier acción irreversible" });
  }
);

server.tool(
  "checkpoint",
  "Graba un checkpoint: fase actual, estado completo, criterios validados y puntero de reanudación.",
  {
  mision_id: z.string().describe("ID de la misión"),
  fase: z.string().describe("Fase completada o en curso"),
  estado: z.any().describe("Estado serializable (JSON) para reanudar"),
  reanudar_en: z.string().describe("Instrucción exacta de por dónde seguir"),
  criterios_validados: z.array(z.any()).describe("Criterios ya verificados").default([]),
  },
  async (args: any) => {
    const { mision_id, fase, estado, reanudar_en, criterios_validados } = args as any;
    const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
const cp = { n: m.checkpoints.length + 1, fase, estado, reanudar_en, criterios_validados: criterios_validados || [], ts: new Date().toISOString() };
m.checkpoints.push(cp);
for (const f of m.fases) if (f.fase === fase) f.estado = "hecha";
store.save(st);
return ok({ checkpoint: cp.n, fase, criterios_validados: cp.criterios_validados.length, total_checkpoints: m.checkpoints.length });
  }
);

server.tool(
  "resume",
  "Reanuda desde el último checkpoint: devuelve estado, instrucción de continuación y trabajo ya validado (no repetir).",
  {
  mision_id: z.string().describe("ID de la misión"),
  },
  async (args: any) => {
    const { mision_id } = args as any;
    const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
const cp = m.checkpoints[m.checkpoints.length - 1];
if (!cp) return ok({ sin_checkpoints: true, fases: m.fases, consejo: "empieza de cero y graba el primer checkpoint pronto" });
return ok({
  mision: m.mision,
  ultimo_checkpoint: { n: cp.n, fase: cp.fase, ts: cp.ts, reanudar_en: cp.reanudar_en, criterios_validados: cp.criterios_validados },
  estado_restaurado: cp.estado,
  fases_restantes: m.fases.filter(f => f.estado !== "hecha"),
  horas_desde_checkpoint: Number(((Date.now() - new Date(cp.ts).getTime()) / 3600000).toFixed(1)),
  no_repetir: "todo lo cubierto por criterios_validados ya está hecho: NO lo rehagas",
});
  }
);

server.tool(
  "rollback_checkpoint",
  "Vuelve a un checkpoint anterior: descarta el trabajo posterior documentando qué se pierde.",
  {
  mision_id: z.string().describe("ID de la misión"),
  checkpoint_n: z.number().describe("Número del checkpoint destino"),
  motivo: z.string().describe("Por qué se vuelve atrás"),
  },
  async (args: any) => {
    const { mision_id, checkpoint_n, motivo } = args as any;
    const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
const idx = m.checkpoints.findIndex(c => c.n === checkpoint_n);
if (idx < 0) return fail("checkpoint inexistente (hay " + m.checkpoints.length + ")");
const descartados = m.checkpoints.slice(idx + 1);
m.checkpoints = m.checkpoints.slice(0, idx + 1);
m.rollbacks = m.rollbacks || [];
m.rollbacks.push({ hacia: checkpoint_n, descartados: descartados.length, motivo, ts: new Date().toISOString() });
store.save(st);
return ok({ restaurado_a: checkpoint_n, checkpoints_descartados: descartados.length, fases_reabiertas: m.fases.filter(f => f.estado === "hecha" && !m.checkpoints.some(c => c.fase === f.fase)).map(f => f.fase) });
  }
);

server.tool(
  "mission_report",
  "Reporte de la misión: fases, checkpoints, rollbacks y ahorro estimado por no repetir trabajo.",
  {
  mision_id: z.string().describe("ID de la misión"),
  },
  async (args: any) => {
    const { mision_id } = args as any;
    const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
const duracion = Number(((Date.now() - new Date(m.inicio).getTime()) / 3600000).toFixed(1));
return ok({
  mision: m.mision, estado: m.estado,
  duracion_horas: duracion,
  fases: m.fases,
  checkpoints: m.checkpoints.length,
  rollbacks: (m.rollbacks || []).length,
  ahorro_estimado: m.checkpoints.length > 0 ? m.checkpoints.length + " reinicios servidos sin repetir trabajo validado" : "sin checkpoints aún",
 ultimo_checkpoint: m.checkpoints.at(-1)?.fase || null,
});
  }
);

server.tool(
  "close_mission",
  "Cierra la misión (completada o abandonada) archivando el rastro completo.",
  {
  mision_id: z.string().describe("ID de la misión"),
  resultado: z.enum(["completada","abandonada","fusionada"]).describe("Desenlace"),
  notas: z.string().describe("Cierre").optional(),
  },
  async (args: any) => {
    const { mision_id, resultado, notas } = args as any;
    const st = store.load();
const m = (st.misiones || []).find(x => x.id === mision_id);
if (!m) return fail("misión no encontrada");
m.estado = resultado;
m.cierre = { notas: notas || null, checkpoints: m.checkpoints.length, fases_hechas: m.fases.filter(f => f.estado === "hecha").length, ts: new Date().toISOString() };
store.save(st);
return ok({ mision: m.id, resultado, fases_hechas: m.cierre.fases_hechas + "/" + m.fases.length, checkpoints_grabados: m.cierre.checkpoints });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor mission-checkpoint está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "mission-checkpoint", tools: 7, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[mission-checkpoint] fatal:", e);
  process.exit(1);
});

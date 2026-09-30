#!/usr/bin/env node
/**
 * MCP Server: Deadline Engine
 * Deadlines con prioridad dinámica: el antídoto contra la procrastinación estructural del agente
 *
 * Dolor que resuelve: El agente trabaja en orden de llegada, no de urgencia: descubre el deadline vencido cuando pregunta '¿qué hago ahora?' y ya no hay tiempo. La urgencia tiene que calcularse, no recordarse.
 * Categoría: Frescura del Conocimiento | Generado por mcp-suite | id: deadline-engine
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

// ——— persistencia local: ~/.mcp-suite/deadline-engine/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "deadline-engine");
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

const server = new McpServer({ name: "deadline-engine", version: "1.0.0" });

server.tool(
  "add_deadline",
  "Añade un item con deadline, peso y esfuerzo estimado: la prioridad se recalcula sola.",
  {
  item: z.string().describe("Tarea/entrega con plazo"),
  deadline: z.string().describe("Fecha ISO o 'en Xh'/'en Xd'"),
  peso: z.enum(["bajo","medio","alto","critico"]).describe("Importancia").default("medio"),
  esfuerzo_horas: z.number().describe("Esfuerzo estimado").default(1),
  },
  async (args: any) => {
    const { item, deadline, peso, esfuerzo_horas } = args as any;
    const st = store.load();
const m = String(deadline).toLowerCase().match(/^en\s+(\d+)\s*(h|horas|d|dias|día)/);
const cuando = m
  ? new Date(Date.now() + parseInt(m[1]) * (m[2].startsWith("h") ? 3600000 : 86400000)).toISOString()
  : (() => { const d = new Date(deadline); return isNaN(d.getTime()) ? null : d.toISOString(); })();
if (!cuando) return fail("deadline no interpretable (ISO o 'en 3h' / 'en 2d')");
st.items = st.items || [];
st.items.push({ id: "dl_" + Date.now().toString(36), item, deadline: cuando, peso, esfuerzo_horas: esfuerzo_horas ?? 1, completado: false, creado: new Date().toISOString() });
store.save(st);
return ok({ item: item.slice(0, 60), deadline: cuando, horas_restantes: Number(((new Date(cuando).getTime() - Date.now()) / 3600000).toFixed(1)) });
  }
);

server.tool(
  "priority_queue",
  "Cola priorizada dinámicamente: urgencia por cercanía x peso, con slack (tiempo libre antes del deadline).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const items = (st.items || []).filter(i => !i.completado);
if (!items.length) return ok({ pendientes: 0 });
const PESO = { critico: 4, alto: 3, medio: 2, bajo: 1 };
const cola = items.map(i => {
  const horasRest = (new Date(i.deadline).getTime() - Date.now()) / 3600000;
  const slack = horasRest - i.esfuerzo_horas;
  const urgencia = PESO[i.peso] * (1 / Math.max(horasRest / 24, 0.05));
  const prioridad = urgencia * (slack < 0 ? 1.5 : 1);
  return { id: i.id, item: i.item.slice(0, 70), deadline: i.deadline.slice(0, 16), horas_restantes: Number(horasRest.toFixed(1)), slack_horas: Number(slack.toFixed(1)), peso: i.peso, prioridad: Number(prioridad.toFixed(2)) };
}).sort((a, b) => b.prioridad - a.prioridad);
return ok({
  pendientes: cola.length,
  vencidos: cola.filter(c => c.horas_restantes < 0).length,
  sin_slack: cola.filter(c => c.slack_horas < 0 && c.horas_restantes > 0).length,
  cola,
  siguiente_accion: cola[0] ? "trabaja AHORA en: " + cola[0].item + (cola[0].slack_horas < 0 ? " (SLACK NEGATIVO: avisa del retraso YA)" : "") : null,
});
  }
);

server.tool(
  "feasibility_check",
  "Comprueba si todo lo pendiente cabe en el tiempo disponible: detecta deadlines imposibles.",
  {
  horas_disponibles: z.number().describe("Horas de trabajo disponibles hasta el deadline más lejano").default(8),
  },
  async (args: any) => {
    const { horas_disponibles } = args as any;
    const st = store.load();
const items = (st.items || []).filter(i => !i.completado);
if (!items.length) return ok({ pendientes: 0 });
const totalEsfuerzo = items.reduce((s, i) => s + i.esfuerzo_horas, 0);
const imposible = items.filter(i => (new Date(i.deadline).getTime() - Date.now()) / 3600000 < i.esfuerzo_horas);
return ok({
  pendientes: items.length,
  esfuerzo_total_horas: Number(totalEsfuerzo.toFixed(1)),
  horas_disponibles: horas_disponibles,
  carga: Number((totalEsfuerzo / horas_disponibles).toFixed(2)) + "x",
  deadlines_imposibles: imposible.map(i => ({ item: i.item.slice(0, 60), horas_restantes: Number(((new Date(i.deadline).getTime() - Date.now()) / 3600000).toFixed(1)), necesita: i.esfuerzo_horas })),
  veredicto: totalEsfuerzo > horas_disponibles ? "SOBRECARGA: no cabe todo: renegocia plazos o delega ANTES de fallar" : imposible.length ? "hay items imposibles individualmente: avisa ya" : "factible",
});
  }
);

server.tool(
  "complete",
  "Marca un item como completado y mide si se cumplió a tiempo.",
  {
  id: z.string().describe("ID del item"),
  },
  async (args: any) => {
    const { id } = args as any;
    const st = store.load();
const i = (st.items || []).find(x => x.id === id);
if (!i) return fail("item no encontrado");
i.completado = true;
i.completado_ts = new Date().toISOString();
i.a_tiempo = new Date(i.completado_ts) <= new Date(i.deadline);
store.save(st);
return ok({ item: i.item.slice(0, 60), a_tiempo: i.a_tiempo, horas_margen: Number(((new Date(i.deadline).getTime() - new Date(i.completado_ts).getTime()) / 3600000).toFixed(1)) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor deadline-engine está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "deadline-engine", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[deadline-engine] fatal:", e);
  process.exit(1);
});

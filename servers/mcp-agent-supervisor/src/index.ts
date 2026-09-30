#!/usr/bin/env node
/**
 * MCP Server: Agent Supervisor
 * Supervisión de sub-agentes: liveness, presupuesto, rendimiento y decisión de reinicio/escalamiento
 *
 * Dolor que resuelve: Los orquestadores lanzan sub-agentes y los olvidan: sin heartbeat ni presupuesto, un sub-agente bucle infinito quema tokens toda la noche y nadie lo mata.
 * Categoría: Multi-Agente y Coordinación | Generado por mcp-suite | id: agent-supervisor
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

// ——— persistencia local: ~/.mcp-suite/agent-supervisor/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "agent-supervisor");
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

const server = new McpServer({ name: "agent-supervisor", version: "1.0.0" });

server.tool(
  "spawn_registration",
  "Registra un sub-agente lanzado con sus límites: presupuesto de tokens, deadline y máximos reintentos.",
  {
  sub_agente: z.string().describe("ID del sub-agente"),
  tarea: z.string().describe("Tarea asignada"),
  presupuesto_tokens: z.number().describe("Límite de tokens").optional(),
  deadline_minutos: z.number().describe("Minutos de plazo").optional(),
  max_reintentos: z.number().describe("Reintentos permitidos").default(1),
  },
  async (args: any) => {
    const { sub_agente, tarea, presupuesto_tokens, deadline_minutos, max_reintentos } = args as any;
    const st = store.load();
st.sups = st.sups || {};
const prev = st.sups[sub_agente];
st.sups[sub_agente] = {
  sub_agente, tarea, presupuesto_tokens: presupuesto_tokens || null,
  deadline: deadline_minutos ? new Date(Date.now() + deadline_minutos * 60000).toISOString() : null,
  max_reintentos, reintentos: prev?.reintentos || 0,
  tokens_usados: 0, checkins: 0, ultimo_checkin: null,
  estado: "corriendo", eventos: prev?.eventos || [],
  lanzado: new Date().toISOString(),
};
store.save(st);
return ok({ sub_agente, estado: "corriendo", presupuesto: st.sups[sub_agente].presupuesto_tokens, deadline: st.sups[sub_agente].deadline });
  }
);

server.tool(
  "check_in",
  "El sub-agente reporta progreso y tokens consumidos; el supervisor evalúa límites y devuelve directiva (seguir, parar, escalar).",
  {
  sub_agente: z.string().describe("ID del sub-agente"),
  progreso_pct: z.number().describe("Avance 0-100"),
  tokens_delta: z.number().describe("Tokens consumidos desde el último check-in").default(0),
  nota: z.string().describe("Qué está pasando").optional(),
  },
  async (args: any) => {
    const { sub_agente, progreso_pct, tokens_delta, nota } = args as any;
    const st = store.load();
const s = (st.sups || {})[sub_agente];
if (!s) return fail("sub-agente no registrado: usa spawn_registration");
if (s.estado !== "corriendo") return fail("sub-agente en estado " + s.estado);
s.checkins++;
s.ultimo_checkin = new Date().toISOString();
s.tokens_usados += tokens_delta || 0;
s.ultimo_progreso = progreso_pct;
if (nota) { s.eventos = s.eventos || []; s.eventos.push({ nota, progreso_pct, ts: s.ultimo_checkin }); if (s.eventos.length > 50) s.eventos = s.eventos.slice(-30); }
store.save(st);
const alerts = [];
if (s.presupuesto_tokens && s.tokens_usados > s.presupuesto_tokens) alerts.push("PRESUPUESTO_EXCEDIDO: " + s.tokens_usados + "/" + s.presupuesto_tokens);
if (s.deadline && new Date(s.deadline) < new Date()) alerts.push("DEADLINE_VENCIDO");
if (progreso_pct === 0 && s.checkins >= 3) alerts.push("SIN_PROGRESO tras " + s.checkins + " check-ins");
const directiva = alerts.some(a => a.startsWith("PRESUPUESTO") || a.startsWith("DEADLINE"))
  ? (s.reintentos < s.max_reintentos ? "REINTENTAR" : "ESCALAR_HUMANO")
  : alerts.includes("SIN_PROGRESO tras " + s.checkins + " check-ins") ? "PROBAR_ALTERNATIVA" : "SEGUIR";
if (directiva !== "SEGUIR") { s.estado = directiva === "REINTENTAR" ? "reintentar" : s.estado; if (directiva === "REINTENTAR") s.reintentos++; store.save(st); }
return ok({ directiva, alerts, tokens_usados: s.tokens_usados, presupuesto: s.presupuesto_tokens, checkins: s.checkins });
  }
);

server.tool(
  "report_result",
  "El sub-agente entrega resultado final; el supervisor cierra su registro y archiva métricas.",
  {
  sub_agente: z.string().describe("ID del sub-agente"),
  exito: z.boolean().describe("¿Completó la tarea?"),
  resultado: z.string().describe("Resumen del resultado").optional(),
  },
  async (args: any) => {
    const { sub_agente, exito, resultado } = args as any;
    const st = store.load();
const s = (st.sups || {})[sub_agente];
if (!s) return fail("sub-agente no registrado");
s.estado = exito ? "completado" : "fallido";
s.resultado = resultado || null;
s.terminado = new Date().toISOString();
s.duracion_min = Number(((Date.now() - new Date(s.lanzado).getTime()) / 60000).toFixed(1));
store.save(st);
return ok({ sub_agente, estado: s.estado, duracion_min: s.duracion_min, tokens: s.tokens_usados, checkins: s.checkins, sobre_presupuesto: s.presupuesto_tokens ? s.tokens_usados > s.presupuesto_tokens : false });
  }
);

server.tool(
  "kill",
  "Detiene formalmente un sub-agente (bucle, desviación o presupuesto) y registra el motivo.",
  {
  sub_agente: z.string().describe("ID del sub-agente"),
  motivo: z.string().describe("Por qué se detiene"),
  },
  async (args: any) => {
    const { sub_agente, motivo } = args as any;
    const st = store.load();
const s = (st.sups || {})[sub_agente];
if (!s) return fail("sub-agente no registrado");
if (s.estado !== "corriendo") return ok({ ya_finalizado: s.estado });
s.estado = "detenido";
s.killed = { motivo, ts: new Date().toISOString() };
store.save(st);
return ok({ sub_agente, estado: "detenido", motivo, tokens_hasta_el_momento: s.tokens_usados, limpieza: "libera sus recursos en blackboard-shared y su estado en deadlock-detector" });
  }
);

server.tool(
  "supervision_dashboard",
  "Panel de supervisión: quién corre, quién excede presupuesto, quién no reporta y tasas de éxito.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const sups = __vals(st.sups || {});
if (!sups.length) return ok({ registrados: 0, sugerencia: "registra sub-agentes con spawn_registration" });
const corriendo = sups.filter(s => s.estado === "corriendo");
const sinReporte = corriendo.filter(s => !s.ultimo_checkin || (Date.now() - new Date(s.ultimo_checkin).getTime()) > 15 * 60000);
const excedidos = corriendo.filter(s => s.presupuesto_tokens && s.tokens_usados > s.presupuesto_tokens);
const completados = sups.filter(s => s.estado === "completado").length;
const fallidos = sups.filter(s => ["fallido", "detenido"].includes(s.estado)).length;
return ok({
  registrados: sups.length, corriendo: corriendo.length,
  alertas: {
    sin_reporte_15min: sinReporte.map(s => s.sub_agente),
    presupuesto_excedido: excedidos.map(s => ({ sub: s.sub_agente, usados: s.tokens_usados, tope: s.presupuesto_tokens })),
  },
  rendimiento: {
    completados, fallidos,
    tasa_exito: (completados + fallidos) ? Number((completados / (completados + fallidos)).toFixed(2)) : null,
    tokens_totales: sups.reduce((s, x) => s + (x.tokens_usados || 0), 0),
  },
  corriendo_detalle: corriendo.map(s => ({ sub: s.sub_agente, tarea: s.tarea.slice(0, 60), checkins: s.checkins, tokens: s.tokens_usados, tope: s.presupuesto_tokens, ultimo_checkin: s.ultimo_checkin })),
});
  }
);

server.tool(
  "retry_policy",
  "Consulta la política de reintento para un sub-agente fallido: cuántos quedan y con qué ajustes relanzar.",
  {
  sub_agente: z.string().describe("ID del sub-agente"),
  },
  async (args: any) => {
    const { sub_agente } = args as any;
    const st = store.load();
const s = (st.sups || {})[sub_agente];
if (!s) return fail("sub-agente no registrado");
const quedan = Math.max(0, s.max_reintentos - s.reintentos);
return ok({
  sub_agente, reintentos_usados: s.reintentos, reintentos_quedan: quedan,
  recomendacion: quedan > 0
    ? { relanzar: true, ajustes: ["reduce el alcance de la tarea", "duplica deadline si falló por tiempo", "bisagra el presupuesto si falló por tokens"][s.reintentos % 3], presupuesto_sugerido: s.presupuesto_tokens ? Math.round(s.presupuesto_tokens * 1.5) : null }
    : { relanzar: false, alternativa: "decompón la tarea (plan-decompose) y delega por partes o escala a humano" },
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor agent-supervisor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "agent-supervisor", tools: 7, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[agent-supervisor] fatal:", e);
  process.exit(1);
});

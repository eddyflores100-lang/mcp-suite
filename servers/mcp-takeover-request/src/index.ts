#!/usr/bin/env node
/**
 * MCP Server: Takeover Request
 * Solicita toma de control humano con el contexto mínimo suficiente: sin volcar todo el historial
 *
 * Dolor que resuelve: Cuando el agente se atasca pide ayuda volcando todo el historial o no pide nada y decide solo. El punto medio —un paquete de takeover con lo justo— no existe.
 * Categoría: Humano en el Bucle | Generado por mcp-suite | id: takeover-request
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

// ——— persistencia local: ~/.mcp-suite/takeover-request/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "takeover-request");
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

const server = new McpServer({ name: "takeover-request", version: "1.0.0" });

server.tool(
  "request_takeover",
  "Construye un paquete de takeover: contexto mínimo, opciones con trade-offs y la pregunta concreta al humano.",
  {
  situacion: z.string().describe("Situación en 2-3 frases"),
  intentado: z.array(z.any()).describe("Lo que ya se intentó y falló"),
  punto_decision: z.string().describe("La decisión exacta que no puede tomar solo"),
  opciones: z.array(z.any()).describe("Opciones viables con trade-offs"),
  pregunta_al_humano: z.string().describe("La pregunta concreta y cerrada"),
  urgencia: z.enum(["baja","media","alta"]).describe("Urgencia").default("media"),
  },
  async (args: any) => {
    const { situacion, intentado, punto_decision, opciones, pregunta_al_humano, urgencia } = args as any;
    const st = store.load();
st.solicitudes = st.solicitudes || [];
if (!opciones || opciones.length < 2) return fail("sin >=2 opciones no hay decisión que tomar: investiga más o decide solo");
const paquete = {
  id: "tk_" + Date.now().toString(36),
  situacion, intentado: intentado || [], punto_decision, opciones: (opciones || []).map(String), pregunta_al_humano, urgencia,
  estado: "pendiente", creado: new Date().toISOString(), respondido: null,
};
st.solicitudes.push(paquete);
store.save(st);
return ok({
  takeover_id: paquete.id, urgencia,
  paquete_para_el_humano: [
    "SITUACIÓN: " + situacion,
    ...(intentado || []).map((i, x) => "INTENTO " + (x + 1) + ": " + i),
    "DECISIÓN PENDIENTE: " + punto_decision,
    ...opciones.map((o, x) => "OPCIÓN " + (x + 1) + ": " + o),
    "PREGUNTA: " + pregunta_al_humano,
  ],
  regla: "el humano decide la OPCIÓN, no re-deriva todo el análisis",
});
  }
);

server.tool(
  "respond",
  "Registra la respuesta del humano y mide el tiempo que tomó.",
  {
  takeover_id: z.string().describe("ID de la solicitud"),
  decision: z.string().describe("Qué decidió el humano (opción o instrucción)"),
  notas: z.string().describe("Matices del humano").optional(),
  },
  async (args: any) => {
    const { takeover_id, decision, notas } = args as any;
    const st = store.load();
const s = (st.solicitudes || []).find(x => x.id === takeover_id);
if (!s) return fail("solicitud no encontrada");
if (s.estado !== "pendiente") return fail("ya respondida");
s.estado = "respondida";
s.decision = { decision, notas: notas || null };
s.respondido = new Date().toISOString();
store.save(st);
return ok({
  decision,
  minutos_para_responder: Number(((new Date(s.respondido).getTime() - new Date(s.creado).getTime()) / 60000).toFixed(1)),
  proximo_paso: "continúa la tarea aplicando la decisión y registra la lección si la decisión sorprendió (lesson-library)",
});
  }
);

server.tool(
  "pending_requests",
  "Solicitudes pendientes ordenadas por urgencia y antigüedad.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const pend = (st.solicitudes || []).filter(s => s.estado === "pendiente");
if (!pend.length) return ok({ pendientes: 0 });
const peso = { alta: 0, media: 1, baja: 2 };
return ok({
  pendientes: pend.length,
  solicitudes: pend.map(s => ({ id: s.id, urgencia: s.urgencia, pregunta: s.pregunta_al_humano.slice(0, 80), minutos_esperando: Number(((Date.now() - new Date(s.creado).getTime()) / 60000).toFixed(0)) })).sort((a, b) => (peso[a.urgencia] - peso[b.urgencia]) || b.minutos_esperando - a.minutos_esperando),
});
  }
);

server.tool(
  "takeover_stats",
  "Estadísticas: cuánto decide el humano, tiempo medio de respuesta y decisiones que más se repiten.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const ss = st.solicitudes || [];
if (!ss.length) return ok({ solicitudes: 0 });
const respondidas = ss.filter(s => s.respondido);
const tiempos = respondidas.map(s => (new Date(s.respondido).getTime() - new Date(s.creado).getTime()) / 60000);
const porPunto = {};
for (const s of ss) { const k = s.punto_decision.split(/\s+/).slice(0, 3).join(" "); porPunto[k] = (porPunto[k] || 0) + 1; }
return ok({
  solicitudes: ss.length, respondidas: respondidas.length, pendientes: ss.length - respondidas.length,
  tiempo_respuesta_medio_min: tiempos.length ? Number((tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(1)) : null,
  decisiones_recurrentes: __ents(porPunto).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 2).map(([k, v]) => ({ punto: k, veces: v, sugerencia: "automatiza esta decisión con una política (escalación-policy)" })),
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor takeover-request está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "takeover-request", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[takeover-request] fatal:", e);
  process.exit(1);
});

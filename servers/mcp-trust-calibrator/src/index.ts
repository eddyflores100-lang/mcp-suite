#!/usr/bin/env node
/**
 * MCP Server: Trust Calibrator
 * Calibra la confianza humano→agente por dominio: dónde te dejan solo y dónde exigen revisión
 *
 * Dolor que resuelve: La confianza es global, no calibrada: el humano revisa todo lo que el agente ya domina (desperdicio) O deja pasar lo que el agente still rompe (desastre). Falta trust por dominio con evidencia.
 * Categoría: Humano en el Bucle | Generado por mcp-suite | id: trust-calibrator
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

// ——— persistencia local: ~/.mcp-suite/trust-calibrator/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "trust-calibrator");
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

const server = new McpServer({ name: "trust-calibrator", version: "1.0.0" });

server.tool(
  "set_trust",
  "Establece el nivel de confianza del humano en un dominio (0=ninguna, 4=autonomía total) con justificación.",
  {
  dominio: z.string().describe("Dominio de trabajo (ej: sql, redaccion, pagos)"),
  nivel: z.number().describe("0-4: 0 revisar todo, 1 asistir, 2 proponer, 3 ejecutar e informar, 4 autónomo"),
  justificacion: z.string().describe("Por qué este nivel"),
  },
  async (args: any) => {
    const { dominio, nivel, justificacion } = args as any;
    if (nivel < 0 || nivel > 4) return fail("nivel 0-4");
const st = store.load();
st.trust = st.trust || {};
st.trust[dominio] = { dominio, nivel, justificacion, exitos: st.trust[dominio]?.exitos || 0, fallos: st.trust[dominio]?.fallos || 0, ajustes: st.trust[dominio]?.ajustes || [], seteado: new Date().toISOString() };
store.save(st);
return ok({ dominio, nivel, descripcion: ["revisar TODO lo que haga", "asistir: solo tareas guiadas", "proponer: ejecuta tras aprobación", "ejecutar e informar después", "autónomo sin revisiones"][nivel] });
  }
);

server.tool(
  "record_outcome",
  "Registra un acierto o fallo del agente en el dominio: alimenta la recalibración.",
  {
  dominio: z.string().describe("Dominio"),
  exito: z.boolean().describe("¿Salió bien sin intervención?"),
  detalle: z.string().describe("Qué pasó").optional(),
  },
  async (args: any) => {
    const { dominio, exito, detalle } = args as any;
    const st = store.load();
const t = (st.trust || {})[dominio];
if (!t) return fail("dominio sin trust definido: usa set_trust");
if (exito) t.exitos++; else t.fallos++;
t.historial = t.historial || [];
t.historial.push({ exito, detalle: detalle || null, ts: new Date().toISOString() });
store.save(st);
return ok({ dominio, exitos: t.exitos, fallos: t.fallos, tasa: Number((t.exitos / (t.exitos + t.fallos)).toFixed(2)) });
  }
);

server.tool(
  "recalibrate",
  "Recomienda ajustar el nivel de trust según la evidencia acumulada (con histórico de ajustes).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const dominios = __vals(st.trust || {});
if (!dominios.length) return ok({ dominios: 0, sugerencia: "set_trust primero" });
const recomendaciones = dominios.map(t => {
  const total = t.exitos + t.fallos;
  let sugerido = null;
  if (total >= 8) {
    const tasa = t.exitos / total;
    if (tasa >= 0.95 && t.nivel < 4) sugerido = t.nivel + 1;
    else if (tasa < 0.7 && t.nivel > 0) sugerido = t.nivel - 1;
  }
  return {
    dominio: t.dominio, nivel_actual: t.nivel, exitos: t.exitos, fallos: t.fallos,
    tasa: total ? Number((t.exitos / total).toFixed(2)) : null,
    nivel_sugerido: sugerido,
    accion: sugerido === null ? "mantener" : sugerido > t.nivel ? "SUBIR: la evidencia justifica más autonomía (propón al humano)" : "BAJAR: demasiados fallos para este nivel de autonomía",
  };
});
return ok({
  dominios: recomendaciones.length,
  recomendaciones,
  subibles: recomendaciones.filter(r => r.nivel_sugerido !== null && r.nivel_sugerido > r.nivel_actual).map(r => r.dominio),
  bajables: recomendaciones.filter(r => r.nivel_sugerido !== null && r.nivel_sugerido < r.nivel_actual).map(r => r.dominio),
});
  }
);

server.tool(
  "trust_map",
  "Mapa de confianza completo: qué puede hacer solo el agente hoy, resumido.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const dominios = __vals(st.trust || {});
if (!dominios.length) return ok({ dominios: 0 });
const porNivel = {};
for (const t of dominios) porNivel[t.nivel] = (porNivel[t.nivel] || 0) + 1;
return ok({
  por_nivel: porNivel,
  autonomia_total: dominios.filter(t => t.nivel === 4).map(t => t.dominio),
  revision_total: dominios.filter(t => t.nivel === 0).map(t => t.dominio),
  balance: dominios.filter(t => t.nivel >= 3).length + " de " + dominios.length + " dominios con autonomía alta",
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor trust-calibrator está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "trust-calibrator", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[trust-calibrator] fatal:", e);
  process.exit(1);
});

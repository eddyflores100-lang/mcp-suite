#!/usr/bin/env node
/**
 * MCP Server: Action Recorder
 * Graba y reproduce secuencias de acciones con verificación de cada paso: flujos deterministas, no improvisados
 *
 * Dolor que resuelve: Cada corrida del agente de navegador improvisa el camino: hoy hace click en A→B→C, mañana prueba A→C. Sin grabación verificable, los fallos no se reproducen y nadie sabe qué hizo exactamente.
 * Categoría: Computer Use | Generado por mcp-suite | id: action-recorder
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

// ——— persistencia local: ~/.mcp-suite/action-recorder/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "action-recorder");
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

const server = new McpServer({ name: "action-recorder", version: "1.0.0" });

server.tool(
  "create_flow",
  "Crea un flujo grabado (nombre + descripción del objetivo de negocio).",
  {
  nombre: z.string().describe("Nombre del flujo"),
  objetivo: z.string().describe("Qué logra el flujo"),
  },
  async (args: any) => {
    const { nombre, objetivo } = args as any;
    const st = store.load();
st.flujos = st.flujos || {};
if (st.flujos[nombre]) return fail("flujo existente");
st.flujos[nombre] = { nombre, objetivo, pasos: [], replays: [], creado: new Date().toISOString() };
store.save(st);
return ok({ flujo: nombre, pasos: 0 });
  }
);

server.tool(
  "record_step",
  "Añade un paso al flujo: acción, objetivo (selector/coords) y verificación esperada tras el paso.",
  {
  flujo: z.string().describe("Nombre del flujo"),
  accion: z.enum(["navegar","click","escribir","seleccionar","esperar","extraer","scroll","descargar"]).describe("Tipo de acción"),
  objetivo: z.string().describe("Sobre qué (url, selector, texto a escribir)"),
  verificacion: z.string().describe("Qué debe ser cierto DESPUÉS del paso (observable)"),
  },
  async (args: any) => {
    const { flujo, accion, objetivo, verificacion } = args as any;
    const st = store.load();
const f = (st.flujos || {})[flujo];
if (!f) return fail("flujo no encontrado");
if (!verificacion) return fail("un paso sin verificación no es reproducible: ¿qué debe verse después?");
f.pasos.push({ n: f.pasos.length + 1, accion, objetivo, verificacion });
store.save(st);
return ok({ flujo, paso: f.pasos.length, total: f.pasos.length });
  }
);

server.tool(
  "replay_report",
  "Registra el resultado de un replay: cada paso verificado, fallido o desviado; devuelve salud del flujo.",
  {
  flujo: z.string().describe("Nombre del flujo"),
  resultados_pasos: z.array(z.any()).describe("Resultado por paso: true/false/otro"),
  },
  async (args: any) => {
    const { flujo, resultados_pasos } = args as any;
    const st = store.load();
const f = (st.flujos || {})[flujo];
if (!f) return fail("flujo no encontrado");
const rs = resultados_pasos || [];
if (rs.length !== f.pasos.length) return fail("esperaba " + f.pasos.length + " resultados, recibí " + rs.length);
const norm = rs.map(r => r === true ? "ok" : r === false ? "fallo" : String(r || "desviado"));
const primerFallo = norm.findIndex(r => r !== "ok");
const okCount = norm.filter(r => r === "ok").length;
f.replays.push({ ok: okCount, total: norm.length, primer_fallo: primerFallo + 1 || null, norm, ts: new Date().toISOString() });
if (f.replays.length > 50) f.replays = f.replays.slice(-30);
store.save(st);
return ok({
  flujo,
  salud: Math.round(okCount / norm.length * 100) + "%",
  primer_fallo_en_paso: primerFallo >= 0 ? { n: primerFallo + 1, accion: f.pasos[primerFallo].accion, objetivo: f.pasos[primerFallo].objetivo, verificacion: f.pasos[primerFallo].verificacion } : null,
  veredicto: okCount === norm.length ? "replay limpio" : primerFallo === 0 ? "falla al arranque: entorno o url cambiados" : "falla a mitad: revisa el paso " + (primerFallo + 1) + " y su verificación",
});
  }
);

server.tool(
  "flow_health",
  "Salud histórica del flujo: tasa de éxito por replay y paso más frágil acumulado.",
  {
  flujo: z.string().describe("Nombre del flujo"),
  },
  async (args: any) => {
    const { flujo } = args as any;
    const st = store.load();
const f = (st.flujos || {})[flujo];
if (!f) return fail("flujo no encontrado");
const replays = f.replays || [];
if (!replays.length) return ok({ flujo, replays: 0 });
const exitoTotal = replays.filter(r => r.ok === r.total).length;
const fragilidad = new Array(f.pasos.length).fill(0);
for (const r of replays) r.norm.forEach((v, i) => { if (v !== "ok") fragilidad[i]++; });
const masFragil = fragilidad.indexOf(Math.max(...fragilidad));
return ok({
  flujo, replays: replays.length,
  exito_completo_pct: Math.round(exitoTotal / replays.length * 100),
  paso_mas_fragil: { n: masFragil + 1, accion: f.pasos[masFragil]?.accion, fallos: fragilidad[masFragil] },
  fallos_por_paso: f.pasos.map((p, i) => ({ n: i + 1, accion: p.accion, fallos: fragilidad[i] })).filter(x => x.fallos > 0),
});
  }
);

server.tool(
  "list_flows",
  "Lista los flujos grabados con su salud agregada.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const flujos = __vals(st.flujos || {});
if (!flujos.length) return ok({ flujos: 0 });
return ok({ flujos: flujos.map(f => ({ nombre: f.nombre, objetivo: f.objetivo.slice(0, 60), pasos: f.pasos.length, replays: (f.replays || []).length, exito_pct: f.replays?.length ? Math.round(f.replays.filter(r => r.ok === r.total).length / f.replays.length * 100) : null })) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor action-recorder está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "action-recorder", tools: 6, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[action-recorder] fatal:", e);
  process.exit(1);
});

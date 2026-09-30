#!/usr/bin/env node
/**
 * MCP Server: Capability Gap Scanner
 * Lo que la tarea EXIGE vs lo que el agente TIENE: gaps de capacidad concretos antes de fallar en producción
 *
 * Dolor que resuelve: El agente descubre que no puede leer PDFs... a mitad de la tarea, cuando ya gastó la mitad del contexto. Nadie compara las demandas de la tarea con el inventario real de capacidades ANTES de empezar.
 * Categoría: Auto-Mejora | Generado por mcp-suite | id: capability-gap-scanner
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

// ——— persistencia local: ~/.mcp-suite/capability-gap-scanner/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "capability-gap-scanner");
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

const server = new McpServer({ name: "capability-gap-scanner", version: "1.0.0" });

server.tool(
  "declare_demands",
  "Declara qué capacidades exige la tarea entrante.",
  {
  tarea: z.string().describe("Tarea a evaluar"),
  demandas: z.array(z.any()).describe("Capacidades requeridas {capacidad, criticidad: alta|media|baja}"),
  },
  async (args: any) => {
    const { tarea, demandas } = args as any;
    const st = store.load();
st.tareas = st.tareas || {};
if (st.tareas[tarea]) return fail("tarea ya evaluada: " + tarea);
const limpias = (demandas || []).filter(d => d && d.capacidad).map(d => ({ capacidad: String(d.capacidad).toLowerCase(), criticidad: ["alta", "media", "baja"].includes(d.criticidad) ? d.criticidad : "media" }));
if (!limpias.length) return fail("sin demandas declaradas");
st.tareas[tarea] = { tarea, demandas: limpias, evaluada: new Date().toISOString() };
store.save(st);
return ok({ tarea, demandas: limpias.length, criticas: limpias.filter(d => d.criticidad === "alta").length, siguiente: "registra tu inventario real y escanea" });
  }
);

server.tool(
  "declare_inventory",
  "Declara el inventario de capacidades que realmente tienes (tools, skills, accesos).",
  {
  capacidades: z.array(z.any()).describe("Capacidades disponibles {capacidad, tipo: tool|skill|acceso|humano, nota?}"),
  },
  async (args: any) => {
    const { capacidades } = args as any;
    const st = store.load();
const limpias = (capacidades || []).filter(c => c && c.capacidad).map(c => ({ capacidad: String(c.capacidad).toLowerCase(), tipo: String(c.tipo || "tool"), nota: String(c.nota || "") }));
if (!limpias.length) return fail("inventario vacío");
st.inventario = limpias;
store.save(st);
return ok({ inventario: limpias.length, por_tipo: limpias.reduce((acc, c) => { acc[c.tipo] = (acc[c.tipo] || 0) + 1; return acc; }, {}), nota: "mantenlo honesto: listar lo que NO tienes da gaps falsos de seguridad, omitir lo que tienes genera pañicos innecesarios" });
  }
);

server.tool(
  "scan_gaps",
  "Escanea los gaps: demandas sin cobertura, con severidad y recomendación.",
  {
  tarea: z.string().describe("Tarea a escanear"),
  },
  async (args: any) => {
    const { tarea } = args as any;
    const st = store.load();
const t = (st.tareas || {})[tarea];
if (!t) return fail("tarea no declarada: usa declare_demands");
const inv = new Set<string>((st.inventario || []).map((c: any) => String(c.capacidad)));
const sinonimos = { pdf: "leer pdf", excel: "hojas de cálculo", web: "navegar", buscar: "búsqueda", fetch: "web", http: "web", correo: "email", email: "correo", calculo: "matemática", mate: "matemática" };
const cubre = (demanda: any) => {
  if (inv.has(demanda)) return "directa";
  for (const [sinon, canon] of __ents(sinonimos)) if (demanda.includes(sinon) && inv.has(canon)) return "via sinónimo";
  for (const cap of inv) if (demanda.includes(cap) || cap.includes(demanda)) return "parcial";
  return null;
};
const evaluadas = t.demandas.map(d => {
  const c = cubre(d.capacidad);
  return { ...d, cobertura: c || "NINGUNA", estado: c ? "cubierta" + (c === "parcial" ? " (parcial)" : "") : "GAP" };
});
const gaps = evaluadas.filter(e => e.estado === "GAP");
const parciales = evaluadas.filter(e => e.cobertura === "parcial");
const criticosSin = gaps.filter(g => g.criticidad === "alta");
const cobertura = Number(((evaluadas.length - gaps.length) / evaluadas.length * 100).toFixed(0));
return ok({ tarea, cobertura_pct: cobertura + "%", gaps_totales: gaps.length, gaps_criticos: criticosSin.map(g => g.capacidad), evaluacion: evaluadas, veredicto: criticosSin.length ? "NO EMPIECES: hay " + criticosSin.length + " gaps CRÍTICOS (" + criticosSin.map(g => g.capacidad).join(", ") + "): adquiere la capacidad o negocia el alcance AHORA, no a mitad de tarea" : gaps.length ? "EMPIEZA CON PLAN B: los gaps (" + gaps.map(g => g.capacidad).join(", ") + ") son no-críticos: define el rodeo antes" : "cobertura completa: la tarea está dentro de tus capacidades", parciales_atencion: parciales.length ? parciales.map(p => p.capacidad + " (parcial: valida que el alcance real alcanza)") : [] });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor capability-gap-scanner está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "capability-gap-scanner", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[capability-gap-scanner] fatal:", e);
  process.exit(1);
});

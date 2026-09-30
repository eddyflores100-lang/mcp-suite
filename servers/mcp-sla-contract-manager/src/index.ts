#!/usr/bin/env node
/**
 * MCP Server: SLA Contract Manager
 * Contratos de nivel de servicio entre agentes: métricas, objetivos, ventanas y detección de brechas
 *
 * Dolor que resuelve: El agente contrata un sub-agente 'rápido' sin SLA escrito: cuando empieza a tardar 40 segundos no hay objetivo, ni ventana de medición, ni forma objetiva de reclamar. La confianza entre agentes sin métricas es humo.
 * Categoría: Comercio A2A | Generado por mcp-suite | id: sla-contract-manager
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

// ——— persistencia local: ~/.mcp-suite/sla-contract-manager/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "sla-contract-manager");
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

const server = new McpServer({ name: "sla-contract-manager", version: "1.0.0" });

server.tool(
  "create_contract",
  "Crea un contrato SLA: proveedor, métrica, objetivo, ventana y penalización por incumplimiento.",
  {
  proveedor: z.string().describe("Agente/servicio proveedor"),
  consumidor: z.string().describe("Agente consumidor").default("yo"),
  metrica: z.enum(["latencia_p95_ms","disponibilidad_pct","tasa_error_pct","throughput_rps","tiempo_resolucion_horas"]).describe("Métrica contratada"),
  objetivo: z.number().describe("Valor objetivo (mejor = más rápido/más alto según métrica)"),
  ventana: z.enum(["por_llamada","diaria","semanal","mensual"]).describe("Ventana de evaluación"),
  penalizacion: z.string().describe("Qué pasa si se incumple (descuento, crédito, terminación)").optional(),
  periodo_gracia_min: z.number().describe("Minutos de gracia antes de contar un incumplimiento").default(0),
  },
  async (args: any) => {
    const { proveedor, consumidor, metrica, objetivo, ventana, penalizacion, periodo_gracia_min } = args as any;
    const st = store.load();
st.contratos = st.contratos || [];
const id = "sla_" + String(st.contratos.length + 1).padStart(4, "0");
const esMax = ["latencia_p95_ms", "tasa_error_pct", "tiempo_resolucion_horas"].includes(metrica);
st.contratos.push({ id, proveedor, consumidor, metrica, objetivo, sentido: esMax ? "maximo" : "minimo", ventana, penalizacion: penalizacion || "sin penalización definida", periodo_gracia_min, mediciones: [], brechas: [], activo: true, creado: new Date().toISOString() });
store.save(st);
return ok({ id, proveedor, metrica, objetivo, sentido: esMax ? "≤ " + objetivo : "≥ " + objetivo, ventana, siguiente: "registra mediciones reales con record_measurement" });
  }
);

server.tool(
  "record_measurement",
  "Registra una medición real de la métrica del contrato.",
  {
  id: z.string().describe("Id del contrato"),
  valor: z.number().describe("Valor medido"),
  contexto: z.string().describe("Contexto (llamada, día, carga)").optional(),
  },
  async (args: any) => {
    const { id, valor, contexto } = args as any;
    const st = store.load();
const c = (st.contratos || []).find(x => x.id === id);
if (!c) return fail("contrato no encontrado: " + id);
c.mediciones.push({ valor, contexto: contexto || "", ts: new Date().toISOString() });
store.save(st);
return ok({ id, mediciones: c.mediciones.length });
  }
);

server.tool(
  "check_breach",
  "Evalúa el contrato contra las mediciones registradas: ¿hay brecha? ¿con gracia? ¿reclamable?",
  {
  id: z.string().describe("Id del contrato"),
  },
  async (args: any) => {
    const { id } = args as any;
    const st = store.load();
const c = (st.contratos || []).find(x => x.id === id);
if (!c) return fail("contrato no encontrado");
const m = c.mediciones || [];
if (!m.length) return fail("sin mediciones: registra primero con record_measurement");
let valores = m.map(x => x.valor);
let resumen;
if (c.metrica === "latencia_p95_ms") {
  const ordenados = valores.slice().sort((a, b) => a - b);
  valores = [ordenados[Math.floor(ordenados.length * 0.95)]];
  resumen = "p95 sobre " + m.length + " mediciones";
} else if (c.ventana === "diaria") {
  const hoy = new Date().toISOString().slice(0, 10);
  const deHoy = m.filter(x => x.ts.slice(0, 10) === hoy);
  if (deHoy.length) { valores = deHoy.map(x => x.valor); resumen = "media de " + deHoy.length + " mediciones de hoy"; }
} else { resumen = "todas las mediciones (" + m.length + ")"; }
const agregado = valores.length > 1 ? valores.reduce((a, b) => a + b, 0) / valores.length : valores[0];
const incumple = c.sentido === "maximo" ? agregado > c.objetivo : agregado < c.objetivo;
const exceso = c.sentido === "maximo" ? Number((agregado - c.objetivo).toFixed(2)) : Number((c.objetivo - agregado).toFixed(2));
const ratio = Number((agregado / c.objetivo).toFixed(2));
if (incumple) {
  c.brechas.push({ ts: new Date().toISOString(), valor: Number(agregado.toFixed(2)), objetivo: c.objetivo, exceso, ratio });
  store.save(st);
}
const recl = incumple && ratio > (c.sentido === "maximo" ? 1.2 : 0.8);
return ok({ id, proveedor: c.proveedor, metrica: c.metrica, agregado: Number(agregado.toFixed(2)), calculo: resumen, objetivo: c.objetivo, sentido: c.sentido, en_brecha: incumple, desvio: exceso, ratio_objetivo: ratio, penalizacion: c.penalizacion, reclamo: incumple ? (recl ? "RECLAMABLE: desvío del " + Number((Math.abs(ratio - 1) * 100).toFixed(0)) + "% supera el umbral de tolerancia del 20%: documenta evidencia y reclama" : "leve: dentro de tolerancia del 20%, monitorea") : "conforme", brechas_totales: c.brechas.length });
  }
);

server.tool(
  "contract_health",
  "Salud global: contratos por proveedor, tendencias y quién incumple más.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const cs = st.contratos || [];
if (!cs.length) return ok({ contratos: 0, mensaje: "sin contratos" });
const porProv = {};
cs.forEach(c => {
  porProv[c.proveedor] = porProv[c.proveedor] || { proveedor: c.proveedor, contratos: 0, mediciones: 0, brechas: 0 };
  porProv[c.proveedor].contratos++;
  porProv[c.proveedor].mediciones += (c.mediciones || []).length;
  porProv[c.proveedor].brechas += (c.brechas || []).length;
});
const ranking = __vals(porProv).map(p => ({ ...p, tasa_brecha: p.mediciones ? Number((p.brechas / p.mediciones * 100).toFixed(0)) + "%" : "n/a" })).sort((a, b) => b.brechas - a.brechas);
return ok({ contratos: cs.length, activos: cs.filter(c => c.activo).length, ranking_proveedores: ranking, recomendacion: ranking[0] && ranking[0].brechas > 3 ? "el proveedor '" + ranking[0].proveedor + "' acumula " + ranking[0].brechas + " brechas: renegocia SLA o cambia de proveedor" : "sin proveedores problemáticos" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor sla-contract-manager está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "sla-contract-manager", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[sla-contract-manager] fatal:", e);
  process.exit(1);
});

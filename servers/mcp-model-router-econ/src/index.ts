#!/usr/bin/env node
/**
 * MCP Server: Model Router Econ
 * Rutea cada sub-tarea al modelo más barato capaz: stop usando un tanque para mandar un email
 *
 * Dolor que resuelve: El agente usa el modelo más caro para TODO: clasificar un email, sumar dos números o redactar una nota usan el mismo modelo premium. El ruteo por complejidad ahorra 50-80% y nadie lo implementa.
 * Categoría: Economía del Agente | Generado por mcp-suite | id: model-router-econ
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

// ——— persistencia local: ~/.mcp-suite/model-router-econ/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "model-router-econ");
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

const server = new McpServer({ name: "model-router-econ", version: "1.0.0" });

server.tool(
  "register_model",
  "Registra un modelo con costos por 1M tokens (entrada/salida) y tier de capacidad (1=básico, 4=frontier).",
  {
  modelo: z.string().describe("Nombre del modelo"),
  costo_entrada_1m: z.number().describe("USD por 1M tokens de entrada"),
  costo_salida_1m: z.number().describe("USD por 1M tokens de salida"),
  tier: z.number().describe("Capacidad: 1 básico, 2 estándar, 3 avanzado, 4 frontier"),
  fortalezas: z.array(z.any()).describe("Etiquetas de fortaleza").default([]),
  },
  async (args: any) => {
    const { modelo, costo_entrada_1m, costo_salida_1m, tier, fortalezas } = args as any;
    if (tier < 1 || tier > 4) return fail("tier 1-4");
const st = store.load();
st.modelos = st.modelos || {};
st.modelos[modelo] = { modelo, costo_entrada_1m, costo_salida_1m, tier, fortalezas: fortalezas || [], decisiones: 0, tokens_servidos: 0 };
store.save(st);
return ok({ modelo, tier, costo_medio_1m: (costo_entrada_1m + costo_salida_1m) / 2 });
  }
);

server.tool(
  "route",
  "Dada una tarea, clasifica su tier requerido y devuelve el modelo más barato que lo cubre (con costo estimado).",
  {
  tarea: z.string().describe("Descripción de la sub-tarea"),
  tokens_estimados: z.number().describe("Tokens totales estimados").default(2000),
  forzar_tier: z.number().describe("Tier mínimo requerido manual").optional(),
  },
  async (args: any) => {
    const { tarea, tokens_estimados, forzar_tier } = args as any;
    const st = store.load();
const modelos = __vals(st.modelos || {});
if (!modelos.length) return fail("registra modelos con register_model primero");
const t = String(tarea).toLowerCase();
const REGLAS = [
  { pat: /(clasifica|etiqueta|es spam|sentimiento|revisa formato|es válido|es valido|extrae campo)/, tier: 1 },
  { pat: /(resume|traduce|redacta|re formula|nota|respuesta simple)/, tier: 2 },
  { pat: /(analiza|compara|planifica|explica|código|codigo|script|debug|consulta sql)/, tier: 3 },
  { pat: /(arquitectura|diseña|disena|investiga|razona|demostración|demostracion|multi-paso|estrategia|optimiza|crítico|critico)/, tier: 4 },
];
let tierReq = 2;
for (const r of REGLAS) if (r.pat.test(t)) tierReq = r.tier;
if (forzar_tier) tierReq = forzar_tier;
const candidatos = modelos.filter(m => m.tier >= tierReq).sort((a, b) => (a.costo_entrada_1m + a.costo_salida_1m) - (b.costo_entrada_1m + b.costo_salida_1m));
const elegido = candidatos[0];
const premium = modelos.filter(m => m.tier === 4).sort((a, b) => (b.costo_entrada_1m + b.costo_salida_1m) - (a.costo_entrada_1m + a.costo_salida_1m))[0];
const costoElegido = (elegido.costo_entrada_1m * 0.7 + elegido.costo_salida_1m * 0.3) * tokens_estimados / 1e6;
const costoPremium = premium ? (premium.costo_entrada_1m * 0.7 + premium.costo_salida_1m * 0.3) * tokens_estimados / 1e6 : costoElegido;
elegido.decisiones = (elegido.decisiones || 0) + 1;
elegido.tokens_servidos = (elegido.tokens_servidos || 0) + tokens_estimados;
st.historial = st.historial || [];
st.historial.push({ tarea: t.slice(0, 80), tier_req: tierReq, modelo: elegido.modelo, ts: new Date().toISOString() });
if (st.historial.length > 500) st.historial = st.historial.slice(-300);
store.save(st);
return ok({
  tier_requerido: tierReq,
  elegido: elegido.modelo,
  costo_estimado_usd: Number(costoElegido.toFixed(5)),
  ahorro_vs_premium: Number((costoPremium - costoElegido).toFixed(5)),
  alternativas: candidatos.slice(1, 3).map(m => m.modelo),
  criterio: "más barato cuyo tier cubre la tarea; fuerza tier si el resultado no te convence",
});
  }
);

server.tool(
  "routing_stats",
  "Estadísticas de ruteo: uso por modelo, tier medio demandado y ahorro acumulado estimado.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const modelos = __vals(st.modelos || {});
const hist = st.historial || [];
if (!modelos.length) return ok({ modelos: 0 });
const tierMedio = hist.length ? hist.reduce((s, h) => s + h.tier_req, 0) / hist.length : null;
return ok({
  modelos_registrados: modelos.length,
  decisiones_totales: hist.length,
  tier_medio_demandado: tierMedio ? Number(tierMedio.toFixed(2)) : null,
  uso_por_modelo: modelos.map(m => ({ modelo: m.modelo, tier: m.tier, decisiones: m.decisiones || 0, tokens_servidos: m.tokens_servidos || 0 })).sort((a, b) => b.decisiones - a.decisiones),
  lectura: tierMedio && tierMedio < 3 ? "mix saludable: la mayoría de tareas no necesitan frontier" : tierMedio ? "sesgo a modelos caros: revisa si las tareas simples están bien clasificadas" : "sin historial aún",
});
  }
);

server.tool(
  "list_models",
  "Lista modelos registrados con costos y fortalezas, ordenados por costo.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const modelos = __vals(st.modelos || {});
if (!modelos.length) return ok({ modelos: 0, sugerencia: "register_model" });
return ok({ modelos: modelos.sort((a, b) => (a.costo_entrada_1m + a.costo_salida_1m) - (b.costo_entrada_1m + b.costo_salida_1m)).map(m => ({ modelo: m.modelo, tier: m.tier, entrada_1m: m.costo_entrada_1m, salida_1m: m.costo_salida_1m, fortalezas: m.fortalezas })) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor model-router-econ está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "model-router-econ", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[model-router-econ] fatal:", e);
  process.exit(1);
});

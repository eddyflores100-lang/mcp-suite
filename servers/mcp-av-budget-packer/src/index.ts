#!/usr/bin/env node
/**
 * MCP Server: AV Budget Packer
 * Mochila de contexto multimodal: qué audios, imágenes y videos caben en el presupuesto con prioridad declarada
 *
 * Dolor que resuelve: El agente multimodal mete 6 imágenes y 3 audios 'porque caben' y revienta el contexto a los 4 turnos: no existe la disciplina de presupuestar assets por prioridad como se presupuestan tokens.
 * Categoría: Multimodal & Voz | Generado por mcp-suite | id: av-budget-packer
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

// ——— persistencia local: ~/.mcp-suite/av-budget-packer/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "av-budget-packer");
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

const server = new McpServer({ name: "av-budget-packer", version: "1.0.0" });

server.tool(
  "register_asset",
  "Registra un asset multimodal con coste estimado en tokens y prioridad.",
  {
  asset: z.string().describe("Identificador del asset"),
  tipo: z.enum(["imagen","audio","video","documento"]).describe("Tipo"),
  tokens_estimados: z.number().describe("Coste en tokens (imagen ~ (ancho*alto)/750, audio ~ 25 por segundo)"),
  prioridad: z.number().describe("Prioridad 1 (imprescindible) a 10 (prescindible)"),
  valor: z.string().describe("Qué aporta este asset a la tarea").optional(),
  },
  async (args: any) => {
    const { asset, tipo, tokens_estimados, prioridad, valor } = args as any;
    const st = store.load();
st.assets = st.assets || {};
if (st.assets[asset]) return fail("asset ya registrado: " + asset);
if (tokens_estimados <= 0) return fail("tokens_estimados debe ser positivo");
if (prioridad < 1 || prioridad > 10) return fail("prioridad de 1 a 10");
st.assets[asset] = { asset, tipo, tokens: tokens_estimados, prioridad, valor: valor || "", densidad: Number(((11 - prioridad) * 1000 / tokens_estimados).toFixed(3)), usado_en: [], creado: new Date().toISOString() };
store.save(st);
return ok({ asset, tipo, tokens: tokens_estimados, prioridad, densidad_valor_por_token: st.assets[asset].densidad });
  }
);

server.tool(
  "pack",
  "Resuelve la mochila: qué assets entran en el presupuesto de tokens, por densidad de valor.",
  {
  presupuesto_tokens: z.number().describe("Tokens disponibles para assets"),
  filtrar: z.array(z.any()).describe("Restrictir a ciertos ids de asset").optional(),
  },
  async (args: any) => {
    const { presupuesto_tokens, filtrar } = args as any;
    const st = store.load();
let candidatos = __vals(st.assets || {});
if (filtrar && filtrar.length) candidatos = candidatos.filter(a => filtrar.includes(a.asset));
if (!candidatos.length) return fail("sin assets registrados");
const ordenados = candidatos.slice().sort((a, b) => b.densidad - a.densidad);
const dentro = [], fuera = [];
let restante = presupuesto_tokens;
ordenados.forEach(a => {
  if (a.tokens <= restante) { dentro.push(a); restante -= a.tokens; }
  else fuera.push(a);
});
const criticoFuera = fuera.filter(a => a.prioridad <= 3);
return ok({ presupuesto: presupuesto_tokens, usados: presupuesto_tokens - restante, libres: restante, dentro: dentro.map(a => ({ asset: a.asset, tipo: a.tipo, tokens: a.tokens, prioridad: a.prioridad })), fuera: fuera.map(a => ({ asset: a.asset, tipo: a.tipo, tokens: a.tokens, prioridad: a.prioridad, razon: a.tokens > presupuesto_tokens ? "NO CABE NUNCA: demasiado grande, redúcelo en origen" : "cabe con presupuesto mayor o recortando otro" })), alertas: criticoFuera.length ? criticoFuera.map(a => "CRÍTICO fuera: " + a.asset + " (prioridad " + a.prioridad + "): sube el presupuesto o baja assets de prioridad 8-10") : [], utilizacion: Number(((presupuesto_tokens - restante) / presupuesto_tokens * 100).toFixed(0)) + "%" });
  }
);

server.tool(
  "suggest_downsample",
  "Para los assets que no cupieron: cuánto reducirlos para que entren (o por qué no merece la pena).",
  {
  asset: z.string().describe("Asset a reducir"),
  presupuesto_tokens: z.number().describe("Tokens disponibles para él"),
  },
  async (args: any) => {
    const { asset, presupuesto_tokens } = args as any;
    const st = store.load();
const a = (st.assets || {})[asset];
if (!a) return fail("asset no registrado: " + asset);
const ratio = Number((presupuesto_tokens / a.tokens).toFixed(2));
if (ratio >= 1) return ok({ asset, cabe_ya: true, mensaje: "cabe tal cual: " + a.tokens + " tokens < presupuesto " + presupuesto_tokens });
if (ratio < 0.15) return ok({ asset, cabe_ya: false, ratio, recomendacion: "requerirías reducir al " + Number((ratio * 100).toFixed(0)) + "%: la pérdida de información es inaceptable, descártalo o pide el asset de nuevo en origen" });
const ajustes = {
  imagen: ratio < 0.5 ? "recorta a la región de interés + baja resolución a ~" + Math.round(512 * ratio * 2) + "px: los detalles se pierden pero la escena sobrevive" : "baja resolución a ~" + Math.round(1024 * ratio) + "px o recorta bordes",
  audio: "transcribe en su lugar (texto ~75% más barato) o recorta al segmento relevante ~" + Number((ratio * 100).toFixed(0)) + "% de duración",
  video: "extrae keyframes (" + Math.max(2, Math.round(8 * ratio)) + " frames) + transcripción del audio",
  documento: "extrae solo las secciones relevantes (~" + Number((ratio * 100).toFixed(0)) + "% del documento)"
};
return ok({ asset, tipo: a.tipo, tokens_actuales: a.tokens, presupuesto: presupuesto_tokens, ratio_posible: ratio, ajuste_sugerido: ajustes[a.tipo], aviso_prioridad: a.prioridad <= 3 ? "es prioridad " + a.prioridad + ": MERECE el downsample" : "prioridad " + a.prioridad + ": descártalo antes que degradar los críticos" });
  }
);

server.tool(
  "pack_report",
  "Informe de coste acumulado de assets por tarea y detección de pesos repetidos.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const assets = __vals(st.assets || {});
if (!assets.length) return ok({ assets: 0, mensaje: "sin assets" });
const porTipo = {};
assets.forEach(a => { porTipo[a.tipo] = porTipo[a.tipo] || { tipo: a.tipo, count: 0, tokens: 0 }; porTipo[a.tipo].count++; porTipo[a.tipo].tokens += a.tokens; });
const gigantes = assets.filter(a => a.tokens > 4000);
return ok({ assets: assets.length, tokens_totales: assets.reduce((a, x) => a + x.tokens, 0), por_tipo: __vals(porTipo), mas_caros: assets.slice().sort((a, b) => b.tokens - a.tokens).slice(0, 5).map(a => ({ asset: a.asset, tipo: a.tipo, tokens: a.tokens, prioridad: a.prioridad })), gigantes: gigantes.map(g => g.asset + " (" + g.tokens + " tokens)"), recomendacion: gigantes.length ? "los assets de +4000 tokens devoran presupuestos típicos (8k-16k): recortarlos en origen es la mayor palanca de ahorro" : "tamaños razonables" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor av-budget-packer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "av-budget-packer", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[av-budget-packer] fatal:", e);
  process.exit(1);
});

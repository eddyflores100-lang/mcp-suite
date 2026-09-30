#!/usr/bin/env node
/**
 * MCP Server: Fact Staleness
 * Validez temporal de hechos: cada dato caduca y el agente debe saber cuándo ya no sirve
 *
 * Dolor que resuelve: El agente trata todos los hechos como eternos: cita un dato de 2023 como vigente, mezcla precios antiguos con actuales y no sabe qué parte de su conocimiento ya venció.
 * Categoría: Frescura del Conocimiento | Generado por mcp-suite | id: fact-staleness
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

// ——— persistencia local: ~/.mcp-suite/fact-staleness/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "fact-staleness");
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

const server = new McpServer({ name: "fact-staleness", version: "1.0.0" });

server.tool(
  "register_fact",
  "Registra un hecho con su fuente, fecha de observación y clase (que determina su vida media).",
  {
  hecho: z.string().describe("El hecho en una frase"),
  valor: z.string().describe("Valor/dato concreto"),
  clase: z.enum(["precio","metrica","inventario","noticia","regla_negocio","hecho_estructural","dato_persona"]).describe("Clase de hecho"),
  fuente: z.string().describe("De dónde se obtuvo"),
  observado: z.string().describe("Fecha ISO en que se observó").optional(),
  },
  async (args: any) => {
    const { hecho, valor, clase, fuente, observado } = args as any;
    const st = store.load();
st.hechos = st.hechos || [];
const VIDA_MEDIA_DIAS = { precio: 7, metrica: 30, inventario: 1, noticia: 14, regla_negocio: 180, hecho_estructural: 3650, dato_persona: 365 };
const obs = observado || new Date().toISOString();
if (isNaN(new Date(obs).getTime())) return fail("observado no es fecha ISO");
st.hechos.push({ id: "ft_" + Date.now().toString(36), hecho, valor, clase, fuente, observado: obs, vida_media_dias: VIDA_MEDIA_DIAS[clase], verificaciones: 0, ts: new Date().toISOString() });
store.save(st);
return ok({ id: st.hechos[st.hechos.length - 1].id, hecho: hecho.slice(0, 70), clase, vida_media_dias: VIDA_MEDIA_DIAS[clase], caduca_aprox: new Date(new Date(obs).getTime() + VIDA_MEDIA_DIAS[clase] * 86400000).toISOString().slice(0, 10) });
  }
);

server.tool(
  "check_freshness",
  "Evalúa la frescura de los hechos registrados: frescos, a punto de caducar y ya vencidos.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const hechos = st.hechos || [];
if (!hechos.length) return ok({ hechos: 0, sugerencia: "registra hechos con register_fact" });
const ahora = Date.now();
const evaluados = hechos.map(f => {
  const edadDias = (ahora - new Date(f.observado).getTime()) / 86400000;
  const ratio = edadDias / f.vida_media_dias;
  const estado = ratio > 1 ? "VENCIDO" : ratio > 0.7 ? "A_PUNTO" : "fresco";
  return { id: f.id, hecho: f.hecho.slice(0, 70), clase: f.clase, edad_dias: Number(edadDias.toFixed(1)), vida_media: f.vida_media_dias, estado };
});
return ok({
  hechos: evaluados.length,
  frescos: evaluados.filter(e => e.estado === "fresco").length,
  a_punto: evaluados.filter(e => e.estado === "A_PUNTO").length,
  vencidos: evaluados.filter(e => e.estado === "VENCIDO").length,
  vencidos_detalle: evaluados.filter(e => e.estado === "VENCIDO").slice(0, 10),
  regla: "un hecho VENCIDO no puede usarse en una respuesta sin re-verificarlo (refresh_fact) o marcarlo como desactualizado",
});
  }
);

server.tool(
  "refresh_fact",
  "Re-verifica un hecho: nuevo valor + fuente + fecha, dejando auditoría del cambio.",
  {
  id: z.string().describe("ID del hecho"),
  nuevo_valor: z.string().describe("Valor re-verificado"),
  fuente: z.string().describe("Fuente de la verificación"),
  sin_cambio: z.boolean().describe("true si se confirmó igual").default(false),
  },
  async (args: any) => {
    const { id, nuevo_valor, fuente, sin_cambio } = args as any;
    const st = store.load();
const f = (st.hechos || []).find(x => x.id === id);
if (!f) return fail("hecho no encontrado");
f.historial = f.historial || [];
f.historial.push({ valor: f.valor, observado: f.observado, ts: new Date().toISOString() });
if (!sin_cambio) f.valor = nuevo_valor;
f.observado = new Date().toISOString();
if (fuente) f.fuente = fuente;
f.verificaciones++;
store.save(st);
return ok({ hecho: f.hecho.slice(0, 70), verificado: true, valor_actual: f.valor, cambios_previos: f.historial.length });
  }
);

server.tool(
  "assert_usable",
  "Antes de usar un hecho en una respuesta: ¿sigue siendo utilizable o hay que re-verificarlo?",
  {
  id: z.string().describe("ID del hecho"),
  },
  async (args: any) => {
    const { id } = args as any;
    const st = store.load();
const f = (st.hechos || []).find(x => x.id === id);
if (!f) return fail("hecho no encontrado");
const edadDias = (Date.now() - new Date(f.observado).getTime()) / 86400000;
const ratio = edadDias / f.vida_media_dias;
if (ratio > 1) return ok({ utilizable: false, accion: "RE-VERIFICAR antes de citar: venció hace " + Number((ratio - 1) * f.vida_media_dias).toFixed(1) + " días (vida media " + f.vida_media_dias + "d)", valor_actual: f.valor });
if (ratio > 0.7) return ok({ utilizable: "condicional", accion: "cítaalo con fecha ('según " + f.fuente + ", " + f.observado.slice(0, 10) + "') y re-verifica si es decisión crítica", valor_actual: f.valor });
return ok({ utilizable: true, accion: "puedes usarlo; aún así cita la fecha de observación", valor_actual: f.valor, observado: f.observado.slice(0, 10) });
  }
);

server.tool(
  "staleness_report",
  "Reporte por clase de hecho: qué clases de conocimiento se mantienen al día y cuáles no.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const hechos = st.hechos || [];
if (!hechos.length) return ok({ hechos: 0 });
const porClase = {};
for (const f of hechos) {
  porClase[f.clase] = porClase[f.clase] || { total: 0, vencidos: 0, verificaciones: 0 };
  porClase[f.clase].total++;
  if ((Date.now() - new Date(f.observado).getTime()) / 86400000 > f.vida_media_dias) porClase[f.clase].vencidos++;
  porClase[f.clase].verificaciones += f.verificaciones;
}
return ok({
  clases: Object.keys(porClase).length,
  por_clase: __ents(porClase).map(([k, v]: [string, any]) => ({ clase: k, hechos: v.total, vencidos: v.vencidos, pct: v.total ? v.vencidos / v.total : 0 })).sort((a, b) => b.pct - a.pct),
  clase_mas_descuidada: __ents(porClase).map(([k, v]: [string, any]) => ({ k, r: v.total ? v.vencidos / v.total : 0 })).sort((a, b) => b.r - a.r)[0].k,
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor fact-staleness está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "fact-staleness", tools: 6, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[fact-staleness] fatal:", e);
  process.exit(1);
});

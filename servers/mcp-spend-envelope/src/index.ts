#!/usr/bin/env node
/**
 * MCP Server: Spend Envelope
 * Sobres de gasto con autorización escalonada: el agente pide permiso ANTES de quemar el presupuesto
 *
 * Dolor que resuelve: El agente no tiene freno económico: una tarea de $0.05 termina costando $3 porque nadie le exigió parar y pedir autorización al cruzar umbrales.
 * Categoría: Economía del Agente | Generado por mcp-suite | id: spend-envelope
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

// ——— persistencia local: ~/.mcp-suite/spend-envelope/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "spend-envelope");
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

const server = new McpServer({ name: "spend-envelope", version: "1.0.0" });

server.tool(
  "create_envelope",
  "Crea un sobre de gasto: techo, umbral de aviso (80% por defecto) y política al superarlo.",
  {
  nombre: z.string().describe("Nombre del sobre (misión, tarea X...)"),
  techo_usd: z.number().describe("Límite máximo en dólares"),
  padre: z.string().describe("Sobre padre (para jerarquía)").optional(),
  umbral_aviso_pct: z.number().describe("% al que avisa").default(80),
  politica: z.enum(["parar","pedir_autorizacion","abortar"]).describe("Al alcanzar el techo").default("pedir_autorizacion"),
  },
  async (args: any) => {
    const { nombre, techo_usd, padre, umbral_aviso_pct, politica } = args as any;
    if (techo_usd <= 0) return fail("techo inválido");
const st = store.load();
st.sobres = st.sobres || {};
if (st.sobres[nombre]) return fail("sobre existente");
if (padre && !st.sobres[padre]) return fail("sobre padre no encontrado: " + padre);
st.sobres[nombre] = { nombre, techo_usd, padre: padre || null, umbral_aviso_pct: umbral_aviso_pct ?? 80, politica, gastado: 0, movimientos: [], autorizaciones: [], estado: "abierto", creado: new Date().toISOString() };
store.save(st);
return ok({ sobre: nombre, techo: techo_usd, politica });
  }
);

server.tool(
  "spend",
  "Registra gasto contra un sobre: valida techo, jerarquía y devuelve directiva (ok, aviso, PARAR).",
  {
  sobre: z.string().describe("Nombre del sobre"),
  concepto: z.string().describe("En qué se gastó (llm, tool, api)"),
  usd: z.number().describe("Importe gastado"),
  tokens: z.number().describe("Tokens si aplica").optional(),
  },
  async (args: any) => {
    const { sobre, concepto, usd, tokens } = args as any;
    const st = store.load();
const s = (st.sobres || {})[sobre];
if (!s) return fail("sobre no encontrado: " + sobre);
if (s.estado !== "abierto") return fail("sobre " + s.estado);
if (usd <= 0) return fail("importe inválido");
const previo = s.gastado;
s.gastado = Number((s.gastado + usd).toFixed(4));
s.movimientos.push({ concepto, usd, tokens: tokens || null, ts: new Date().toISOString(), acumulado: s.gastado });
const pct = s.gastado / s.techo_usd * 100;
let directiva = "ok";
if (pct >= 100) {
  if (s.politica === "parar") { s.estado = "pausado"; directiva = "PARAR: techo alcanzado, política parar"; }
  else if (s.politica === "abortar") { s.estado = "abortado"; directiva = "ABORTAR: techo alcanzado"; }
  else directiva = "PEDIR_AUTORIZACION: techo alcanzado (" + s.gastado.toFixed(2) + "/" + s.techo_usd + " USD)";
} else if (pct >= (s.umbral_aviso_pct ?? 80)) {
  directiva = "AVISO: " + Math.round(pct) + "% del techo consumido, queda " + (s.techo_usd - s.gastado).toFixed(2) + " USD";
}
let padreAviso = null;
if (s.padre) {
  const p = st.sobres[s.padre];
  p.gastado = Number((p.gastado + usd).toFixed(4));
  const pctP = p.gastado / p.techo_usd * 100;
  if (pctP >= (p.umbral_aviso_pct ?? 80)) padreAviso = "PADRE " + p.nombre + " al " + Math.round(pctP) + "%";
}
store.save(st);
return ok({ sobre, gastado: s.gastado, techo: s.techo_usd, pct: Number(pct.toFixed(1)), directiva, aviso_padre: padreAviso });
  }
);

server.tool(
  "authorize",
  "Autoriza (o niega) continuar tras alcanzar el techo; queda auditoría de quién y cuánto extra.",
  {
  sobre: z.string().describe("Nombre del sobre"),
  aprobado: z.boolean().describe("¿Autorizado?"),
  monto_extra_usd: z.number().describe("Techo adicional autorizado").optional(),
  autorizado_por: z.string().describe("Quién autoriza"),
  motivo: z.string().describe("Por qué"),
  },
  async (args: any) => {
    const { sobre, aprobado, monto_extra_usd, autorizado_por, motivo } = args as any;
    const st = store.load();
const s = (st.sobres || {})[sobre];
if (!s) return fail("sobre no encontrado");
s.autorizaciones.push({ aprobado, extra: monto_extra_usd || 0, por: autorizado_por, motivo, ts: new Date().toISOString() });
if (aprobado) {
  if (monto_extra_usd) s.techo_usd = Number((s.techo_usd + monto_extra_usd).toFixed(4));
  s.estado = "abierto";
} else {
  s.estado = "cerrado";
}
store.save(st);
return ok({ sobre, decision: aprobado ? "aprobado" : "denegado", nuevo_techo: s.techo_usd, estado: s.estado });
  }
);

server.tool(
  "envelope_status",
  "Estado de un sobre: consumo, proyección al ritmo actual y movimientos recientes.",
  {
  sobre: z.string().describe("Nombre del sobre"),
  },
  async (args: any) => {
    const { sobre } = args as any;
    const st = store.load();
const s = (st.sobres || {})[sobre];
if (!s) return fail("sobre no encontrado");
const movs = s.movimientos;
let ritmo = null;
if (movs.length >= 3) {
  const spanMs = new Date(movs[movs.length - 1].ts).getTime() - new Date(movs[0].ts).getTime();
  if (spanMs > 0) ritmo = Number((s.gastado / (spanMs / 3600000)).toFixed(3));
}
return ok({
  sobre, estado: s.estado,
  gastado: Number(s.gastado.toFixed(4)), techo: s.techo_usd, pct: Number((s.gastado / s.techo_usd * 100).toFixed(1)),
  usd_por_hora: ritmo,
  horas_para_techo: ritmo && ritmo > 0 ? Number(((s.techo_usd - s.gastado) / ritmo).toFixed(1)) : null,
  movimientos: movs.slice(-8).map(m => ({ concepto: m.concepto, usd: m.usd, acumulado: Number(m.acumulado.toFixed(3)) })),
  autorizaciones: s.autorizaciones.length,
});
  }
);

server.tool(
  "portfolio",
  "Panorama de todos los sobres: consumo agregado, sobres en riesgo y autorizaciones pendientes.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const sobres = __vals(st.sobres || {});
if (!sobres.length) return ok({ sobres: 0, sugerencia: "crea sobres con create_envelope" });
const totalGastado = sobres.reduce((s, x) => s + x.gastado, 0);
const totalTecho = sobres.reduce((s, x) => s + x.techo_usd, 0);
const enRiesgo = sobres.filter(x => x.estado === "abierto" && x.gastado / x.techo_usd * 100 >= (x.umbral_aviso_pct ?? 80));
const pausados = sobres.filter(x => ["pausado", "abortado"].includes(x.estado));
return ok({
  sobres: sobres.length,
  global: { gastado: Number(totalGastado.toFixed(2)), techo: Number(totalTecho.toFixed(2)), pct: Number((totalGastado / totalTecho * 100).toFixed(1)) },
  en_riesgo: enRiesgo.map(x => ({ sobre: x.nombre, pct: Math.round(x.gastado / x.techo_usd * 100) })),
  pausados_o_abortados: pausados.map(x => ({ sobre: x.nombre, estado: x.estado, gastado: Number(x.gastado.toFixed(3)) })),
  acciones: enRiesgo.length ? "sobres en riesgo: decide autorizar o dejar que la política actúe" : "todo bajo control",
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor spend-envelope está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "spend-envelope", tools: 6, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[spend-envelope] fatal:", e);
  process.exit(1);
});

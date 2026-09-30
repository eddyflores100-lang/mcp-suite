#!/usr/bin/env node
/**
 * MCP Server: Escrow Agent
 * Custodia de intercambios entre agentes: bloqueo → entrega verificada → liberación (o disputa)
 *
 * Dolor que resuelve: El agente A paga por adelantado a un agente B desconocido y B desaparece; o B entrega primero y A nunca paga. Sin custodia neutral, el primer trato entre agentes es una apuesta ciega.
 * Categoría: Comercio A2A | Generado por mcp-suite | id: escrow-agent
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

// ——— persistencia local: ~/.mcp-suite/escrow-agent/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "escrow-agent");
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

const server = new McpServer({ name: "escrow-agent", version: "1.0.0" });

server.tool(
  "create_escrow",
  "Crea un escrow: quién paga, quién entrega, qué, por cuánto y en qué plazo.",
  {
  pagador: z.string().describe("Id del agente que paga"),
  vendedor: z.string().describe("Id del agente que entrega el bien/servicio"),
  descripcion: z.string().describe("Qué se entrega (bien, dato, servicio)"),
  monto: z.number().describe("Monto comprometido"),
  divisa: z.string().describe("Divisa/asset").default("USD"),
  plazo_horas: z.number().describe("Horas máximas para la entrega").default(48),
  criterio_aceptacion: z.string().describe("Cómo se decide que la entrega es correcta").optional(),
  },
  async (args: any) => {
    const { pagador, vendedor, descripcion, monto, divisa, plazo_horas, criterio_aceptacion } = args as any;
    const st = store.load();
st.escrows = st.escrows || [];
const id = "esc_" + String(st.escrows.length + 1).padStart(4, "0");
st.escrows.push({ id, pagador, vendedor, descripcion, monto, divisa, plazo_horas, criterio_aceptacion: criterio_aceptacion || "aceptación implícita del pagador", estado: "CREADO", historial: [{ estado: "CREADO", ts: new Date().toISOString(), nota: "escrow definido, fondos aún no bloqueados" }], expira: new Date(Date.now() + plazo_horas * 3600000).toISOString() });
store.save(st);
return ok({ id, estado: "CREADO", siguiente: "el pagador bloquea los fondos con lock_funds" });
  }
);

server.tool(
  "lock_funds",
  "El pagador bloquea los fondos: el vendedor ya puede entregar con garantía.",
  {
  id: z.string().describe("Id del escrow"),
  evidencia_bloqueo: z.string().describe("Referencia/evidencia del bloqueo (tx, reserva, retención)"),
  },
  async (args: any) => {
    const { id, evidencia_bloqueo } = args as any;
    const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado: " + id);
if (e.estado !== "CREADO") return fail("estado actual " + e.estado + ": solo se bloquea desde CREADO");
e.estado = "BLOQUEADO";
e.evidencia_bloqueo = evidencia_bloqueo;
e.historial.push({ estado: "BLOQUEADO", ts: new Date().toISOString(), nota: "fondos bloqueados: " + evidencia_bloqueo.slice(0, 80) });
store.save(st);
return ok({ id, estado: "BLOQUEADO", nota: "el vendedor puede entregar: la paga está custodiada", expira: e.expira });
  }
);

server.tool(
  "mark_delivered",
  "El vendedor declara la entrega con evidencia verificable.",
  {
  id: z.string().describe("Id del escrow"),
  evidencia_entrega: z.string().describe("Evidencia de la entrega (URL, hash, resultado, recibo)"),
  },
  async (args: any) => {
    const { id, evidencia_entrega } = args as any;
    const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (e.estado !== "BLOQUEADO") return fail("estado " + e.estado + ": la entrega requiere fondos bloqueados primero");
e.estado = "ENTREGADO";
e.evidencia_entrega = evidencia_entrega;
e.entregado_ts = new Date().toISOString();
e.historial.push({ estado: "ENTREGADO", ts: e.entregado_ts, nota: "entrega declarada: " + evidencia_entrega.slice(0, 80) });
store.save(st);
return ok({ id, estado: "ENTREGADO", siguiente: "el pagador verifica y libera con release (o abre disputa)" });
  }
);

server.tool(
  "release",
  "El pagador libera los fondos al vendedor tras verificar la entrega.",
  {
  id: z.string().describe("Id del escrow"),
  verificado: z.string().describe("Cómo se verificó la aceptación").optional(),
  },
  async (args: any) => {
    const { id, verificado } = args as any;
    const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (e.estado !== "ENTREGADO") return fail("estado " + e.estado + ": solo se libera tras ENTREGADO (o RESUELTO a favor del vendedor)");
e.estado = "LIBERADO";
e.liberado_ts = new Date().toISOString();
e.verificado = verificado || "aceptación implícita";
e.historial.push({ estado: "LIBERADO", ts: e.liberado_ts, nota: "fondos liberados al vendedor (" + e.monto + " " + e.divisa + ")" });
store.save(st);
return ok({ id, estado: "LIBERADO", cerrado: true, resumen: { monto: e.monto, divisa: e.divisa, dias_ciclo: Number(((new Date(e.liberado_ts).getTime() - new Date(e.historial[0].ts).getTime()) / 86400000).toFixed(2)) } });
  }
);

server.tool(
  "open_dispute",
  "Abre disputa sobre un escrow entregado (o expirado): congela la liberación.",
  {
  id: z.string().describe("Id del escrow"),
  motivo: z.string().describe("Motivo de la disputa"),
  por: z.string().describe("Quien abre la disputa (pagador/vendedor)"),
  },
  async (args: any) => {
    const { id, motivo, por } = args as any;
    const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (!["ENTREGADO", "BLOQUEADO"].includes(e.estado)) return fail("estado " + e.estado + ": no es disputable");
e.estado = "EN_DISPUTA";
e.disputa = { motivo, por, abierta: new Date().toISOString(), evidencias: [] };
e.historial.push({ estado: "EN_DISPUTA", ts: new Date().toISOString(), nota: "disputa abierta por " + por + ": " + motivo.slice(0, 100) });
store.save(st);
return ok({ id, estado: "EN_DISPUTA", nota: "fondos congelados hasta resolución: usa add_evidence y luego resolve_dispute" });
  }
);

server.tool(
  "add_evidence",
  "Añade evidencia a una disputa abierta (ambas partes).",
  {
  id: z.string().describe("Id del escrow"),
  parte: z.string().describe("Parte que aporta (pagador/vendedor/tercero)"),
  descripcion: z.string().describe("Qué demuestra la evidencia"),
  peso: z.enum(["debil","media","fuerte"]).describe("Fuerza de la evidencia").default("media"),
  },
  async (args: any) => {
    const { id, parte, descripcion, peso } = args as any;
    const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (e.estado !== "EN_DISPUTA") return fail("sin disputa abierta en estado " + e.estado);
e.disputa.evidencias.push({ parte, descripcion, peso, ts: new Date().toISOString() });
store.save(st);
const resumen = {};
e.disputa.evidencias.forEach(ev => { resumen[ev.parte] = (resumen[ev.parte] || 0) + (ev.peso === "fuerte" ? 3 : ev.peso === "media" ? 2 : 1); });
return ok({ id, evidencias_totales: e.disputa.evidencias.length, peso_por_parte: resumen });
  }
);

server.tool(
  "resolve_dispute",
  "Resuelve la disputa ponderando evidencias: libera, devuelve o reparte.",
  {
  id: z.string().describe("Id del escrow"),
  decision: z.enum(["liberar_vendedor","devolver_pagador","reparto"]).describe("Resolución"),
  nota: z.string().describe("Justificación de la resolución").optional(),
  reparto_pct_vendedor: z.number().describe("Si reparto: % al vendedor (0-100)").default(50),
  },
  async (args: any) => {
    const { id, decision, nota, reparto_pct_vendedor } = args as any;
    const st = store.load();
const e = (st.escrows || []).find(x => x.id === id);
if (!e) return fail("escrow no encontrado");
if (e.estado !== "EN_DISPUTA") return fail("sin disputa abierta");
const pesos = {};
(e.disputa.evidencias || []).forEach(ev => { pesos[ev.parte] = (pesos[ev.parte] || 0) + (ev.peso === "fuerte" ? 3 : ev.peso === "media" ? 2 : 1); });
const pPag = pesos["pagador"] || 0, pVen = pesos["vendedor"] || 0;
const equilibrio = pPag + pVen === 0 ? "sin evidencias: resolución por criterio del árbitro" : pVen > pPag * 1.5 ? "evidencia favorece claramente al vendedor" : pPag > pVen * 1.5 ? "evidencia favorece claramente al pagador" : "evidencia equilibrada";
let montoVendedor = 0, montoPagador = 0;
if (decision === "liberar_vendedor") { montoVendedor = e.monto; e.estado = "LIBERADO"; }
else if (decision === "devolver_pagador") { montoPagador = e.monto; e.estado = "DEVUELTO"; }
else { montoVendedor = Number((e.monto * reparto_pct_vendedor / 100).toFixed(2)); montoPagador = Number((e.monto - montoVendedor).toFixed(2)); e.estado = "REPARTIDO"; }
e.disputa.resolucion = { decision, nota: nota || "", equilibrio_evidencia: equilibrito(pPag, pVen), ts: new Date().toISOString() };
e.historial.push({ estado: e.estado, ts: new Date().toISOString(), nota: "disputa resuelta: " + decision });
store.save(st);
return ok({ id, estado_final: e.estado, reparto: { vendedor: montoVendedor + " " + e.divisa, pagador: montoPagador + " " + e.divisa }, equilibrio_evidencia: equilibrio, aviso: "registra la ejecución real del reparto en tu sistema de pagos" });
function equilibrito(a, b) { if (a + b === 0) return "sin evidencias"; return b > a * 1.5 ? "favor vendedor" : a > b * 1.5 ? "favor pagador" : "equilibrada"; }
  }
);

server.tool(
  "escrow_stats",
  "Métricas del historial: tasa de disputa, tiempo medio de ciclo, montos.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const esc = st.escrows || [];
if (!esc.length) return ok({ escrows: 0, mensaje: "sin historial" });
const disputados = esc.filter(e => e.disputa);
const cerrados = esc.filter(e => ["LIBERADO", "DEVUELTO", "REPARTIDO"].includes(e.estado));
const ciclos = cerrados.map(e => { const fin = e.historial[e.historial.length - 1].ts; return (new Date(fin).getTime() - new Date(e.historial[0].ts).getTime()) / 3600000; });
return ok({ total: esc.length, por_estado: esc.reduce((acc, e) => { acc[e.estado] = (acc[e.estado] || 0) + 1; return acc; }, {}), tasa_disputa: Number((disputados.length / esc.length * 100).toFixed(1)) + "%", ciclo_medio_horas: ciclos.length ? Number((ciclos.reduce((a, b) => a + b, 0) / ciclos.length).toFixed(1)) : null, volumen_total: esc.reduce((a, e) => a + e.monto, 0).toFixed(2) + " (sumas en divisas mixtas si aplica)", aviso: disputados.length / esc.length > 0.2 ? "más del 20% de escrows acaba en disputa: endurece el criterio de aceptación" : "salud razonable" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor escrow-agent está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "escrow-agent", tools: 9, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[escrow-agent] fatal:", e);
  process.exit(1);
});

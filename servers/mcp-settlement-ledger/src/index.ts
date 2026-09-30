#!/usr/bin/env node
/**
 * MCP Server: Settlement Ledger
 * Libro de liquidaciones entre agentes: pagos registrados, conciliación contra factura y saldos por contraparte
 *
 * Dolor que resuelve: El agente pagó, el otro agente dice que no; hay dos facturas por el mismo servicio y nadie concilia nada. Sin libro de liquidaciones con conciliación, la contabilidad entre agentes es una novela.
 * Categoría: Comercio A2A | Generado por mcp-suite | id: settlement-ledger
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

// ——— persistencia local: ~/.mcp-suite/settlement-ledger/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "settlement-ledger");
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

const server = new McpServer({ name: "settlement-ledger", version: "1.0.0" });

server.tool(
  "record_settlement",
  "Registra una liquidación real (pago emitido o recibido) con su referencia.",
  {
  contraparte: z.string().describe("Agente contraparte"),
  direccion: z.enum(["pagado_por_mi","recibido_por_mi"]).describe("Sentido del pago"),
  monto: z.number().describe("Monto liquidado"),
  divisa: z.string().describe("Divisa").default("USD"),
  concepto: z.string().describe("Concepto (qué se liquida)"),
  factura_ref: z.string().describe("Referencia de la factura/charge que cubre").optional(),
  tx_ref: z.string().describe("Referencia de la transacción (hash, id de pago)").optional(),
  },
  async (args: any) => {
    const { contraparte, direccion, monto, divisa, concepto, factura_ref, tx_ref } = args as any;
    const st = store.load();
st.asientos = st.asientos || [];
const id = "liq_" + String(st.asientos.length + 1).padStart(4, "0");
st.asientos.push({ id, contraparte, direccion, monto, divisa, concepto, factura_ref: factura_ref || null, tx_ref: tx_ref || null, conciliado: false, match: null, ts: new Date().toISOString() });
store.save(st);
return ok({ id, contraparte, sentido: direccion, monto, divisa, conciliado: false, siguiente: "concilia con reconcile cuando tengas la factura/registro contrario" });
  }
);

server.tool(
  "reconcile",
  "Concilia liquidaciones contra facturas declaradas: match exacto, parcial o descuadre.",
  {
  facturas: z.array(z.any()).describe("Facturas externas a conciliar {contraparte, factura_ref, monto, direccion_esperada}"),
  },
  async (args: any) => {
    const { facturas } = args as any;
    const st = store.load();
const asientos = st.asientos || [];
if (!asientos.length) return fail("libro vacío: registra liquidaciones primero");
const resultado = [];
(facturas || []).forEach(f => {
  const cand = asientos.filter(a => !a.conciliado && a.contraparte === f.contraparte && (!f.factura_ref || a.factura_ref === f.factura_ref || a.factura_ref === null));
  const exacto = cand.find(a => Math.abs(a.monto - f.monto) < 0.005);
  if (exacto) {
    exacto.conciliado = true;
    exacto.match = { tipo: "EXACTO", factura: f.factura_ref || "(sin ref)", ts: new Date().toISOString() };
    resultado.push({ factura: f.factura_ref || "(sin ref)", contraparte: f.contraparte, estado: "CONCILIADO_EXACTO", asiento: exacto.id, monto: f.monto });
  } else if (cand.length) {
    const parcial = cand.find(a => Math.abs(a.monto - f.monto) < Math.max(f.monto * 0.05, 1));
    if (parcial) {
      parcial.conciliado = true;
      parcial.match = { tipo: "APROXIMADO", diferencia: Number((f.monto - parcial.monto).toFixed(2)), factura: f.factura_ref || "(sin ref)", ts: new Date().toISOString() };
      resultado.push({ factura: f.factura_ref || "(sin ref)", contraparte: f.contraparte, estado: "CONCILIADO_CON_DESVIO", asiento: parcial.id, diferencia: Number((f.monto - parcial.monto).toFixed(2)) });
    } else {
      resultado.push({ factura: f.factura_ref || "(sin ref)", contraparte: f.contraparte, estado: "SIN_MATCH", buscado: f.monto, candidatos: cand.map(a => ({ id: a.id, monto: a.monto, concepto: a.concepto.slice(0, 40) })) });
    }
  } else {
    resultado.push({ factura: f.factura_ref || "(sin ref)", contraparte: f.contraparte, estado: "SIN_ASIENTO_POSIBLE", buscado: f.monto, alerta: "ningún asiento libre de esa contraparte: ¿falta registrar el pago o es una factura fantasma?" });
  }
});
store.save(st);
return ok({ facturas_evaluadas: (facturas || []).length, resumen: { exactos: resultado.filter(r => r.estado === "CONCILIADO_EXACTO").length, con_desvio: resultado.filter(r => r.estado === "CONCILIADO_CON_DESVIO").length, sin_match: resultado.filter(r => r.estado === "SIN_MATCH").length, sin_asiento: resultado.filter(r => r.estado === "SIN_ASIENTO_POSIBLE").length }, detalle: resultado });
  }
);

server.tool(
  "balances",
  "Saldos netos por contraparte: pagado vs recibido vs pendiente de conciliar.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const asientos = st.asientos || [];
if (!asientos.length) return ok({ asientos: 0, mensaje: "libro vacío" });
const por = {};
asientos.forEach(a => {
  por[a.contraparte] = por[a.contraparte] || { contraparte: a.contraparte, pagado: 0, recibido: 0, sin_conciliar: 0, operaciones: 0 };
  por[a.contraparte].operaciones++;
  if (a.direccion === "pagado_por_mi") por[a.contraparte].pagado += a.monto;
  else por[a.contraparte].recibido += a.monto;
  if (!a.conciliado) por[a.contraparte].sin_conciliar += a.monto;
});
return ok({ contrapartes: __vals(por).map(p => ({ ...p, saldo_neto: Number((p.recibido - p.pagado).toFixed(2)) })).sort((a, b) => Math.abs(b.saldo_neto) - Math.abs(a.saldo_neto)), total_operaciones: asientos.length, alerta_descuadre: __vals(por).filter(p => p.sin_conciliar > 0).length + " contrapartes con movimientos sin conciliar" });
  }
);

server.tool(
  "aging_report",
  "Antigüedad de lo no conciliado: qué lleva días esperando match (riesgo de olvido).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const abiertos = (st.asientos || []).filter(a => !a.conciliado);
if (!abiertos.length) return ok({ pendientes: 0, mensaje: "todo conciliado" });
const buckets = { "0-7_dias": 0, "8-30_dias": 0, "31-90_dias": 0, "+90_dias": 0 };
abiertos.forEach(a => {
  const dias = (Date.now() - new Date(a.ts).getTime()) / 86400000;
  if (dias <= 7) buckets["0-7_dias"]++;
  else if (dias <= 30) buckets["8-30_dias"]++;
  else if (dias <= 90) buckets["31-90_dias"]++;
  else buckets["+90_dias"]++;
});
const criticos = abiertos.filter(a => (Date.now() - new Date(a.ts).getTime()) / 86400000 > 90);
return ok({ pendientes: abiertos.length, por_antiguedad: buckets, monto_sin_conciliar: Number(abiertos.reduce((s, a) => s + a.monto, 0).toFixed(2)), criticos_90dias: criticos.map(a => ({ id: a.id, contraparte: a.contraparte, monto: a.monto, concepto: a.concepto.slice(0, 50) })), accion: criticos.length ? " reclama la documentación de los +90 días HOY: caducan pruebas y plazos" : "pendientes frescos" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor settlement-ledger está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "settlement-ledger", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[settlement-ledger] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Metering Station
 * Medición facturable del consumo entre agentes: eventos de uso → agregación → tarifa → borrador de factura
 *
 * Dolor que resuelve: El agente sirve 12.000 llamadas a otros agentes y no tiene NADA que facturar: sin eventos medidos, sin tarifa por tramos, sin borrador de factura, la economía agéntica se queda en 'confía en mí'.
 * Categoría: Comercio A2A | Generado por mcp-suite | id: metering-station
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
// ——— helpers de respuesta ———
function ok(data) {
    return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg) {
    return { content: [{ type: "text", text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o) { return Object.values(o); }
function __ents(o) { return Object.entries(o); }
// ——— persistencia local: ~/.mcp-suite/metering-station/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "metering-station");
const STORE_FILE = join(STORE_DIR, "state.json");
const store = {
    load() {
        try {
            return existsSync(STORE_FILE) ? JSON.parse(readFileSync(STORE_FILE, "utf8")) : {};
        }
        catch {
            return {};
        }
    },
    save(data) {
        mkdirSync(STORE_DIR, { recursive: true });
        writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
        return data;
    },
};
const server = new McpServer({ name: "metering-station", version: "1.0.0" });
server.tool("set_tariff", "Define la tarifa por tramos para un recurso medible.", {
    recurso: z.string().describe("Recurso a tarifar (llamada_api, token_procesado, mb_datos...)"),
    unidad: z.string().describe("Unidad de medida (invocación, token, MB)"),
    tramos: z.array(z.any()).describe("Tramos {hasta: cantidad o 'inf', precio_unitario} en orden"),
    divisa: z.string().describe("Divisa").default("USD"),
    cliente: z.string().describe("Cliente concreto (si la tarifa es privada)").optional(),
}, async (args) => {
    const { recurso, unidad, tramos, divisa, cliente } = args;
    const st = store.load();
    st.tarifas = st.tarifas || {};
    const clave = (cliente ? cliente + "::" : "") + recurso;
    const limpios = (tramos || []).map(t => ({ hasta: t.hasta === "inf" || t.hasta === Infinity ? "inf" : Number(t.hasta), precio_unitario: Number(t.precio_unitario) }));
    if (!limpios.length)
        return fail("sin tramos");
    st.tarifas[clave] = { recurso, unidad, tramos: limpios, divisa, cliente: cliente || null, creado: new Date().toISOString() };
    store.save(st);
    return ok({ tarifa: clave, tramos: limpios.length, unidad, divisa, ejemplo: "100 unidades cuestan " + calcular(limpios, 100).toFixed(4) + " " + divisa });
    function calcular(trs, qty) {
        let restante = qty, costo = 0, anterior = 0;
        for (const t of trs) {
            if (restante <= 0)
                break;
            const cap = t.hasta === "inf" ? Infinity : t.hasta - anterior;
            const enTramo = Math.min(restante, cap);
            costo += enTramo * t.precio_unitario;
            restante -= enTramo;
            anterior = t.hasta === "inf" ? anterior : t.hasta;
        }
        return costo;
    }
});
server.tool("record_usage", "Registra un evento de uso medible.", {
    cliente: z.string().describe("Agente/cliente consumidor"),
    recurso: z.string().describe("Recurso consumido"),
    cantidad: z.number().describe("Cantidad consumida en la unidad del recurso"),
    operacion: z.string().describe("Operación concreta").optional(),
    ref: z.string().describe("Referencia externa (request id)").optional(),
}, async (args) => {
    const { cliente, recurso, cantidad, operacion, ref } = args;
    const st = store.load();
    st.eventos = st.eventos || [];
    st.eventos.push({ cliente, recurso, cantidad, operacion: operacion || "", ref: ref || "", ts: new Date().toISOString() });
    store.save(st);
    return ok({ registrado: true, eventos_totales: st.eventos.length, cliente, recurso });
});
server.tool("aggregate", "Agrega el consumo por cliente y recurso para un período, con tarifa aplicada.", {
    dias: z.number().describe("Ventana hacia atrás en días").default(30),
    cliente: z.string().describe("Filtrar por cliente").optional(),
}, async (args) => {
    const { dias, cliente } = args;
    const st = store.load();
    const desde = Date.now() - dias * 86400000;
    let eventos = (st.eventos || []).filter(e => new Date(e.ts).getTime() >= desde);
    if (cliente)
        eventos = eventos.filter(e => e.cliente === cliente);
    if (!eventos.length)
        return fail("sin eventos en los últimos " + dias + " días");
    const porClave = {};
    eventos.forEach(e => {
        const k = e.cliente + "::" + e.recurso;
        porClave[k] = porClave[k] || { cliente: e.cliente, recurso: e.recurso, cantidad: 0, eventos: 0 };
        porClave[k].cantidad += e.cantidad;
        porClave[k].eventos++;
    });
    function calcular(trs, qty) {
        let restante = qty, costo = 0, anterior = 0;
        for (const t of trs) {
            if (restante <= 0)
                break;
            const cap = t.hasta === "inf" ? Infinity : t.hasta - anterior;
            const enTramo = Math.min(restante, cap);
            costo += enTramo * t.precio_unitario;
            restante -= enTramo;
            anterior = t.hasta === "inf" ? anterior : t.hasta;
        }
        return costo;
    }
    const lineas = __vals(porClave).map(l => {
        const tarifa = (st.tarifas || {})[l.cliente + "::" + l.recurso] || (st.tarifas || {})[l.recurso];
        const costo = tarifa ? calcular(tarifa.tramos, l.cantidad) : null;
        return { ...l, tarifa_aplicada: tarifa ? (tarifa.cliente ? "privada" : "estándar") : "SIN TARIFA", divisa: tarifa ? tarifa.divisa : null, costo: costo !== null ? Number(costo.toFixed(4)) : null };
    });
    const conCosto = lineas.filter(l => l.costo !== null);
    return ok({ periodo_dias: dias, eventos_agregados: eventos.length, lineas, total_periodo: conCosto.length ? Number(conCosto.reduce((a, l) => a + l.costo, 0).toFixed(2)) : null, sin_tarifa: lineas.filter(l => l.costo === null).map(l => l.cliente + "::" + l.recurso) });
});
server.tool("detect_anomalies", "Detecta consumos anómalos: picos por cliente/recurso frente a su propia historia.", {
    dias: z.number().describe("Ventana de análisis").default(7),
}, async (args) => {
    const { dias } = args;
    const st = store.load();
    const eventos = st.eventos || [];
    if (eventos.length < 10)
        return ok({ eventos: eventos.length, mensaje: "datos insuficientes para anomalías" });
    const hace = Date.now() - dias * 86400000;
    const recientes = eventos.filter(e => new Date(e.ts).getTime() >= hace);
    const antiguos = eventos.filter(e => new Date(e.ts).getTime() < hace);
    const porClave = (lista) => { const m = {}; lista.forEach(e => { const k = e.cliente + "::" + e.recurso; m[k] = (m[k] || 0) + e.cantidad; }); return m; };
    const rec = porClave(recientes), ant = porClave(antiguos);
    const anomalies = [];
    __ents(rec).forEach(([k, qty]) => {
        const prev = ant[k];
        if (prev !== undefined && prev > 0 && qty > prev * 3)
            anomalies.push({ clave: k, antes_periodo: prev, ahora: qty, factor: Number((qty / prev).toFixed(1)) + "x", tipo: "pico_vs_historia" });
        if (prev === undefined && qty > 1000)
            anomalies.push({ clave: k, antes_periodo: 0, ahora: qty, tipo: "cliente_recurso_nuevo_con_volumen_alto" });
    });
    return ok({ ventana_dias: dias, clientes_recursos_monitorizados: Object.keys(rec).length, anomalias: anomalies, aviso: anomalies.length ? "revisa los picos: posible bucle de agente o abuso de tarifa" : "sin anomalías de consumo" });
});
server.tool("health_check", "Verifica que el servidor metering-station está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "metering-station", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[metering-station] fatal:", e);
    process.exit(1);
});

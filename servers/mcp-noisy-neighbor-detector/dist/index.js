#!/usr/bin/env node
/**
 * MCP Server: Noisy Neighbor Detector
 * Detecta al inquilino ruidoso: quién consume más de lo justo y degrada la experiencia de los demás
 *
 * Dolor que resuelve: Todos los tenants ven 'el agente va lento' pero nadie ve quién lo causa: sin medición de consumo relativo por inquilino, el vecino ruidoso es invisible y la degradación se achaca al sistema.
 * Categoría: Multi-Tenant | Generado por mcp-suite | id: noisy-neighbor-detector
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
// ——— persistencia local: ~/.mcp-suite/noisy-neighbor-detector/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "noisy-neighbor-detector");
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
const server = new McpServer({ name: "noisy-neighbor-detector", version: "1.0.0" });
server.tool("record_usage_event", "Registra un evento de uso con su coste para atribución por tenant.", {
    tenant: z.string().describe("Tenant"),
    tokens: z.number().describe("Tokens consumidos").default(0),
    latencia_ms: z.number().describe("Latencia añadida al sistema").default(0),
    operacion: z.string().describe("Operación").optional(),
}, async (args) => {
    const { tenant, tokens, latencia_ms, operacion } = args;
    const st = store.load();
    st.eventos = st.eventos || [];
    st.eventos.push({ tenant, tokens, latencia_ms, operacion: operacion || "", ts: new Date().toISOString() });
    if (st.eventos.length > 5000)
        st.eventos = st.eventos.slice(-4000);
    store.save(st);
    return ok({ registrado: true, eventos: st.eventos.length });
});
server.tool("analyze_fairness", "Índice de equidad del consumo (Gini) y ranking de contribución al coste total.", {
    ventana_minutos: z.number().describe("Ventana de análisis").default(60),
}, async (args) => {
    const { ventana_minutos } = args;
    const st = store.load();
    const desde = Date.now() - ventana_minutos * 60000;
    const eventos = (st.eventos || []).filter(e => new Date(e.ts).getTime() >= desde);
    if (eventos.length < 10)
        return ok({ eventos: eventos.length, mensaje: "datos insuficientes en la ventana" });
    const peso = {};
    eventos.forEach(e => { peso[e.tenant] = (peso[e.tenant] || 0) + e.tokens + e.latencia_ms / 100; });
    const tenants = __vals(peso);
    const total = tenants.reduce((a, b) => a + b, 0) || 1;
    const ordenados = tenants.slice().sort((a, b) => a - b);
    const n = ordenados.length;
    let acumulado = 0;
    ordenados.forEach(v => { acumulado += v; });
    let gini = 0;
    ordenados.forEach((v, i) => { gini += (2 * (i + 1) - n - 1) * v; });
    gini = gini / (n * acumulado);
    const porTenant = {};
    __ents(peso).forEach(([t, v]) => { porTenant[t] = { peso: v, share: Number((v / total * 100).toFixed(1)) + "%" }; });
    return ok({ ventana_minutos, eventos: eventos.length, tenants: n, indice_gini: Number(gini.toFixed(3)), equidad: gini < 0.3 ? "equitativa" : gini < 0.6 ? "concentrada" : "ALTAMENTE DESIGUAL: un tenant domina el consumo", consumo_por_tenant: porTenant, top_consumidor: Object.keys(porTenant).sort((a, b) => peso[b] - peso[a])[0] });
});
server.tool("flag_noisy", "Marca a los tenants ruidosos: consumo desproporcionado frente a su cuota o frente a la mediana.", {
    umbral_x_mediana: z.number().describe("Veces la mediana para ser ruidoso").default(3),
}, async (args) => {
    const { umbral_x_mediana } = args;
    const st = store.load();
    const eventos = st.eventos || [];
    if (eventos.length < 20)
        return ok({ eventos: eventos.length, mensaje: "insuficiente histórico" });
    const peso = {};
    eventos.forEach(e => { peso[e.tenant] = (peso[e.tenant] || 0) + e.tokens + e.latencia_ms / 100; });
    const ruidosos = __ents(peso).map(([t, v]) => {
        const otros = __vals(peso).filter(x => x !== v).sort((a, b) => a - b);
        const medianaOtros = otros.length ? otros[Math.floor(otros.length / 2)] : v;
        return { tenant: t, peso: v, mediana_de_los_demas: medianaOtros, vs_mediana: Number((v / Math.max(medianaOtros, 1)).toFixed(1)) + "x", eventos: eventos.filter(e => e.tenant === t).length, ruidoso: v > medianaOtros * umbral_x_mediana };
    }).filter(x => x.ruidoso);
    const latenciaAportada = {};
    eventos.forEach(e => { latenciaAportada[e.tenant] = (latenciaAportada[e.tenant] || 0) + e.latencia_ms; });
    return ok({ umbral: umbral_x_mediana + "x la mediana de los demás", ruidosos, aportacion_latencia_ms: __ents(latenciaAportada).map(([t, v]) => ({ tenant: t, latencia_total_ms: Math.round(v) })).sort((a, b) => b.latencia_total_ms - a.latencia_total_ms).slice(0, 5), accion: ruidosos.length ? "aplica throttle al tenant marcado o revisa su patrón (¿bucle?, ¿tareas redundantes?)" : "sin vecinos ruidosos" });
});
server.tool("health_check", "Verifica que el servidor noisy-neighbor-detector está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "noisy-neighbor-detector", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[noisy-neighbor-detector] fatal:", e);
    process.exit(1);
});

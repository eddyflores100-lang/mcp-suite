#!/usr/bin/env node
/**
 * MCP Server: Behavior Diff
 * Diff de conducta: cómo cambió el uso de tools y patrones del agente entre dos períodos, con anomalías señaladas
 *
 * Dolor que resuelve: Algo cambió en el agente: es más lento, usa otra tool, repite llamadas... pero como no hay diff de comportamiento, el cambio es una sospecha difusa hasta que rompe algo.
 * Categoría: Auto-Mejora | Generado por mcp-suite | id: behavior-diff
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
// ——— persistencia local: ~/.mcp-suite/behavior-diff/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "behavior-diff");
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
const server = new McpServer({ name: "behavior-diff", version: "1.0.0" });
server.tool("record_behavior", "Registra el snapshot de comportamiento de un período (uso de tools y métricas).", {
    periodo: z.string().describe("Etiqueta del período (ej: semana-37)"),
    uso_tools: z.any().describe("Veces por tool {tool: veces}"),
    latencia_media_ms: z.number().describe("Latencia media del período").optional(),
    errores: z.number().describe("Errores del período").default(0),
}, async (args) => {
    const { periodo, uso_tools, latencia_media_ms, errores } = args;
    const st = store.load();
    st.periodos = st.periodos || {};
    if (st.periodos[periodo])
        return fail("período ya registrado: " + periodo);
    const uso = {};
    Object.keys(uso_tools || {}).forEach(k => { const v = uso_tools[k]; if (typeof v === "number" && v >= 0)
        uso[k] = v; });
    if (!Object.keys(uso).length)
        return fail("sin uso de tools registrado");
    st.periodos[periodo] = { periodo, uso_tools: uso, latencia_media_ms: latencia_media_ms ?? null, errores, registrado: new Date().toISOString() };
    store.save(st);
    return ok({ periodo, tools_usadas: Object.keys(uso).length, llamadas_totales: __vals(uso).reduce((a, b) => a + b, 0), siguiente: "con 2+ períodos, compara con diff_periods" });
});
server.tool("diff_periods", "Compara dos períodos: tools nuevas, abandonadas y cambios de proporción.", {
    periodo_a: z.string().describe("Período base"),
    periodo_b: z.string().describe("Período a comparar"),
}, async (args) => {
    const { periodo_a, periodo_b } = args;
    const st = store.load();
    const a = (st.periodos || {})[periodo_a];
    const b = (st.periodos || {})[periodo_b];
    if (!a)
        return fail("período no registrado: " + periodo_a);
    if (!b)
        return fail("período no registrado: " + periodo_b);
    const totalA = __vals(a.uso_tools).reduce((x, y) => x + y, 0) || 1;
    const totalB = __vals(b.uso_tools).reduce((x, y) => x + y, 0) || 1;
    const todas = [...new Set([...Object.keys(a.uso_tools), ...Object.keys(b.uso_tools)])];
    const cambios = todas.map(t => {
        const va = a.uso_tools[t] || 0, vb = b.uso_tools[t] || 0;
        const pa = va / totalA, pb = vb / totalB;
        return { tool: t, antes: va, ahora: vb, share_antes: Number((pa * 100).toFixed(1)) + "%", share_ahora: Number((pb * 100).toFixed(1)) + "%", delta_share: Number(((pb - pa) * 100).toFixed(1)) + "pp", estado: va === 0 && vb > 0 ? "NUEVA" : vb === 0 && va > 0 ? "ABANDONADA" : Math.abs(pb - pa) > 0.08 ? "CAMBIO FUERTE" : "estable" };
    }).sort((x, y) => Math.abs(parseFloat(y.delta_share)) - Math.abs(parseFloat(x.delta_share)));
    const latencia = a.latencia_media_ms && b.latencia_media_ms ? { antes: Math.round(a.latencia_media_ms) + "ms", ahora: Math.round(b.latencia_media_ms) + "ms", delta: Number((((b.latencia_media_ms - a.latencia_media_ms) / a.latencia_media_ms) * 100).toFixed(0)) + "%" } : null;
    return ok({ comparacion: periodo_a + " -> " + periodo_b, llamadas: { antes: totalA, ahora: totalB }, cambios, latencia, errores: { antes: a.errores, ahora: b.errores }, anomalias: cambios.filter(c => c.estado === "NUEVA" || c.estado === "ABANDONADA" || c.estado === "CAMBIO FUERTE").map(c => c.tool + ": " + c.estado), aviso: cambios.some(c => c.estado === "ABANDONADA") ? "hay tools ABANDONADAS: ¿la ruta mejor o se rompió el acceso? Distínguelo antes de celebrar" : null });
});
server.tool("trend_report", "Tendencia a lo largo de todos los períodos registrados.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const periodos = __vals(st.periodos || {});
    if (periodos.length < 3)
        return ok({ periodos: periodos.length, mensaje: "con menos de 3 períodos no hay tendencia" });
    const ordenados = periodos.sort((a, b) => a.periodo.localeCompare(b.periodo));
    const series = {};
    ordenados.forEach(p => { Object.keys(p.uso_tools).forEach(t => { series[t] = series[t] || []; series[t].push(p.uso_tools[t]); }); });
    const herramientas = Object.keys(series).map(t => {
        const s = series[t];
        const primera = s.slice(0, Math.ceil(s.length / 2));
        const segunda = s.slice(Math.floor(s.length / 2));
        const media1 = primera.reduce((a, b) => a + b, 0) / Math.max(primera.length, 1);
        const media2 = segunda.reduce((a, b) => a + b, 0) / Math.max(segunda.length, 1);
        const tendencia = media2 > media1 * 1.3 ? "AL ALZA" : media2 < media1 * 0.7 ? "A LA BAJA" : "estable";
        return { tool: t, serie: s, tendencia };
    }).sort((a, b) => b.serie.reduce((x, y) => x + y, 0) - a.serie.reduce((x, y) => x + y, 0));
    const latencias = ordenados.filter(p => p.latencia_media_ms).map(p => p.periodo + ": " + Math.round(p.latencia_media_ms) + "ms");
    return ok({ periodos: ordenados.map(p => p.periodo), tools_en_tendencia: herramientas.slice(0, 10), latencia_por_periodo: latencias, foco: herramientas.filter(h => h.tendencia === "AL ALZA" && h.serie.reduce((a, b) => a + b, 0) > 20).map(h => h.tool + " crece: ¿por diseño o por bucle?") });
});
server.tool("health_check", "Verifica que el servidor behavior-diff está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "behavior-diff", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[behavior-diff] fatal:", e);
    process.exit(1);
});

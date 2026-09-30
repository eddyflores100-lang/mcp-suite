#!/usr/bin/env node
/**
 * MCP Server: Task ROI
 * ROI por tarea: valor generado vs costo en tokens/dinero/tiempo — qué trabajo vale la pena
 *
 * Dolor que resuelve: El agente no sabe cuánto cuesta su trabajo ni cuánto vale: optimiza completar tareas, no el retorno de completarlas. Tareas de bajo valor consumen el mismo presupuesto que las críticas.
 * Categoría: Economía del Agente | Generado por mcp-suite | id: task-roi
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
// ——— persistencia local: ~/.mcp-suite/task-roi/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "task-roi");
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
const server = new McpServer({ name: "task-roi", version: "1.0.0" });
server.tool("log_task", "Registra una tarea completada: valor estimado, costo en USD, tokens y minutos.", {
    tarea: z.string().describe("Descripción de la tarea"),
    valor_usd: z.number().describe("Valor estimado generado (USD)"),
    costo_usd: z.number().describe("Costo total (USD)"),
    tokens: z.number().describe("Tokens consumidos").optional(),
    minutos: z.number().describe("Tiempo invertido").optional(),
    categoria: z.string().describe("Categoría del trabajo").default("general"),
}, async (args) => {
    const { tarea, valor_usd, costo_usd, tokens, minutos, categoria } = args;
    const st = store.load();
    st.tareas = st.tareas || [];
    st.tareas.push({ tarea, valor_usd, costo_usd, tokens: tokens || null, minutos: minutos || null, categoria, ts: new Date().toISOString() });
    store.save(st);
    return ok({ registrada: true, roi: Number((valor_usd / Math.max(costo_usd, 0.0001)).toFixed(2)) + "x" });
});
server.tool("roi_report", "Reporte ROI global y por categoría: retorno medio, tareas de valor negativo y mejor/peor inversión.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ts = st.tareas || [];
    if (!ts.length)
        return ok({ tareas: 0, sugerencia: "registra tareas con log_task" });
    const porCat = {};
    for (const t of ts) {
        porCat[t.categoria] = porCat[t.categoria] || { n: 0, valor: 0, costo: 0 };
        porCat[t.categoria].n++;
        porCat[t.categoria].valor += t.valor_usd;
        porCat[t.categoria].costo += t.costo_usd;
    }
    const valorTotal = ts.reduce((s, t) => s + t.valor_usd, 0);
    const costoTotal = ts.reduce((s, t) => s + t.costo_usd, 0);
    const negativas = ts.filter(t => t.valor_usd < t.costo_usd);
    return ok({
        tareas: ts.length,
        global: { valor: Number(valorTotal.toFixed(2)), costo: Number(costoTotal.toFixed(2)), roi: Number((valorTotal / Math.max(costoTotal, 0.0001)).toFixed(2)) + "x" },
        por_categoria: __ents(porCat).map(([cat, v]) => ({ categoria: cat, tareas: v.n, roi: Number((v.valor / Math.max(v.costo, 0.0001)).toFixed(2)) + "x", costo_medio: Number((v.costo / v.n).toFixed(3)) })).sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi)),
        tareas_valor_negativo: negativas.length,
        peores: negativas.sort((a, b) => (a.valor_usd - a.costo_usd) - (b.valor_usd - b.costo_usd)).slice(0, 5).map(t => ({ tarea: t.tarea.slice(0, 60), valor: t.valor_usd, costo: t.costo_usd, delta: Number((t.valor_usd - t.costo_usd).toFixed(3)) })),
        consejo: negativas.length > ts.length * 0.3 ? "más del 30% de tareas destruye valor: sube el umbral de qué tareas aceptas" : "cartera sana",
    });
});
server.tool("prioritize", "Prioriza trabajo pendiente por valor/costo (ROI esperado) con desempate por urgencia.", {
    pendientes: z.array(z.any()).describe("Tareas {tarea, valor_usd, costo_usd, urgencia}"),
}, async (args) => {
    const { pendientes } = args;
    const items = (pendientes || []).filter(t => t && t.tarea);
    if (!items.length)
        return fail("lista vacía");
    const rankeadas = items.map(t => {
        const costo = Math.max(Number(t.costo_usd) || 0.01, 0.01);
        const valor = Number(t.valor_usd) || 0;
        const urgencia = Number(t.urgencia) || 3;
        const roi = valor / costo;
        const score = roi * (1 + (5 - urgencia) * 0.15);
        return { tarea: t.tarea, valor: valor, costo: costo, roi_esperado: Number(roi.toFixed(2)), urgencia, score: Number(score.toFixed(2)) };
    }).sort((a, b) => b.score - a.score);
    return ok({
        orden_recomendado: rankeadas.map((r, i) => ({ prioridad: i + 1, tarea: r.tarea, roi: r.roi_esperado + "x", score: r.score })),
        criterio: "score = ROI x factor urgencia (urgencia 1=alta multiplica x1.6)",
        descarta: rankeadas.filter(r => r.roi_esperado < 1).map(r => ({ tarea: r.tarea, razon: "ROI esperado < 1x: destruye valor" })),
    });
});
server.tool("cost_per_output", "Costo por unidad de salida (documento, análisis, línea de código): métrica de eficiencia comparativa.", {
    tareas: z.array(z.any()).describe("Tareas {tarea, costo_usd, unidades}"),
}, async (args) => {
    const { tareas } = args;
    const items = (tareas || []).filter(t => t && t.tarea && t.costo_usd && t.unidades);
    if (!items.length)
        return fail("necesitas tareas con costo_usd y unidades");
    const filas = items.map(t => ({ tarea: t.tarea, costo: Number(t.costo_usd), unidades: Number(t.unidades), costo_por_unidad: Number((t.costo_usd / t.unidades).toFixed(4)) }));
    const media = filas.reduce((s, f) => s + f.costo_por_unidad, 0) / filas.length;
    return ok({
        costo_medio_por_unidad: Number(media.toFixed(4)),
        filas: filas.sort((a, b) => a.costo_por_unidad - b.costo_por_unidad),
        outliers_caros: filas.filter(f => f.costo_por_unidad > media * 2).map(f => f.tarea),
        benchmark: "compara contra la media interna: >2x la media es outlier que merece autopsia",
    });
});
server.tool("health_check", "Verifica que el servidor task-roi está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "task-roi", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[task-roi] fatal:", e);
    process.exit(1);
});

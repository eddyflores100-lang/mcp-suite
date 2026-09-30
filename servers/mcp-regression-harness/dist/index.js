#!/usr/bin/env node
/**
 * MCP Server: Regression Harness
 * Regresión de comportamiento del agente: compara respuestas actuales vs históricas tras cualquier cambio
 *
 * Dolor que resuelve: Cambias el system prompt 'inofensivamente' y el agente empieza a fallar de formas nuevas. Sin battery de regresión de comportamiento, el daño aparece días después cuando nadie relaciona el cambio con el fallo.
 * Categoría: Evaluación Continua | Generado por mcp-suite | id: regression-harness
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
// ——— persistencia local: ~/.mcp-suite/regression-harness/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "regression-harness");
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
const server = new McpServer({ name: "regression-harness", version: "1.0.0" });
server.tool("set_probes", "Define las probes fijas (preguntas de sondeo) que se lanzarán en cada run para comparar comportamiento.", {
    probes: z.array(z.any()).describe("Lista de entradas de sondeo"),
}, async (args) => {
    const { probes } = args;
    const st = store.load();
    const lista = (probes || []).map(String).filter(Boolean);
    if (lista.length < 3)
        return fail("mínimo 3 probes para que la comparación sea significativa");
    st.probes = lista;
    store.save(st);
    return ok({ probes_fijadas: lista.length });
});
server.tool("record_run", "Registra un run: qué cambio se aplicó (prompt/modelo/tool) y las respuestas a las probes (mismo orden).", {
    cambio: z.string().describe("Descripción del cambio aplicado"),
    respuestas: z.array(z.any()).describe("Respuestas a las probes en orden"),
    marcar_baseline: z.boolean().describe("Establecer este run como baseline").default(false),
}, async (args) => {
    const { cambio, respuestas, marcar_baseline } = args;
    const st = store.load();
    if (!st.probes)
        return fail("define las probes con set_probes primero");
    const resp = respuestas || [];
    if (resp.length !== st.probes.length)
        return fail("esperaba " + st.probes.length + " respuestas (una por probe), recibí " + resp.length);
    st.runs = st.runs || [];
    const run = { n: st.runs.length + 1, cambio, respuestas: resp.map(String), ts: new Date().toISOString() };
    if (marcar_baseline || st.runs.length === 0)
        st.baseline = run.n;
    st.runs.push(run);
    store.save(st);
    return ok({ run: run.n, cambio, baseline: st.baseline });
});
server.tool("compare_to_baseline", "Compara el último run contra el baseline: diffs por probe (semántico, longitud, formato) y score de regresión.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    if (!st.runs?.length || !st.baseline)
        return fail("sin runs o sin baseline");
    const base = st.runs.find(r => r.n === st.baseline);
    const actual = st.runs[st.runs.length - 1];
    if (base.n === actual.n)
        return fail("el último run ES el baseline: registra otro run tras un cambio");
    const norm = (x) => new Set(String(x).toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const diffs = st.probes.map((p, i) => {
        const a = base.respuestas[i], b = actual.respuestas[i];
        const sa = norm(a), sb = norm(b);
        const inter = [...sa].filter(w => sb.has(w)).length;
        const union = new Set([...sa, ...sb]).size || 1;
        const jaccard = inter / union;
        const lenDelta = b.length - a.length;
        const fmtA = (a.match(/```|\n\d+\.|\n- /g) || []).length;
        const fmtB = (b.match(/```|\n\d+\.|\n- /g) || []).length;
        return {
            probe: p.slice(0, 60),
            similitud: Number(jaccard.toFixed(2)),
            cambio_longitud_pct: a.length ? Number((lenDelta / a.length * 100).toFixed(0)) : null,
            cambio_formato: fmtA !== fmtB,
            estable: jaccard >= 0.6 && Math.abs(lenDelta / (a.length || 1)) < 0.4 && fmtA === fmtB,
        };
    });
    const estables = diffs.filter(d => d.estable).length;
    const pct = Math.round(estables / diffs.length * 100);
    st.ultimoComparacion = { run: actual.n, contra: base.n, pct, ts: new Date().toISOString() };
    store.save(st);
    return ok({
        comparado: "run " + actual.n + " (" + actual.cambio.slice(0, 50) + ") vs baseline " + base.n,
        estables: estables + "/" + diffs.length,
        score_estabilidad: pct + "%",
        diffs_inestables: diffs.filter(d => !d.estable),
        veredicto: pct >= 80 ? "comportamiento estable tras el cambio" : "REGRESIÓN DE COMPORTAMIENTO: el cambio alteró respuestas, evalúa si es intencional",
    });
});
server.tool("regression_history", "Historial de cambios vs estabilidad: qué cambio rompió qué (auditoría causa-efecto).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    if (!st.runs?.length)
        return ok({ runs: 0 });
    return ok({
        baseline: st.baseline,
        runs: st.runs.map(r => ({ n: r.n, cambio: r.cambio.slice(0, 80), ts: r.ts, es_baseline: r.n === st.baseline })),
        ultima_comparacion: st.ultimoComparacion || "sin comparar aún",
    });
});
server.tool("rebaseline", "Re-baselinea a un run concreto (el nuevo comportamiento aprobado pasa a ser la referencia).", {
    run_n: z.number().describe("Número de run que pasa a ser baseline"),
    motivo: z.string().describe("Por qué se aprueba el nuevo comportamiento"),
}, async (args) => {
    const { run_n, motivo } = args;
    const st = store.load();
    const r = (st.runs || []).find(x => x.n === run_n);
    if (!r)
        return fail("run inexistente");
    if (!motivo)
        return fail("documenta por qué apruebas el nuevo comportamiento");
    st.baseline = run_n;
    st.rebaselines = st.rebaselines || [];
    st.rebaselines.push({ hacia: run_n, motivo, ts: new Date().toISOString() });
    store.save(st);
    return ok({ baseline: run_n, motivo, total_rebaselines: st.rebaselines.length });
});
server.tool("health_check", "Verifica que el servidor regression-harness está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "regression-harness", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[regression-harness] fatal:", e);
    process.exit(1);
});

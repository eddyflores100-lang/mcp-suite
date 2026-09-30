#!/usr/bin/env node
/**
 * MCP Server: Golden Set
 * Conjuntos de casos dorados con scoring: el estándar contra el que se mide cada cambio del agente
 *
 * Dolor que resuelve: Cada cambio (prompt, modelo, tool) se valida 'a ojo' con 2-3 ejemplos que salieron bien: no hay golden set con expected outputs, así que las regresiones se detectan en producción.
 * Categoría: Evaluación Continua | Generado por mcp-suite | id: golden-set
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
// ——— persistencia local: ~/.mcp-suite/golden-set/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "golden-set");
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
const server = new McpServer({ name: "golden-set", version: "1.0.0" });
server.tool("create_suite", "Crea una suite de evaluación con nombre y descripción del criterio global de calidad.", {
    nombre: z.string().describe("Nombre de la suite"),
    descripcion: z.string().describe("Qué mide esta suite"),
}, async (args) => {
    const { nombre, descripcion } = args;
    const st = store.load();
    st.suites = st.suites || {};
    if (st.suites[nombre])
        return fail("suite existente: usa add_case o elimínala");
    st.suites[nombre] = { nombre, descripcion, casos: [], corridas: [], creada: new Date().toISOString() };
    store.save(st);
    return ok({ suite: nombre, vacia: true, siguiente: "añade casos con add_case" });
});
server.tool("add_case", "Añade un caso dorado: input, salida esperada, método de match y categoría.", {
    suite: z.string().describe("Nombre de la suite"),
    input: z.string().describe("Entrada del caso"),
    expected: z.string().describe("Salida esperada (dorado)"),
    metodo: z.enum(["exacto", "contiene", "semantico", "numerico"]).describe("Método de match").default("contiene"),
    categoria: z.string().describe("Categoría (ej: edge-case, happy-path)").default("general"),
    tolerancia: z.number().describe("Solo numerico: tolerancia +/-").default(0.01),
}, async (args) => {
    const { suite, input, expected, metodo, categoria, tolerancia } = args;
    const st = store.load();
    const s = (st.suites || {})[suite];
    if (!s)
        return fail("suite no encontrada: créala con create_suite");
    s.casos.push({ n: s.casos.length + 1, input, expected, metodo, categoria, tolerancia: tolerancia ?? 0.01 });
    store.save(st);
    return ok({ suite, caso_n: s.casos.length, metodo, categoria });
});
server.tool("run_suite", "Corre la suite contra las salidas actuales del agente (lista de outputs en el mismo orden) y puntúa.", {
    suite: z.string().describe("Nombre de la suite"),
    outputs: z.array(z.any()).describe("Salidas obtenidas (mismo orden que los casos)"),
}, async (args) => {
    const { suite, outputs } = args;
    const st = store.load();
    const s = (st.suites || {})[suite];
    if (!s)
        return fail("suite no encontrada");
    if (!s.casos.length)
        return fail("suite vacía: añade casos primero");
    const outs = outputs || [];
    if (outs.length !== s.casos.length)
        return fail("esperaba " + s.casos.length + " outputs, recibí " + outs.length);
    const norm = (x) => new Set(String(x).toLowerCase().split(/\W+/).filter(w => w.length > 3));
    function score(caso, out) {
        const obtenido = String(out ?? "");
        const esperado = String(caso.expected);
        switch (caso.metodo) {
            case "exacto": return obtenido.trim() === esperado.trim() ? 1 : 0;
            case "contiene": return obtenido.toLowerCase().includes(esperado.toLowerCase().trim()) ? 1 : 0;
            case "numerico": {
                const a = parseFloat(obtenido.replace(/[^0-9.\-]/g, ""));
                const b = parseFloat(esperado.replace(/[^0-9.\-]/g, ""));
                if (isNaN(a) || isNaN(b))
                    return 0;
                return Math.abs(a - b) <= (caso.tolerancia ?? 0.01) * Math.max(1, Math.abs(b)) ? 1 : 0;
            }
            case "semantico":
            default: {
                const eo = norm(esperado), go = norm(obtenido);
                if (!eo.size)
                    return 0;
                const inter = [...eo].filter(w => go.has(w)).length;
                return inter / eo.size >= 0.6 ? 1 : 0;
            }
        }
    }
    const resultados = s.casos.map((c, i) => ({ n: c.n, categoria: c.categoria, metodo: c.metodo, pasa: !!score(c, outs[i]) }));
    const pasan = resultados.filter(r => r.pasa).length;
    const pct = Math.round(pasan / resultados.length * 100);
    const porCategoria = {};
    for (const r of resultados) {
        porCategoria[r.categoria] = porCategoria[r.categoria] || { total: 0, pasa: 0 };
        porCategoria[r.categoria].total++;
        if (r.pasa)
            porCategoria[r.categoria].pasa++;
    }
    s.corridas.push({ pct, pasan, total: resultados.length, ts: new Date().toISOString(), fallos: resultados.filter(r => !r.pasa).map(r => r.n) });
    if (s.corridas.length > 50)
        s.corridas = s.corridas.slice(-30);
    store.save(st);
    return ok({
        suite, score: pct + "%", pasan: pasan + "/" + resultados.length,
        por_categoria: Object.fromEntries(__ents(porCategoria).map(([k, v]) => [k, v.pasa + "/" + v.total])),
        fallos: resultados.filter(r => !r.pasa).map(r => ({ n: r.n, categoria: r.categoria, input: s.casos[r.n - 1].input.slice(0, 60) })),
        veredicto: pct === 100 ? "verde: sin regresiones" : pct >= 80 ? "amarillo: vigila las categorías débiles" : "ROJA: hubo regresión significativa, revierte el cambio",
    });
});
server.tool("suite_history", "Historial de corridas de una suite: tendencia del score y detección de regresión entre corridas.", {
    suite: z.string().describe("Nombre de la suite"),
}, async (args) => {
    const { suite } = args;
    const st = store.load();
    const s = (st.suites || {})[suite];
    if (!s)
        return fail("suite no encontrada");
    const cs = s.corridas || [];
    if (!cs.length)
        return ok({ corridas: 0 });
    let regresion = null;
    for (let i = 1; i < cs.length; i++)
        if (cs[i].pct < cs[i - 1].pct - 10) {
            regresion = { desde: cs[i - 1].pct, hasta: cs[i].pct, ts: cs[i].ts };
            break;
        }
    return ok({
        corridas: cs.length,
        score_actual: cs[cs.length - 1].pct,
        mejor_historico: Math.max(...cs.map(c => c.pct)),
        tendencia: cs.length >= 3 ? (cs[cs.length - 1].pct - cs[0].pct > 0 ? "mejorando" : cs[cs.length - 1].pct - cs[0].pct < 0 ? "empeorando" : "estable") : "insuficiente",
        primera_regresion_detectada: regresion,
        ultimas: cs.slice(-8).map(c => ({ ts: c.ts, pct: c.pct, fallos: c.fallos.length })),
    });
});
server.tool("list_suites", "Lista todas las suites con su estado (casos, última corrida, score).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const suites = __vals(st.suites || {});
    if (!suites.length)
        return ok({ suites: 0, sugerencia: "crea una suite con create_suite" });
    return ok({
        suites: suites.map(s => ({ nombre: s.nombre, descripcion: s.descripcion.slice(0, 70), casos: s.casos.length, corridas: (s.corridas || []).length, ultimo_score: s.corridas?.at(-1)?.pct ?? null })),
    });
});
server.tool("export_cases", "Exporta los casos de una suite (input/expected) para compartir o versionar el golden set.", {
    suite: z.string().describe("Nombre de la suite"),
}, async (args) => {
    const { suite } = args;
    const st = store.load();
    const s = (st.suites || {})[suite];
    if (!s)
        return fail("suite no encontrada");
    return ok({ suite, descripcion: s.descripcion, total: s.casos.length, casos: s.casos });
});
server.tool("health_check", "Verifica que el servidor golden-set está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "golden-set", tools: 7, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[golden-set] fatal:", e);
    process.exit(1);
});

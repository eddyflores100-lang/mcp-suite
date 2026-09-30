#!/usr/bin/env node
/**
 * MCP Server: Pareto Tradeoff
 * Frontera de Pareto para decisiones multi-objetivo: qué opciones son dominadas y cuál es el punto de equilibrio
 *
 * Dolor que resuelve: El agente elige 'la mejor opción' cuando había 3 incomparables: sin calcular la frontera de Pareto no distingue las opciones dominadas de las trade-off reales, y recomienda la que más le gusta narrativamente.
 * Categoría: Razonamiento | Generado por mcp-suite | id: pareto-tradeoff
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
// ——— persistencia local: ~/.mcp-suite/pareto-tradeoff/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "pareto-tradeoff");
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
const server = new McpServer({ name: "pareto-tradeoff", version: "1.0.0" });
server.tool("add_option", "Añade una opción al problema de decisión con sus valores en cada objetivo.", {
    decision: z.string().describe("Nombre de la decisión"),
    opcion: z.string().describe("Nombre de la opción"),
    objetivos: z.any().describe("Valores {objetivo: valor numérico}"),
    direccion: z.any().describe("Por objetivo: 'max' o 'min' {objetivo: 'max'} (default max)").optional(),
}, async (args) => {
    const { decision, opcion, objetivos, direccion } = args;
    const st = store.load();
    st.decisiones = st.decisiones || {};
    st.decisiones[decision] = st.decisiones[decision] || { decision, opciones: {}, direccion: {} };
    const d = st.decisiones[decision];
    if (d.opciones[opcion])
        return fail("opción ya registrada: " + opcion);
    const obj = objetivos || {};
    const claves = Object.keys(obj).filter(k => typeof obj[k] === "number" && isFinite(obj[k]));
    if (!claves.length)
        return fail("sin objetivos numéricos");
    claves.forEach(k => { if (!d.direccion[k])
        d.direccion[k] = (direccion && direccion[k]) || "max"; });
    d.opciones[opcion] = { opcion, objetivos: obj };
    store.save(st);
    return ok({ decision, opcion, objetivos: claves.map(k => k + " (" + d.direccion[k] + ")"), opciones_totales: Object.keys(d.opciones).length, siguiente: "con 2+ opciones, ejecuta compute_frontier" });
});
server.tool("compute_frontier", "Calcula la frontera de Pareto: opciones dominadas fuera, incomparables dentro, con ranking por cobertura.", {
    decision: z.string().describe("Decisión"),
}, async (args) => {
    const { decision } = args;
    const st = store.load();
    const d = (st.decisiones || {})[decision];
    if (!d)
        return fail("decisión no encontrada");
    const nombres = Object.keys(d.opciones);
    if (nombres.length < 2)
        return fail("necesitas al menos 2 opciones");
    const objetivos = [...new Set(nombres.flatMap(n => Object.keys(d.opciones[n].objetivos)))];
    if (!objetivos.length)
        return fail("sin objetivos");
    const valor = (n, o) => {
        const v = d.opciones[n].objetivos[o];
        if (v === undefined)
            return null;
        return d.direccion[o] === "min" ? -v : v;
    };
    const domina = (a, b) => objetivos.every(o => { const va = valor(a, o), vb = valor(b, o); return va === null || vb === null ? true : va >= vb; }) && objetivos.some(o => { const va = valor(a, o), vb = valor(b, o); return va !== null && vb !== null && va > vb; });
    const frontera = nombres.filter(n => !nombres.some(m => m !== n && domina(m, n)));
    const dominadas = nombres.filter(n => !frontera.includes(n)).map(n => {
        const dominantes = nombres.filter(m => m !== n && domina(m, n));
        return { opcion: n, dominada_por: dominantes, objetivo_perdido: dominantes.length ? "sin ganar en nada a " + dominantes[0] : null };
    });
    const cobertura = frontera.map(n => ({ opcion: n, objetivos_alcanzados: objetivos.filter(o => valor(n, o) !== null && valor(n, o) >= Math.max(...nombres.map(m => valor(m, o)).filter(v => v !== null))).length, deficit_maximo: Number(Math.max(...objetivos.map(o => { const mejor = Math.max(...nombres.map(m => valor(m, o)).filter(v => v !== null)); const propio = valor(n, o); return propio === null || mejor === null ? 0 : Math.abs(mejor - propio); }))) }));
    return ok({ decision, objetivos, direccion: d.direccion, opciones: nombres.length, frontera_de_pareto: frontera, opciones_dominadas: dominadas, trade_off_real: frontera.length > 1 ? "hay " + frontera.length + " opciones INCOMPARABLES: no existe 'la mejor' sin ponderar prioridades: usa knee_point o decide tus pesos" : "una sola opción domina: es la ganadora clara", detalle_frontera: cobertura });
});
server.tool("knee_point", "Encuentra el punto rodilla de la frontera: la opción con mejor equilibrio sin normalizar al respecto.", {
    decision: z.string().describe("Decisión"),
}, async (args) => {
    const { decision } = args;
    const st = store.load();
    const d = (st.decisiones || {})[decision];
    if (!d)
        return fail("decisión no encontrada");
    const nombres = Object.keys(d.opciones);
    if (nombres.length < 2)
        return fail("necesitas 2+ opciones");
    const objetivos = [...new Set(nombres.flatMap(n => Object.keys(d.opciones[n].objetivos)))];
    if (objetivos.length < 2)
        return fail("el punto rodilla exige al menos 2 objetivos");
    const raw = (n, o) => d.opciones[n].objetivos[o];
    const vals = objetivos.map(o => nombres.map(n => raw(n, o)).filter(v => typeof v === "number" && isFinite(v)));
    const min = objetivos.map((o, i) => Math.min(...vals[i]));
    const span = objetivos.map((o, i) => Math.max(...vals[i]) - min[i] || 1);
    const norm = (n, o) => {
        const i = objetivos.indexOf(o);
        const v = raw(n, o);
        if (typeof v !== "number" || !isFinite(v))
            return null;
        const x = (v - min[i]) / span[i];
        return d.direccion[o] === "min" ? 1 - x : x;
    };
    const puntajes = nombres.map(n => {
        const v = objetivos.map(o => norm(n, o));
        const completos = v.every(x => x !== null);
        const media = v.filter(x => x !== null).reduce((a, b) => a + b, 0) / v.filter(x => x !== null).length;
        const minimo = Math.min(...v.filter(x => x !== null));
        return { opcion: n, media_normalizada: Number(media.toFixed(3)), peor_objetivo: Number(minimo.toFixed(3)), datos_completos: completos };
    });
    const ideal = { media: 1, peor: 1 };
    const distancias = puntajes.map(p => ({ ...p, distancia_al_ideal: Number(Math.sqrt(Math.pow(ideal.media - p.media_normalizada, 2) + Math.pow(ideal.peor - p.peor_objetivo, 2)).toFixed(3)) })).sort((a, b) => a.distancia_al_ideal - b.distancia_al_ideal);
    return ok({ decision, objetivos, ideal: "media 1.0 y peor-objetivo 1.0 (imposible si hay trade-off)", candidatos: distancias, knee: distancias[0].opcion, razon: "el punto rodilla pierde lo MENOS posible en su peor objetivo manteniendo la media más alta: el equilibrio natural", alternativa_si_ponderas: "si un objetivo te importa el doble, dime los pesos y recalculo" });
});
server.tool("health_check", "Verifica que el servidor pareto-tradeoff está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "pareto-tradeoff", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[pareto-tradeoff] fatal:", e);
    process.exit(1);
});

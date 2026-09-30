#!/usr/bin/env node
/**
 * MCP Server: Deadlock Detector
 * Detecta esperas circulares y contentión de recursos entre agentes antes de que se congelen
 *
 * Dolor que resuelve: Los agentes se bloquean en silencio: A espera a B, B espera a C y C espera a A. Nadie detecta el ciclo y la misión muere congelada sin error visible.
 * Categoría: Multi-Agente y Coordinación | Generado por mcp-suite | id: deadlock-detector
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
// ——— persistencia local: ~/.mcp-suite/deadlock-detector/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "deadlock-detector");
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
const server = new McpServer({ name: "deadlock-detector", version: "1.0.0" });
server.tool("declare_state", "Un agente declara qué recursos retiene y en quién espera. Reemplaza el estado previo del agente.", {
    agente: z.string().describe("Agent_id"),
    retiene: z.array(z.any()).describe("Recursos que retiene (IDs)").default([]),
    espera_a: z.array(z.any()).describe("Agent_ids o recursos a los que espera").default([]),
    tarea: z.string().describe("Qué está haciendo (para diagnóstico)").optional(),
}, async (args) => {
    const { agente, retiene, espera_a, tarea } = args;
    const st = store.load();
    st.agentes = st.agentes || {};
    st.agentes[agente] = { retiene: retiene || [], espera_a: espera_a || [], tarea: tarea || null, ts: new Date().toISOString() };
    store.save(st);
    return ok({ agente, retiene: (retiene || []).length, espera_a: (espera_a || []).length });
});
server.tool("detect", "Analiza el grafo de esperas y detecta ciclos (deadlocks) y cadenas de espera largas (livelock risk).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const agentes = st.agentes || {};
    const nombres = Object.keys(agentes);
    const ciclos = [];
    const visitando = new Set(), visitados = new Set();
    function dfs(nodo, camino) {
        if (visitando.has(nodo)) {
            const inicio = camino.indexOf(nodo);
            if (inicio >= 0)
                ciclos.push([...camino.slice(inicio), nodo]);
            return;
        }
        visitando.add(nodo);
        visitados.add(nodo);
        for (const next of agentes[nodo]?.espera_a || [])
            if (nombres.includes(next) || agentes[next])
                dfs(next, [...camino, nodo]);
        visitando.delete(nodo);
    }
    for (const n of nombres)
        if (!visitados.has(n))
            dfs(n, []);
    const unicos = [];
    for (const c of ciclos) {
        const firma = [...c].sort().join(">");
        if (!unicos.some(u => u.firma === firma))
            unicos.push({ ciclo: c, firma });
    }
    const recursosSostenidos = {};
    for (const [a, info] of __ents(agentes))
        for (const r of info.retiene || [])
            recursosSostenidos[r] = recursosSostenidos[r] || [];
    for (const [a, info] of __ents(agentes))
        for (const r of info.retiene || [])
            recursosSostenidos[r].push(a);
    const contencion = __ents(recursosSostenidos).filter(([, duenos]) => duenos.length > 1);
    const esperandoAlgo = nombres.filter(n => (agentes[n].espera_a || []).length > 0);
    return ok({
        agentes_declarados: nombres.length,
        deadlocks: unicos.length,
        ciclos: unicos.map(u => u.ciclo),
        deadlocked: [...new Set(unicos.flatMap(u => u.ciclo))],
        contention: contencion.map(([r, d]) => ({ recurso: r, retenido_por: d })),
        cadena_mas_larga: (() => { let mejor = []; for (const n of nombres) {
            const camino = [n];
            let cur = agentes[n]?.espera_a?.[0];
            let hops = 0;
            while (cur && agentes[cur] && hops < 20) {
                camino.push(cur);
                cur = agentes[cur]?.espera_a?.[0];
                hops++;
            }
            if (camino.length > mejor.length)
                mejor = camino;
        } return mejor; })(),
        veredicto: unicos.length ? "DEADLOCK: resuelve con resolve (elige víctima)" : contencion.length ? "contentión sin ciclo: vigila" : "sin bloqueos",
    });
});
server.tool("resolve", "Resuelve un deadlock eligiendo una víctima (la más barata de reiniciar) y genera el plan de desbloqueo.", {
    ciclo: z.array(z.any()).describe("Agentes del ciclo (del detect), opcional si solo hay uno").optional(),
    victima_manual: z.string().describe("Forzar víctima concreta").optional(),
}, async (args) => {
    const { ciclo, victima_manual } = args;
    const st = store.load();
    const agentes = st.agentes || {};
    let ciclosDetectados = [];
    const visitando = new Set(), visitados = new Set();
    function dfs(n, camino) {
        if (visitando.has(n)) {
            const i = camino.indexOf(n);
            if (i >= 0)
                ciclosDetectados.push([...camino.slice(i), n]);
            return;
        }
        visitando.add(n);
        visitados.add(n);
        for (const nx of agentes[n]?.espera_a || [])
            if (agentes[nx])
                dfs(nx, [...camino, n]);
        visitando.delete(n);
    }
    for (const n of Object.keys(agentes))
        if (!visitados.has(n))
            dfs(n, []);
    let objetivo = ciclo && ciclo.length ? ciclo : ciclosDetectados[0];
    if (!objetivo)
        return fail("no hay ciclo que resolver");
    const miembros = objetivo.filter(x => agentes[x]);
    if (!victima_manual) {
        miembros.sort((a, b) => (agentes[a].retiene?.length || 0) - (agentes[b].retiene?.length || 0));
    }
    const victima = victima_manual && miembros.includes(victima_manual) ? victima_manual : miembros[0];
    for (const m of miembros) {
        agentes[m].espera_a = (agentes[m].espera_a || []).filter(e => e !== victima);
        agentes[m].interrumpido = true;
    }
    st.resoluciones = st.resoluciones || [];
    st.resoluciones.push({ ciclo: miembros, victima, ts: new Date().toISOString() });
    store.save(st);
    return ok({
        victima, plan: [
            "1. cancela/rollback de " + victima + " (retiene " + (agentes[victima]?.retiene?.length || 0) + " recursos)",
            "2. libera sus recursos para que los demás avancen",
            ...miembros.filter(m => m !== victima).map(m => "3" + (m === miembros[1] ? "" : ".x") + ". " + m + " reintenta sin esperar a " + victima),
            "4. reprograma el trabajo de " + victima + " al final de la cola",
        ],
        criterio_victima: "menor retención de recursos = reinicio más barato",
    });
});
server.tool("stale_agents", "Detecta agentes cuyo último reporte supera un umbral: posibles procesos muertos que retienen recursos.", {
    umbral_minutos: z.number().describe("Minutos sin reporte para considerarlo rancio").default(30),
}, async (args) => {
    const { umbral_minutos } = args;
    const st = store.load();
    const agentes = st.agentes || {};
    const limite = Date.now() - umbral_minutos * 60000;
    const rancios = __ents(agentes).filter(([, i]) => new Date(i.ts).getTime() < limite);
    return ok({
        umbral_minutos, rancios: rancios.length,
        agentes_stale: rancios.map(([a, i]) => ({ agente: a, minutos_sin_reportar: Math.round((Date.now() - new Date(i.ts).getTime()) / 60000), retiene: i.retiene?.length || 0, ultima_tarea: i.tarea })),
        recursos_secuestrados: rancios.flatMap(([, i]) => i.retiene || []),
        consejo: rancios.length ? "declara esos recursos liberados o reinicia los agentes" : "todos frescos",
    });
});
server.tool("wait_graph", "Exporta el grafo de esperas en formato legible (aristas agente→espera_a) para diagnóstico o visualización.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const agentes = st.agentes || {};
    const aristas = [];
    for (const [a, i] of __ents(agentes))
        for (const e of i.espera_a || [])
            aristas.push(a + " -> " + e);
    return ok({ nodos: Object.keys(agentes).length, aristas: aristas.length, grafo: aristas, dot: "digraph waits {" + aristas.map(a => '"' + a.split(" -> ")[0] + '" -> "' + a.split(" -> ")[1] + '"').join("; ") + "}" });
});
server.tool("clear", "Limpia el estado de un agente (terminó o fue reiniciado) liberando sus declaraciones.", {
    agente: z.string().describe("Agent_id a limpiar"),
}, async (args) => {
    const { agente } = args;
    const st = store.load();
    if (!(st.agentes || {})[agente])
        return ok({ limpiado: false, razon: "no tenía estado" });
    delete st.agentes[agente];
    store.save(st);
    return ok({ limpiado: true, agente, quedan: Object.keys(st.agentes).length });
});
server.tool("health_check", "Verifica que el servidor deadlock-detector está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "deadlock-detector", tools: 7, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[deadlock-detector] fatal:", e);
    process.exit(1);
});

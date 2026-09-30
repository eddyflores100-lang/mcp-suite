#!/usr/bin/env node
/**
 * MCP Server: Mistake Patterns
 * Detecta patrones recurrentes de error: la tercera vez que fallas igual ya no es mala suerte
 *
 * Dolor que resuelve: Los errores se registran individualmente y nunca se cruzan: el agente falla igual 5 veces en contextos distintos y nadie conecta los puntos porque cada incidente parece distinto.
 * Categoría: Aprendizaje de Habilidades | Generado por mcp-suite | id: mistake-patterns
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
// ——— persistencia local: ~/.mcp-suite/mistake-patterns/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "mistake-patterns");
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
const server = new McpServer({ name: "mistake-patterns", version: "1.0.0" });
server.tool("log_mistake", "Registra un error cometido (contexto + descripción) para el análisis de patrones.", {
    contexto: z.string().describe("Qué tarea/situación"),
    descripcion: z.string().describe("Qué se hizo mal exactamente"),
    costo: z.string().describe("Costo del error (tokens, tiempo, daño)").optional(),
}, async (args) => {
    const { contexto, descripcion, costo } = args;
    const st = store.load();
    st.errores = st.errores || [];
    st.errores.push({ n: st.errores.length + 1, contexto, descripcion, costo: costo || null, ts: new Date().toISOString() });
    store.save(st);
    return ok({ error_n: st.errores.length });
});
server.tool("detect_patterns", "Agrupa errores similares (clustering lexical) y devuelve patrones con recurrencia y daño.", {
    umbral_similitud: z.number().describe("Similitud Jaccard para agrupar (0-1)").default(0.35),
}, async (args) => {
    const { umbral_similitud } = args;
    const st = store.load();
    const errores = st.errores || [];
    if (errores.length < 3)
        return ok({ errores: errores.length, patrones: "insuficiente (mínimo 3)" });
    const tokens = (s) => new Set(String(s).toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const conTokens = errores.map(e => ({ ...e, tk: tokens(e.descripcion + " " + e.contexto) }));
    const clusters = [];
    for (const e of conTokens) {
        let puesto = false;
        for (const c of clusters) {
            const rep = c[0];
            const inter = [...rep.tk].filter(w => e.tk.has(w)).length;
            const union = new Set([...rep.tk, ...e.tk]).size || 1;
            if (inter / union >= umbral_similitud) {
                c.push(e);
                puesto = true;
                break;
            }
        }
        if (!puesto)
            clusters.push([e]);
    }
    const patrones = clusters.filter(c => c.length >= 2).map(c => ({
        recurrencia: c.length,
        descripcion_representativa: c[0].descripcion.slice(0, 100),
        contextos_afectados: [...new Set(c.map(e => e.contexto.slice(0, 50)))],
        primera_vez: c[0].ts, ultima_vez: c[c.length - 1].ts,
        tokens_comunes: [...c[0].tk].filter(w => c.every(e => e.tk.has(w))).slice(0, 8),
    })).sort((a, b) => b.recurrencia - a.recurrencia);
    return ok({
        errores_totales: errores.length,
        clusters: clusters.length,
        patrones_recurrentes: patrones.length,
        patrones: patrones.slice(0, 6),
        veredicto: patrones.length ? "HAY patrón recurrente: esto es sistémico, escribe una lección (lesson-library) y una acción preventiva" : "errores dispersos: aún no hay patrón",
    });
});
server.tool("same_mistake_check", "Antes de actuar: ¿ya fallé haciendo exactamente esto? Devuelve el historial similar.", {
    accion_prevista: z.string().describe("Lo que estás a punto de hacer"),
}, async (args) => {
    const { accion_prevista } = args;
    const st = store.load();
    const errores = st.errores || [];
    if (!errores.length)
        return ok({ historial: 0, aviso: "primer error posible: sin historial" });
    const tokens = (s) => new Set(String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\W+/).filter(w => w.length > 3).map(w => w.endsWith("lo") && w.length > 5 ? w.slice(0, -2) : w));
    const act = tokens(accion_prevista);
    const similares = errores.map(e => {
        const et = tokens(e.descripcion + " " + e.contexto);
        const inter = [...et].filter(w => act.has(w)).length;
        return { n: e.n, descripcion: e.descripcion.slice(0, 90), similitud: Number((inter / Math.max(et.size, 1)).toFixed(2)), costo: e.costo };
    }).filter(x => x.similitud >= 0.3).sort((a, b) => b.similitud - a.similitud);
    return ok({
        fallos_previos_similares: similares.length,
        historial: similares.slice(0, 5),
        freno: similares.length >= 2 ? "ya fallaste 2+ veces con esto: consulta lesson-library y cambia el enfoque ANTES de reintentar" : similares.length === 1 ? "fallaste algo parecido una vez: aplica la corrección conocida" : "sin precedentes cercanos",
    });
});
server.tool("mistake_stats", "Estadísticas de errores: frecuencia temporal, contexto más propenso y mejora (errores/semana).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const errores = st.errores || [];
    if (!errores.length)
        return ok({ errores: 0 });
    const porSemana = {};
    for (const e of errores) {
        const d = new Date(e.ts);
        const lunes = new Date(d);
        lunes.setDate(d.getDate() - d.getDay());
        const k = lunes.toISOString().slice(0, 10);
        porSemana[k] = (porSemana[k] || 0) + 1;
    }
    const semanas = __ents(porSemana).sort(([a], [b]) => a < b ? -1 : 1);
    const porContexto = {};
    for (const e of errores) {
        const c = e.contexto.split(/\s+/).slice(0, 2).join(" ");
        porContexto[c] = (porContexto[c] || 0) + 1;
    }
    const n = semanas.length;
    return ok({
        errores: errores.length,
        por_semana: semanas.slice(-8),
        tendencia: n >= 2 ? (semanas[n - 1][1] > semanas[n - 2][1] ? "empeorando" : "mejorando") : "insuficiente",
        contextos_mas_propensos: __ents(porContexto).sort((a, b) => b[1] - a[1]).slice(0, 5),
    });
});
server.tool("health_check", "Verifica que el servidor mistake-patterns está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "mistake-patterns", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[mistake-patterns] fatal:", e);
    process.exit(1);
});

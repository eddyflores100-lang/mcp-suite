#!/usr/bin/env node
/**
 * MCP Server: Source Timeline
 * Línea de tiempo de fuentes: cuándo se supo qué y qué fuente dijo primero cada cosa
 *
 * Dolor que resuelve: El agente funde información de fuentes de distinta época en un solo presente: dice 'según los informes' mezclando 2019 con 2026 sin poder reconstruir qué se sabía en qué momento.
 * Categoría: Frescura del Conocimiento | Generado por mcp-suite | id: source-timeline
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
// ——— persistencia local: ~/.mcp-suite/source-timeline/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "source-timeline");
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
const server = new McpServer({ name: "source-timeline", version: "1.0.0" });
server.tool("add_event", "Añade un evento de conocimiento: fuente, fecha, afirmación y tema.", {
    fuente: z.string().describe("Nombre de la fuente"),
    fecha: z.string().describe("Fecha ISO de la publicación/observación"),
    afirmacion: z.string().describe("Qué afirmó"),
    tema: z.string().describe("Tema (para agrupar)").default("general"),
}, async (args) => {
    const { fuente, fecha, afirmacion, tema } = args;
    const st = store.load();
    if (isNaN(new Date(fecha).getTime()))
        return fail("fecha ISO inválida");
    st.eventos = st.eventos || [];
    st.eventos.push({ fuente, fecha, afirmacion, tema, ts: new Date().toISOString() });
    store.save(st);
    return ok({ fuente, fecha: fecha.slice(0, 10), tema });
});
server.tool("timeline", "Devuelve la línea de tiempo cronológica (global o por tema) con edad de cada afirmación.", {
    tema: z.string().describe("Filtrar por tema").optional(),
}, async (args) => {
    const { tema } = args;
    const st = store.load();
    let evs = st.eventos || [];
    if (tema)
        evs = evs.filter(e => e.tema === tema);
    if (!evs.length)
        return ok({ eventos: 0 });
    evs = [...evs].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    return ok({
        eventos: evs.length,
        rango: { desde: evs[0].fecha.slice(0, 10), hasta: evs[evs.length - 1].fecha.slice(0, 10) },
        linea: evs.map(e => ({ fecha: e.fecha.slice(0, 10), fuente: e.fuente, afirmacion: e.afirmacion.slice(0, 100), tema: e.tema, dias_desde: Number(((Date.now() - new Date(e.fecha).getTime()) / 86400000).toFixed(0)) })),
        advertencia: (Date.now() - new Date(evs[evs.length - 1].fecha).getTime()) / 86400000 > 180 ? "la información más reciente tiene más de 6 meses: busca fuentes frescas" : null,
    });
});
server.tool("contradiction_scan", "Escanea contradicciones cronológicas: fuentes posteriores que afirman lo opuesto sobre el mismo tema.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const evs = (st.eventos || []).map(e => e).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    if (evs.length < 2)
        return ok({ eventos: evs.length, contradicciones: 0 });
    const tokens = (s) => new Set(String(s).toLowerCase().split(/\W+/).filter(w => w.length > 4));
    const NEGADORES = /\b(no|nunca|sin|cero|falso|reverso|declinó|declino|cayó|cayo|baja)\b/i;
    const contradicciones = [];
    for (let i = 0; i < evs.length; i++) {
        for (let j = i + 1; j < evs.length; j++) {
            if (evs[i].tema !== evs[j].tema)
                continue;
            const a = tokens(evs[i].afirmacion), b = tokens(evs[j].afirmacion);
            const inter = [...a].filter(w => b.has(w)).length;
            const union = new Set([...a, ...b]).size || 1;
            const similitud = inter / union;
            if (similitud >= 0.35 && (NEGADORES.test(evs[i].afirmacion) !== NEGADORES.test(evs[j].afirmacion))) {
                contradicciones.push({ tema: evs[i].tema, antes: { fuente: evs[i].fuente, fecha: evs[i].fecha.slice(0, 10), afirmacion: evs[i].afirmacion.slice(0, 80) }, despues: { fuente: evs[j].fuente, fecha: evs[j].fecha.slice(0, 10), afirmacion: evs[j].afirmacion.slice(0, 80) }, similitud: Number(similitud.toFixed(2)) });
            }
        }
    }
    return ok({
        contradicciones: contradicciones.length,
        pares: contradicciones.slice(0, 8),
        regla: "ante contradicción cronológica: cita la fuente MÁS RECIENTE pero menciona que hubo cambio ('antes se decía X, desde [fecha] Y')",
    });
});
server.tool("who_said_first", "Para un tema/afirmación: qué fuente lo dijo primero y quién lo replicó después.", {
    consulta: z.string().describe("Tema o palabra clave"),
}, async (args) => {
    const { consulta } = args;
    const st = store.load();
    const evs = (st.eventos || []).filter(e => e.tema.toLowerCase().includes(String(consulta).toLowerCase()) || e.afirmacion.toLowerCase().includes(String(consulta).toLowerCase())).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    if (!evs.length)
        return ok({ encontrados: 0 });
    return ok({
        encontrados: evs.length,
        primera: { fuente: evs[0].fuente, fecha: evs[0].fecha.slice(0, 10), afirmacion: evs[0].afirmacion.slice(0, 100) },
        replicas: evs.slice(1).map(e => ({ fuente: e.fuente, fecha: e.fecha.slice(0, 10) })),
        lectura: evs.length === 1 ? "una sola fuente: corroboración pendiente" : "corroborado por " + evs.length + " fuentes, original de " + evs[0].fuente,
    });
});
server.tool("health_check", "Verifica que el servidor source-timeline está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "source-timeline", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[source-timeline] fatal:", e);
    process.exit(1);
});

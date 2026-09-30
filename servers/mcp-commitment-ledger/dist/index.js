#!/usr/bin/env node
/**
 * MCP Server: Commitment Ledger
 * Libro mayor de compromisos del agente: promesas con deadline, cumplimiento y reputación
 *
 * Dolor que resuelve: Los agentes prometen ('lo envío hoy', 'lo reviso luego') y olvidan: no hay libro de compromisos, así que el incumplimiento es invisible hasta que el humano pregunta dónde está.
 * Categoría: Objetivos y Largo Plazo | Generado por mcp-suite | id: commitment-ledger
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
// ——— persistencia local: ~/.mcp-suite/commitment-ledger/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "commitment-ledger");
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
const server = new McpServer({ name: "commitment-ledger", version: "1.0.0" });
server.tool("make_commitment", "Registra un compromiso verificable: qué, para quién, cuándo y con qué criterio de cumplimiento.", {
    que: z.string().describe("Qué se promete (accionable)"),
    para_quien: z.string().describe("Beneficiario (humano o agente)"),
    deadline: z.string().describe("Fecha ISO o relativa (en 2h, mañana, 2026-12-01)"),
    prioridad: z.enum(["alta", "media", "baja"]).describe("Prioridad").default("media"),
    criterio: z.string().describe("Cómo se sabrá que se cumplió").optional(),
}, async (args) => {
    const { que, para_quien, deadline, prioridad, criterio } = args;
    const st = store.load();
    st.compromisos = st.compromisos || [];
    function parseCuando(s) {
        const s2 = String(s).toLowerCase().trim();
        const m = s2.match(/^en\s+(\d+)\s*(min|minutos|h|horas|d|dias|día|semana|semanas)/);
        if (m) {
            const n = parseInt(m[1]);
            const u = m[2];
            const mult = u.startsWith("min") ? 60000 : u.startsWith("h") ? 3600000 : u.includes("semana") ? 604800000 : 86400000;
            return new Date(Date.now() + n * mult).toISOString();
        }
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const cuando = parseCuando(deadline);
    if (!cuando)
        return fail("deadline no interpretable: usa ISO o 'en 2h' / 'en 3 dias'");
    const id = "cm_" + Date.now().toString(36);
    st.compromisos.push({ id, que, para_quien, deadline: cuando, prioridad, criterio: criterio || null, estado: "abierto", creado: new Date().toISOString(), cumplido_ts: null });
    store.save(st);
    return ok({ compromiso_id: id, deadline: cuando, horas_restantes: Number(((new Date(cuando).getTime() - Date.now()) / 3600000).toFixed(1)) });
});
server.tool("list_commitments", "Lista compromisos abiertos ordenados por deadline con riesgo de vencimiento inminente.", {
    solo_abiertos: z.boolean().describe("Solo pendientes").default(true),
    para_quien: z.string().describe("Filtrar por beneficiario").optional(),
}, async (args) => {
    const { solo_abiertos, para_quien } = args;
    const st = store.load();
    let cs = st.compromisos || [];
    if (solo_abiertos)
        cs = cs.filter(c => c.estado === "abierto");
    if (para_quien)
        cs = cs.filter(c => c.para_quien === para_quien);
    cs.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    return ok({
        total: cs.length,
        vencidos: cs.filter(c => c.estado === "abierto" && new Date(c.deadline) < new Date()).length,
        compromisos: cs.map(c => ({
            id: c.id, que: c.que.slice(0, 80), para: c.para_quien, prioridad: c.prioridad,
            horas_restantes: Number(((new Date(c.deadline).getTime() - Date.now()) / 3600000).toFixed(1)),
            estado: c.estado === "abierto" && new Date(c.deadline) < new Date() ? "VENCIDO" : c.estado,
        })),
    });
});
server.tool("fulfill", "Marca un compromiso como cumplido con evidencia; alimenta el score de reputación.", {
    compromiso_id: z.string().describe("ID del compromiso"),
    evidencia: z.string().describe("Cómo se cumplió").optional(),
}, async (args) => {
    const { compromiso_id, evidencia } = args;
    const st = store.load();
    const c = (st.compromisos || []).find(x => x.id === compromiso_id);
    if (!c)
        return fail("compromiso no encontrado");
    if (c.estado !== "abierto")
        return fail("ya está " + c.estado);
    c.estado = "cumplido";
    c.cumplido_ts = new Date().toISOString();
    c.evidencia = evidencia || null;
    const tarde = new Date(c.cumplido_ts) > new Date(c.deadline);
    c.tarde = tarde;
    store.save(st);
    return ok({ compromiso: c.id, cumplido: true, a_tiempo: !tarde, horas_de_diferencia: Number(((new Date(c.cumplido_ts).getTime() - new Date(c.deadline).getTime()) / 3600000).toFixed(1)) });
});
server.tool("renegotiate", "Renegocia un compromiso a punto de vencer: nuevo deadline con motivo (queda auditado).", {
    compromiso_id: z.string().describe("ID del compromiso"),
    nuevo_deadline: z.string().describe("Nuevo plazo (ISO o 'en Xh')"),
    motivo: z.string().describe("Por qué se renegocia"),
}, async (args) => {
    const { compromiso_id, nuevo_deadline, motivo } = args;
    const st = store.load();
    const c = (st.compromisos || []).find(x => x.id === compromiso_id);
    if (!c)
        return fail("compromiso no encontrado");
    if (c.estado !== "abierto")
        return fail("compromiso " + c.estado);
    const m = String(nuevo_deadline).toLowerCase().match(/^en\s+(\d+)\s*(min|minutos|h|horas|d|dias|semanas?)/);
    const cuando = m ? new Date(Date.now() + parseInt(m[1]) * (m[2].startsWith("min") ? 60000 : m[2].startsWith("h") ? 3600000 : m[2].includes("semana") ? 604800000 : 86400000)).toISOString() : (() => { const d = new Date(nuevo_deadline); return isNaN(d.getTime()) ? null : d.toISOString(); })();
    if (!cuando)
        return fail("nuevo deadline no interpretable");
    c.renegociaciones = c.renegociaciones || [];
    c.renegociaciones.push({ antes: c.deadline, ahora: cuando, motivo, ts: new Date().toISOString() });
    c.deadline = cuando;
    store.save(st);
    return ok({ compromiso: c.id, nuevo_deadline: cuando, renegociaciones: c.renegociaciones.length, aviso: c.renegociaciones.length >= 2 ? "dos renegociaciones: esto es un patrón, no un imprevisto" : "renegociado" });
});
server.tool("reputation", "Score de cumplimiento: tasa a tiempo, tardíos medios y patrón de renegociación.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const cs = st.compromisos || [];
    const cerrados = cs.filter(c => c.estado === "cumplido" || c.estado === "incumplido");
    if (!cerrados.length)
        return ok({ cerrados: 0, sugerencia: "registra y cierra compromisos para medir reputación" });
    const aTiempo = cerrados.filter(c => c.estado === "cumplido" && !c.tarde).length;
    const tardios = cerrados.filter(c => c.tarde).length;
    const reneg = cs.reduce((s, c) => s + (c.renegociaciones?.length || 0), 0);
    return ok({
        total: cs.length, abiertos: cs.filter(c => c.estado === "abierto").length, vencidos_abiertos: cs.filter(c => c.estado === "abierto" && new Date(c.deadline) < new Date()).length,
        score_cumplimiento: Number((aTiempo / cerrados.length).toFixed(2)),
        a_tiempo: aTiempo, tardios, incumplidos: cerrados.filter(c => c.estado === "incumplido").length,
        renegociaciones_totales: reneg,
        veredicto: aTiempo / cerrados.length > 0.8 ? "agente fiable" : aTiempo / cerrados.length > 0.5 ? "cumplimiento irregular: compromete menos cosas o más plazo" : "incumplidor crónico: deja de prometer deadlines",
    });
});
server.tool("load_forecast", "Proyección de carga por semana según compromisos abiertos: detecta semanas saturadas.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const abiertos = (st.compromisos || []).filter(c => c.estado === "abierto");
    if (!abiertos.length)
        return ok({ carga: 0, semanas: [] });
    const semanas = {};
    for (const c of abiertos) {
        const d = new Date(c.deadline);
        const inicio = new Date(d);
        inicio.setHours(0, 0, 0, 0);
        inicio.setDate(inicio.getDate() - inicio.getDay());
        const k = inicio.toISOString().slice(0, 10);
        semanas[k] = semanas[k] || { semana: k, compromisos: 0, alta: 0 };
        semanas[k].compromisos++;
        if (c.prioridad === "alta")
            semanas[k].alta++;
    }
    const lista = __vals(semanas).sort((a, b) => a.semana < b.semana ? -1 : 1);
    return ok({
        abiertos: abiertos.length,
        semanas: lista.map(s => ({ ...s, saturada: s.compromisos >= 5 || s.alta >= 3 })),
        advertencia: lista.filter(s => s.compromisos >= 5 || s.alta >= 3).map(s => "semana " + s.semana + " saturada: renegocia o delega antes"),
    });
});
server.tool("health_check", "Verifica que el servidor commitment-ledger está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "commitment-ledger", tools: 7, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[commitment-ledger] fatal:", e);
    process.exit(1);
});

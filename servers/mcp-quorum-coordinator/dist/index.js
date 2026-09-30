#!/usr/bin/env node
/**
 * MCP Server: Quorum Coordinator
 * Votaciones distribuidas con quórum, pesos y timeouts: decisiones de equipo sin dictador
 *
 * Dolor que resuelve: En equipos de agentes las decisiones críticas las toma el primero que llega, sin quórum ni pesos: minorías ruidosas ganan y no queda rastro de quién votó qué.
 * Categoría: Multi-Agente y Coordinación | Generado por mcp-suite | id: quorum-coordinator
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
// ——— persistencia local: ~/.mcp-suite/quorum-coordinator/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "quorum-coordinator");
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
const server = new McpServer({ name: "quorum-coordinator", version: "1.0.0" });
server.tool("open_vote", "Abre una votación: pregunta, opciones, quórum mínimo y timeout. Devuelve el acta de apertura.", {
    pregunta: z.string().describe("Pregunta a decidir"),
    opciones: z.array(z.any()).describe("Opciones votables"),
    quorum: z.number().describe("Votos mínimos para validar").default(2),
    timeout_minutos: z.number().describe("Minutos antes de cerrar por timeout").default(30),
    pesos: z.any().describe("Mapa {agente: peso} opcional").optional(),
}, async (args) => {
    const { pregunta, opciones, quorum, timeout_minutos, pesos } = args;
    const st = store.load();
    st.votos = st.votos || [];
    const opts = (opciones || []).map(String);
    if (opts.length < 2)
        return fail("una votación necesita >=2 opciones");
    const id = "vt_" + Date.now().toString(36);
    st.votos.push({ id, pregunta, opciones: opts, quorum, timeout: new Date(Date.now() + timeout_minutos * 60000).toISOString(), pesos: pesos || {}, sufragios: [], estado: "abierta", creada: new Date().toISOString() });
    store.save(st);
    return ok({ votacion_id: id, pregunta, opciones: opts, quorum, cierra: st.votos.at(-1).timeout });
});
server.tool("cast_vote", "Un agente emite su voto (opción o ranking preferencial). Un agente = un voto reemplazable.", {
    votacion_id: z.string().describe("ID de la votación"),
    agente: z.string().describe("Agent_id votante"),
    opcion: z.string().describe("Opción elegida (o la primera del ranking)"),
    ranking: z.array(z.any()).describe("Ranking preferencial completo (Borda)").optional(),
    razon: z.string().describe("Justificación breve").optional(),
}, async (args) => {
    const { votacion_id, agente, opcion, ranking, razon } = args;
    const st = store.load();
    const v = (st.votos || []).find(x => x.id === votacion_id);
    if (!v)
        return fail("votación no encontrada");
    if (v.estado !== "abierta")
        return fail("votación " + v.estado);
    if (new Date(v.timeout) < new Date()) {
        v.estado = "cerrada_timeout";
        store.save(st);
        return fail("timeout alcanzado");
    }
    if (!v.opciones.includes(opcion))
        return fail("opción no válida: " + v.opciones.join(" | "));
    v.sufragios = v.sufragios.filter(s => s.agente !== agente);
    v.sufragios.push({ agente, opcion, ranking: ranking || null, razon: razon || null, ts: new Date().toISOString() });
    store.save(st);
    const pesos = v.pesos || {};
    const pesoTotal = v.sufragios.reduce((s, x) => s + (pesos[x.agente] ?? 1), 0);
    return ok({ voto: opcion, emitidos: v.sufragios.length, peso_acumulado: Number(pesoTotal.toFixed(2)), faltan_para_quorum: Math.max(0, v.quorum - v.sufragios.length) });
});
server.tool("tally", "Escruta: mayoría simple, ponderada por pesos y Borda si hay rankings. Indica si se alcanzó quórum.", {
    votacion_id: z.string().describe("ID de la votación"),
}, async (args) => {
    const { votacion_id } = args;
    const st = store.load();
    const v = (st.votos || []).find(x => x.id === votacion_id);
    if (!v)
        return fail("votación no encontrada");
    const pesos = v.pesos || {};
    const simple = {}, ponderado = {}, borda = {};
    for (const s of v.sufragios) {
        const w = pesos[s.agente] ?? 1;
        simple[s.opcion] = (simple[s.opcion] || 0) + 1;
        ponderado[s.opcion] = Number(((ponderado[s.opcion] || 0) + w).toFixed(2));
        if (Array.isArray(s.ranking) && s.ranking.length) {
            const n = s.ranking.length;
            s.ranking.forEach((opt, idx) => { if (v.opciones.includes(opt))
                borda[opt] = (borda[opt] || 0) + (n - idx) * w; });
        }
    }
    const ganadorSimple = __ents(simple).sort((a, b) => b[1] - a[1])[0] || null;
    const ganadorPonderado = __ents(ponderado).sort((a, b) => b[1] - a[1])[0] || null;
    const ganadorBorda = __ents(borda).length ? __ents(borda).sort((a, b) => b[1] - a[1])[0] : null;
    const quorumOK = v.sufragios.length >= v.quorum;
    return ok({
        votacion: v.id, pregunta: v.pregunta, estado: v.estado,
        emitidos: v.sufragios.length, quorum_requerido: v.quorum, quorum_alcanzado: quorumOK,
        escrutinio_simple: simple, escrutinio_ponderado: ponderado, escrutinio_borda: borda,
        ganadores: { simple: ganadorSimple?.[0] || null, ponderado: ganadorPonderado?.[0] || null, borda: ganadorBorda?.[0] || null },
        advertencia: !quorumOK ? "quórum NO alcanzado: la decisión no es vinculante" : ganadorSimple && ganadorPonderado && ganadorSimple[0] !== ganadorPonderado[0] ? "mayoría simple y ponderada difieren: conflicto de pesos, arbitra" : "decisión válida",
    });
});
server.tool("close_vote", "Cierra la votación con veredicto oficial y acta (quién votó qué queda auditado).", {
    votacion_id: z.string().describe("ID de la votación"),
    criterio: z.enum(["simple", "ponderado", "borda"]).describe("Criterio de desempate final").default("ponderado"),
}, async (args) => {
    const { votacion_id, criterio } = args;
    const st = store.load();
    const v = (st.votos || []).find(x => x.id === votacion_id);
    if (!v)
        return fail("votación no encontrada");
    if (v.estado !== "abierta")
        return ok({ estado: v.estado, veredicto: v.veredicto });
    const pesos = v.pesos || {};
    const conteo = {};
    for (const s of v.sufragios)
        conteo[s.opcion] = Number(((conteo[s.opcion] || 0) + (pesos[s.agente] ?? 1)).toFixed(2));
    const ganador = __ents(conteo).sort((a, b) => b[1] - a[1])[0];
    v.estado = "cerrada";
    v.veredicto = { ganador: ganador?.[0] || null, criterio, conteo, quorum: v.sufragios.length >= v.quorum, acta: v.sufragios.map(s => ({ agente: s.agente, voto: s.opcion, razon: s.razon })), cerrada: new Date().toISOString() };
    store.save(st);
    return ok({ votacion: v.id, ganador: v.veredicto.ganador, vinculante: v.veredicto.quorum, acta: v.veredicto.acta });
});
server.tool("default_on_timeout", "Cierra votaciones vencidas aplicando veredicto por defecto documentado (evita decisiones zombis eternas).", {
    politica_defecto: z.enum(["sin_cambio", "primera_opcion", "escalado_humano"]).describe("Qué hacer al expirar").default("sin_cambio"),
}, async (args) => {
    const { politica_defecto } = args;
    const st = store.load();
    let cerradas = 0;
    for (const v of st.votos || []) {
        if (v.estado !== "abierta" || new Date(v.timeout) >= new Date())
            continue;
        v.estado = "cerrada_timeout";
        v.veredicto = { ganador: politica_defecto === "primera_opcion" ? v.opciones[0] : null, por_defecto: politica_defecto, quorum: v.sufragios.length >= v.quorum, cerrada: new Date().toISOString() };
        cerradas++;
    }
    store.save(st);
    return ok({ cerradas_por_timeout: cerradas, politica: politica_defecto, abiertas_restantes: (st.votos || []).filter(v => v.estado === "abierta").length });
});
server.tool("vote_history", "Historial de votaciones del equipo con desenlaces y participación media.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const vs = st.votos || [];
    if (!vs.length)
        return ok({ total: 0 });
    const participacion = vs.map(v => v.sufragios.length);
    return ok({
        total: vs.length,
        abiertas: vs.filter(v => v.estado === "abierta").length,
        participacion_media: Number((participacion.reduce((a, b) => a + b, 0) / vs.length).toFixed(1)),
        ultimas: vs.slice(-10).map(v => ({ id: v.id, pregunta: v.pregunta.slice(0, 70), estado: v.estado, ganador: v.veredicto?.ganador || null, votos: v.sufragios.length })),
    });
});
server.tool("health_check", "Verifica que el servidor quorum-coordinator está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "quorum-coordinator", tools: 7, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[quorum-coordinator] fatal:", e);
    process.exit(1);
});

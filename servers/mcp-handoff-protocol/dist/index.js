#!/usr/bin/env node
/**
 * MCP Server: Handoff Protocol
 * Transferencias estructuradas entre agentes con checklist de comprensión y score de calidad
 *
 * Dolor que resuelve: Los handoffs entre agentes pierden estado: el receptor reinventa el contexto, repite trabajo ya hecho y descubre los riesgos tarde. 'Coordination gaps' es causa raíz de fallo multi-agente.
 * Categoría: Multi-Agente y Coordinación | Generado por mcp-suite | id: handoff-protocol
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
// ——— persistencia local: ~/.mcp-suite/handoff-protocol/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "handoff-protocol");
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
const server = new McpServer({ name: "handoff-protocol", version: "1.0.0" });
server.tool("create_handoff", "Crea un handoff estructurado: resumen de contexto, estado actual, pendientes priorizados, riesgos conocidos y artefactos clave.", {
    de: z.string().describe("Agent_id que transfiere"),
    para: z.string().describe("Agent_id que recibe"),
    contexto: z.string().describe("Resumen del contexto esencial (objetivo, decisiones tomadas)"),
    estado_actual: z.string().describe("En qué punto exacto está el trabajo"),
    pendientes: z.array(z.any()).describe("Tareas pendientes").default([]),
    riesgos: z.array(z.any()).describe("Riesgos conocidos y trampas").default([]),
    artefactos: z.array(z.any()).describe("Rutas/IDs de artefactos relevantes").default([]),
}, async (args) => {
    const { de, para, contexto, estado_actual, pendientes, riesgos, artefactos } = args;
    const st = store.load();
    st.handoffs = st.handoffs || [];
    const id = "ho_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const h = {
        id, de, para,
        contexto, estado_actual,
        pendientes: (pendientes || []).map((p, i) => ({ n: i + 1, tarea: String(p), hecho: false })),
        riesgos: (riesgos || []).map(String),
        artefactos: (artefactos || []).map(String),
        acknowledge: null, estado: "creado",
        creado: new Date().toISOString(),
    };
    st.handoffs.push(h);
    store.save(st);
    const score = [h.contexto.length > 80, h.estado_actual.length > 30, h.pendientes.length > 0, h.riesgos.length > 0, h.artefactos.length > 0].filter(Boolean).length * 20;
    return ok({ handoff_id: id, calidad_preliminar: score + "/100", aviso: score < 60 ? "handoff pobre: el receptor deberá interrumpir con preguntas. Amplía contexto/riesgos" : "handoff aceptable" });
});
server.tool("get_handoff", "Handoff completo con checklist de recepción sugerida.", {
    handoff_id: z.string().describe("ID del handoff"),
}, async (args) => {
    const { handoff_id } = args;
    const st = store.load();
    const h = (st.handoffs || []).find(x => x.id === handoff_id);
    if (!h)
        return fail("handoff no encontrado: " + handoff_id);
    return ok({
        ...h,
        checklist_recepcion: [
            "relee el objetivo y decisiones ya tomadas",
            "verifica artefactos antes de tocarlos",
            ...h.pendientes.map(p => "pendiente " + p.n + ": " + p.tarea),
            ...(h.riesgos.length ? ["pregunta por los riesgos si algo no cuadra"] : []),
        ],
    });
});
server.tool("acknowledge", "El receptor confirma recepción, declara qué entendió y qué preguntas tiene; devuelve los gaps detectados.", {
    handoff_id: z.string().describe("ID del handoff"),
    entendido: z.string().describe("Qué entendió el receptor (sus palabras)"),
    preguntas: z.array(z.any()).describe("Preguntas o ambigüedades detectadas").default([]),
    acepta: z.boolean().describe("false = rechaza el handoff por incompleto").default(true),
}, async (args) => {
    const { handoff_id, entendido, preguntas, acepta } = args;
    const st = store.load();
    const h = (st.handoffs || []).find(x => x.id === handoff_id);
    if (!h)
        return fail("handoff no encontrado");
    if (h.acknowledge)
        return fail("ya hay acknowledge: " + h.acknowledge.ts);
    h.acknowledge = { entendido, preguntas: preguntas || [], acepta, ts: new Date().toISOString() };
    h.estado = acepta ? "aceptado" : "rechazado";
    store.save(st);
    const overlapTokens = entendido.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    const ctxTokens = new Set(h.contexto.toLowerCase().split(/\W+/).filter(w => w.length > 4));
    const eco = overlapTokens.filter(w => ctxTokens.has(w)).length / Math.max(new Set(overlapTokens).size, 1);
    return ok({
        acepta, preguntas_abiertas: (preguntas || []).length,
        fidelidad_comprension: Number(eco.toFixed(2)),
        aviso: (preguntas || []).length > 3 ? "muchas preguntas: el handoff original fue débil, considera transferir de nuevo" : eco < 0.15 ? "el receptor no parafrasea nada del contexto: posible malentendido" : "recepción sana",
    });
});
server.tool("list_handoffs", "Lista handoffs por dirección, estado o agente; marca los huérfanos (sin acknowledge).", {
    agente: z.string().describe("Filtrar de/para este agente").optional(),
    estado: z.string().describe("creado, aceptado, rechazado, cerrado").optional(),
}, async (args) => {
    const { agente, estado } = args;
    const st = store.load();
    let hs = st.handoffs || [];
    if (agente)
        hs = hs.filter(h => h.de === agente || h.para === agente);
    if (estado)
        hs = hs.filter(h => h.estado === estado);
    return ok({
        total: hs.length,
        sin_acknowledge: hs.filter(h => !h.acknowledge).length,
        handoffs: hs.map(h => ({ id: h.id, de: h.de, para: h.para, estado: h.estado, pendientes: h.pendientes.length, ack: !!h.acknowledge, edad_horas: Number(((Date.now() - new Date(h.creado).getTime()) / 3600000).toFixed(1)) })),
    });
});
server.tool("complete_task", "Marca un pendiente del handoff como hecho (quien recibe avanza sin perder rastro).", {
    handoff_id: z.string().describe("ID del handoff"),
    n: z.number().describe("Número del pendiente"),
}, async (args) => {
    const { handoff_id, n } = args;
    const st = store.load();
    const h = (st.handoffs || []).find(x => x.id === handoff_id);
    if (!h)
        return fail("handoff no encontrado");
    const p = h.pendientes.find(x => x.n === n);
    if (!p)
        return fail("pendiente inexistente: " + n + " (hay " + h.pendientes.length + ")");
    p.hecho = true;
    p.completado = new Date().toISOString();
    store.save(st);
    const restantes = h.pendientes.filter(x => !x.hecho).length;
    if (restantes === 0)
        h.estado = "cerrado", store.save(st);
    return ok({ pendiente: p.tarea, hecho: true, restantes, estado_handoff: h.estado });
});
server.tool("handoff_quality", "Audita un handoff: completitud de secciones, densidad de contexto, riesgos declarados y resultado del acknowledge.", {
    handoff_id: z.string().describe("ID del handoff"),
}, async (args) => {
    const { handoff_id } = args;
    const st = store.load();
    const h = (st.handoffs || []).find(x => x.id === handoff_id);
    if (!h)
        return fail("handoff no encontrado");
    const secciones = {
        contexto: h.contexto.length > 80 ? 20 : h.contexto.length / 4,
        estado: h.estado_actual.length > 30 ? 20 : h.estado_actual.length * 2 / 3,
        pendientes: Math.min(h.pendientes.length * 7, 20),
        riesgos: Math.min(h.riesgos.length * 10, 20),
        artefactos: Math.min(h.artefactos.length * 10, 20),
    };
    const total = Math.round(__vals(secciones).reduce((a, b) => a + b, 0));
    const penal = h.acknowledge && !h.acknowledge.acepta ? 20 : (h.acknowledge?.preguntas?.length || 0) * 3;
    const final = Math.max(0, total - penal);
    return ok({
        score: final + "/100",
        desglose: Object.fromEntries(__ents(secciones).map(([k, v]) => [k, Math.round(v) + "/20"])),
        penalizacion_por_preguntas: penal,
        veredicto: final >= 80 ? "handoff sólido" : final >= 50 ? "aceptable con huecos" : "handoff deficiente: transfere de nuevo antes de trabajar",
    });
});
server.tool("handoff_stats", "Estadísticas de transferencias: ratio de aceptación, preguntas medias, huérfanos y tiempo hasta acknowledge.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const hs = st.handoffs || [];
    if (!hs.length)
        return ok({ total: 0 });
    const acks = hs.filter(h => h.acknowledge);
    return ok({
        total: hs.length,
        aceptados: acks.filter(h => h.acknowledge.acepta).length,
        rechazados: acks.filter(h => !h.acknowledge.acepta).length,
        huerfanos_sin_ack: hs.length - acks.length,
        preguntas_medias: acks.length ? Number((acks.reduce((s, h) => s + h.acknowledge.preguntas.length, 0) / acks.length).toFixed(1)) : null,
        minutos_hasta_ack_medio: acks.length ? Number((acks.reduce((s, h) => s + (new Date(h.acknowledge.ts).getTime() - new Date(h.creado).getTime()), 0) / acks.length / 60000).toFixed(1)) : null,
    });
});
server.tool("health_check", "Verifica que el servidor handoff-protocol está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "handoff-protocol", tools: 8, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[handoff-protocol] fatal:", e);
    process.exit(1);
});

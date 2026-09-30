#!/usr/bin/env node
/**
 * MCP Server: Quote Negotiator
 * Protocolo de oferta y contraoferta con precio de reserva, BATNA y concesiones decrecientes
 *
 * Dolor que resuelve: Dos agentes 'negocian' intercambiando números sin estructura: sin precio de reserva, sin alternativa de respaldo, sin estrategia de concesión. Uno acaba aceptando cualquier cosa o los dos en bucle infinito.
 * Categoría: Comercio A2A | Generado por mcp-suite | id: quote-negotiator
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
// ——— persistencia local: ~/.mcp-suite/quote-negotiator/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "quote-negotiator");
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
const server = new McpServer({ name: "quote-negotiator", version: "1.0.0" });
server.tool("create_negotiation", "Crea una negociación sobre un asunto con tus límites y tu alternativa (BATNA).", {
    asunto: z.string().describe("Qué se negocia (precio, plazo, SLA, alcance)"),
    mi_reserva: z.number().describe("Tu límite: peor valor que aceptarías"),
    mi_objetivo: z.number().describe("Valor ideal que buscas"),
    batna: z.string().describe("Tu mejor alternativa si no hay acuerdo").optional(),
    direccion: z.enum(["comprador", "vendedor"]).describe("Compras (prefieres BAJO) o vendes (prefieres ALTO)"),
}, async (args) => {
    const { asunto, mi_reserva, mi_objetivo, batna, direccion } = args;
    const st = store.load();
    st.negociaciones = st.negociaciones || [];
    const id = "neg_" + String(st.negociaciones.length + 1).padStart(4, "0");
    if (direccion === "comprador" && mi_objetivo > mi_reserva)
        return fail("como COMPRADOR tu objetivo (" + mi_objetivo + ") debe ser MENOR que tu reserva (" + mi_reserva + ")");
    if (direccion === "vendedor" && mi_objetivo < mi_reserva)
        return fail("como VENDEDOR tu objetivo (" + mi_objetivo + ") debe ser MAYOR que tu reserva (" + mi_reserva + ")");
    st.negociaciones.push({ id, asunto, mi_reserva, mi_objetivo, batna: batna || "sin alternativa declarada", direccion, ronda: 0, oferta_contrario: null, historial: [], cerrada: null, creado: new Date().toISOString() });
    store.save(st);
    return ok({ id, asunto, direccion, rango_util: { desde: Math.min(mi_objetivo, mi_reserva), hasta: Math.max(mi_objetivo, mi_reserva) }, batna, siguiente: "espera la oferta contraria y evalúala con evaluate_offer" });
});
server.tool("submit_offer", "Registra la oferta recibida de la contraparte.", {
    id: z.string().describe("Id de la negociación"),
    valor: z.number().describe("Valor ofrecido"),
    condiciones: z.string().describe("Condiciones adjuntas (plazo, garantías...)").optional(),
}, async (args) => {
    const { id, valor, condiciones } = args;
    const st = store.load();
    const n = (st.negociaciones || []).find(x => x.id === id);
    if (!n)
        return fail("negociación no encontrada");
    if (n.cerrada)
        return fail("negociación ya cerrada: " + n.cerrada.estado);
    n.ronda++;
    n.oferta_contrario = { valor, condiciones: condiciones || "", ronda: n.ronda, ts: new Date().toISOString() };
    n.historial.push({ ronda: n.ronda, quien: "contrario", valor, condiciones: condiciones || "" });
    store.save(st);
    return ok({ id, ronda: n.ronda, oferta_recibida: valor, siguiente: "evalúala con evaluate_offer antes de responder" });
});
server.tool("evaluate_offer", "Evalúa la oferta contraria contra tu reserva, tu objetivo y tu BATNA con veredicto claro.", {
    id: z.string().describe("Id de la negociación"),
}, async (args) => {
    const { id } = args;
    const st = store.load();
    const n = (st.negociaciones || []).find(x => x.id === id);
    if (!n)
        return fail("negociación no encontrada");
    const o = n.oferta_contrario;
    if (!o)
        return fail("sin oferta contraria registrada");
    const aceptable = n.direccion === "comprador" ? o.valor <= n.mi_reserva : o.valor >= n.mi_reserva;
    const gananciaVsObjetivo = n.direccion === "comprador" ? Number((n.mi_objetivo - o.valor).toFixed(2)) : Number((o.valor - n.mi_objetivo).toFixed(2));
    const margenVsReserva = n.direccion === "comprador" ? Number((n.mi_reserva - o.valor).toFixed(2)) : Number((o.valor - n.mi_reserva).toFixed(2));
    const distanciaReserva = Math.abs(o.valor - n.mi_reserva);
    const sobreMiObjetivo = Math.abs(o.valor - n.mi_objetivo);
    const veredicto = aceptable && gananciaVsObjetivo >= 0 ? "ACEPTA YA: supera tu objetivo" : aceptable ? margenVsReserva > sobreMiObjetivo ? "ACEPTA: dentro de tu reserva con buen margen (" + margenVsReserva + ")" : "ACEPTABLE pero ajustado: " + margenVsReserva + " sobre tu reserva; puedes intentar una última mejora" : distanciaReserva / Math.max(Math.abs(n.mi_reserva), 1) < 0.1 ? "CERCA: a " + Number((distanciaReserva / Math.max(Math.abs(n.mi_reserva), 1) * 100).toFixed(1)) + "% de tu reserva: contraoferta estrecha puede cerrar" : "RECHAZA/CONTRAOFERTA: fuera de tu reserva por " + distanciaReserva.toFixed(2) + "; si no ceden, tu BATNA es: " + n.batna;
    return ok({ id, ronda: n.ronda, oferta: o.valor, condiciones: o.condiciones, aceptable_para_mi: aceptable, margen_sobre_reserva: margenVsReserva, vs_objetivo: gananciaVsObjetivo, veredicto, batna_si_falla: n.batna });
});
server.tool("counter_offer", "Genera tu contraoferta con concesión decreciente según la ronda (estrategia estándar de negociación).", {
    id: z.string().describe("Id de la negociación"),
    ajuste_manual: z.number().describe("Si prefieres fijar tú el valor, ignora la estrategia").optional(),
}, async (args) => {
    const { id, ajuste_manual } = args;
    const st = store.load();
    const n = (st.negociaciones || []).find(x => x.id === id);
    if (!n)
        return fail("negociación no encontrada");
    const o = n.oferta_contrario;
    if (!o)
        return fail("sin oferta contraria: no puedes contraofertar aún");
    let propuesta;
    if (ajuste_manual !== undefined && ajuste_manual !== null) {
        propuesta = ajuste_manual;
        const valida = n.direccion === "comprador" ? propuesta <= n.mi_reserva : propuesta >= n.mi_reserva;
        if (!valida)
            return fail("tu contraoferta manual (" + propuesta + ") viola tu propia reserva (" + n.mi_reserva + "): no la envíes");
    }
    else {
        const paso = Math.abs(n.mi_objetivo - n.mi_reserva);
        const factor = Math.pow(0.55, Math.max(0, n.ronda - 1));
        const cede = paso * factor;
        propuesta = n.direccion === "comprador" ? Math.min(n.mi_reserva, n.mi_objetivo + cede) : Math.max(n.mi_reserva, n.mi_objetivo - cede);
        propuesta = Number(propuesta.toFixed(2));
    }
    n.historial.push({ ronda: n.ronda + 1, quien: "yo", valor: propuesta });
    store.save(st);
    return ok({ id, ronda: n.ronda, contraoferta: propuesta, estrategia: ajuste_manual !== undefined && ajuste_manual !== null ? "manual (validada contra reserva)" : "concesión decreciente factor 0.55: cedes menos en cada ronda", margen_restante: Number(Math.abs(propuesta - n.mi_reserva).toFixed(2)), aviso_ronda: n.ronda >= 5 ? "ronda 5+: evalúa si tu BATNA ya es mejor que seguir cediendo" : null });
});
server.tool("close_negotiation", "Cierra la negociación con acuerdo (valor final) o ruptura (a BATNA).", {
    id: z.string().describe("Id de la negociación"),
    resultado: z.enum(["acuerdo", "ruptura"]).describe("Resultado"),
    valor_final: z.number().describe("Valor acordado (si acuerdo)").optional(),
    nota: z.string().describe("Nota de cierre").optional(),
}, async (args) => {
    const { id, resultado, valor_final, nota } = args;
    const st = store.load();
    const n = (st.negociaciones || []).find(x => x.id === id);
    if (!n)
        return fail("negociación no encontrada");
    if (n.cerrada)
        return fail("ya cerrada");
    if (resultado === "acuerdo" && (valor_final === undefined || valor_final === null))
        return fail("un acuerdo necesita valor_final");
    const dentroReserva = resultado === "ruptura" ? null : n.direccion === "comprador" ? valor_final <= n.mi_reserva : valor_final >= n.mi_reserva;
    n.cerrada = { estado: resultado, valor_final: valor_final ?? null, dentro_de_reserva: dentroReserva, rondas: n.ronda, nota: nota || "", ts: new Date().toISOString() };
    store.save(st);
    return ok({ id, cerrada: n.cerrada, resultado_para_mi: resultado === "acuerdo" ? (dentroReserva ? "acuerdo VÁLIDO: dentro de tu reserva" : "acuerdo PELIGROSO: violó tu reserva (" + n.mi_reserva + "), revisa por qué aceptaste") : "ruptura: activa tu BATNA -> " + n.batna, rondas_usadas: n.ronda });
});
server.tool("health_check", "Verifica que el servidor quote-negotiator está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "quote-negotiator", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[quote-negotiator] fatal:", e);
    process.exit(1);
});

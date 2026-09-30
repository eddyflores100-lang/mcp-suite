#!/usr/bin/env node
/**
 * MCP Server: Dispute Resolver
 * Carpeta de disputas con evidencias ponderadas, posiciones enfrentadas y vías de resolución propuestas
 *
 * Dolor que resuelve: Cuando dos agentes discrepan (entrega mala, dato incorrecto, pago no reflejado) no hay dónde registrar la disputa con estructura: la 'resolución' es un pulso de quién insiste más, sin evidencia ni trazabilidad.
 * Categoría: Comercio A2A | Generado por mcp-suite | id: dispute-resolver
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
// ——— persistencia local: ~/.mcp-suite/dispute-resolver/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "dispute-resolver");
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
const server = new McpServer({ name: "dispute-resolver", version: "1.0.0" });
server.tool("open_case", "Abre una disputa estructurada: quién, contra quién, qué se exige y bajo qué acuerdo.", {
    reclamante: z.string().describe("Agente que reclama"),
    reclamado: z.string().describe("Agente reclamado"),
    pretension: z.string().describe("Qué se exige exactamente (reembolso, corrección, entrega, disculpa)"),
    acuerdo_violado: z.string().describe("Acuerdo/contrato/término supuestamente incumplido"),
    monto_en_juego: z.number().describe("Valor económico implicado si aplica (0 si no)").default(0),
}, async (args) => {
    const { reclamante, reclamado, pretension, acuerdo_violado, monto_en_juego } = args;
    const st = store.load();
    st.casos = st.casos || [];
    const id = "dsp_" + String(st.casos.length + 1).padStart(4, "0");
    st.casos.push({ id, reclamante, reclamado, pretension, acuerdo_violado, monto_en_juego, estado: "ABIERTO", evidencias: [], propuesta_resolucion: null, creado: new Date().toISOString() });
    store.save(st);
    return ok({ id, estado: "ABIERTO", siguiente: "aporta evidencia con add_evidence (ambas partes pueden)" });
});
server.tool("add_evidence", "Añade evidencia a la disputa: qué demuestra, quién la aporta y su fuerza.", {
    id: z.string().describe("Id de la disputa"),
    parte: z.string().describe("Parte que la aporta"),
    demuestra: z.string().describe("Qué hecho concreto demuestra"),
    tipo: z.enum(["documento", "log", "captura", "testimonio", "metrica", "contrato"]).describe("Naturaleza de la evidencia"),
    peso: z.enum(["debil", "media", "fuerte"]).describe("Fuerza probatoria").default("media"),
}, async (args) => {
    const { id, parte, demuestra, tipo, peso } = args;
    const st = store.load();
    const c = (st.casos || []).find(x => x.id === id);
    if (!c)
        return fail("disputa no encontrada: " + id);
    if (c.estado !== "ABIERTO")
        return fail("disputa ya resuelta");
    c.evidencias.push({ parte, demuestra, tipo, peso, ts: new Date().toISOString() });
    store.save(st);
    return ok({ id, evidencias: c.evidencias.length, recuento_por_parte: c.evidencias.reduce((acc, e) => { acc[e.parte] = (acc[e.parte] || 0) + 1; return acc; }, {}) });
});
server.tool("analyze_positions", "Analiza el equilibrio probatorio: peso por parte, hechos no disputados y qué falta demostrar.", {
    id: z.string().describe("Id de la disputa"),
}, async (args) => {
    const { id } = args;
    const st = store.load();
    const c = (st.casos || []).find(x => x.id === id);
    if (!c)
        return fail("disputa no encontrada");
    if (!c.evidencias.length)
        return fail("sin evidencias: añade con add_evidence");
    const pesos = { fuerte: 3, media: 2, debil: 1 };
    const porParte = {};
    c.evidencias.forEach(e => { porParte[e.parte] = (porParte[e.parte] || 0) + (pesos[e.peso] || 2); });
    const partes = [c.reclamante, c.reclamado];
    const pR = porParte[c.reclamante] || 0, pD = porParte[c.reclamado] || 0;
    const ventaja = pR > pD * 1.5 ? "claramente " + c.reclamante : pD > pR * 1.5 ? "claramente " + c.reclamado : "equilibrada";
    const tiposPresentes = [...new Set(c.evidencias.map(e => e.tipo))];
    const faltaContractual = !tiposPresentes.includes("contrato");
    const faltaMetrica = c.pretension.toLowerCase().includes("reem") || c.pretension.toLowerCase().includes("monto") ? !tiposPresentes.includes("metrica") : false;
    return ok({ id, peso_por_parte: porParte, ventaja_probatoria: ventaja, ratio: pR + ":" + pD, evidencias_totales: c.evidencias.length, tipos_presentes: tiposPresentes, huecos: { sin_prueba_del_acuerdo: faltaContractual ? "nadie aportó el contrato/acuerdo original: pídelo antes de decidir" : null, sin_cuantificacion: faltaMetrica ? "la pretensión es económica y no hay métrica que la cuantifique" : null }, lectura: "la pretensión '" + c.pretension.slice(0, 80) + "' requiere que " + c.reclamante + " demuestre el daño y que " + c.reclamado + " demuestre cumplimiento o fuerza mayor" });
});
server.tool("propose_resolution", "Propone la vía de cierre más eficiente según monto, equilibrio probatorio y coste de escalado.", {
    id: z.string().describe("Id de la disputa"),
}, async (args) => {
    const { id } = args;
    const st = store.load();
    const c = (st.casos || []).find(x => x.id === id);
    if (!c)
        return fail("disputa no encontrada");
    const pesos = { fuerte: 3, media: 2, debil: 1 };
    const pR = c.evidencias.filter(e => e.parte === c.reclamante).reduce((a, e) => a + (pesos[e.peso] || 2), 0);
    const pD = c.evidencias.filter(e => e.parte === c.reclamado).reduce((a, e) => a + (pesos[e.peso] || 2), 0);
    const vias = [
        { via: "acuerdo_directo", coste: 1, requiere: "ambas partes aceptan una lectura compartible de los hechos", aplica: Math.abs(pR - pD) <= 2 || c.evidencias.length <= 3 },
        { via: "mediacion_tercero", coste: 3, requiere: "un tercer agente neutral propuesto por ambos", aplica: Math.abs(pR - pD) > 2 && c.evidencias.length > 3 },
        { via: "reembolso_parcial_sin_reconocer_culpa", coste: Math.min(c.monto_en_juego * 0.5, 10), requiere: "el monto (" + c.monto_en_juego + ") hace más caro discutir que pagar", aplica: c.monto_en_juego > 0 && c.monto_en_juego < 50 },
        { via: "arbitraje_vinculante", coste: 10 + c.monto_en_juego * 0.05, requiere: "acuerdo de arbitraje previo", aplica: c.monto_en_juego >= 50 }
    ];
    const aplicables = vias.filter(v => v.aplica).sort((a, b) => a.coste - b.coste);
    if (!aplicables.length)
        aplicables.push({ via: "escalado_humano", coste: 999, requiere: "operador humano revisa el expediente", aplica: true });
    c.propuesta_resolucion = { via_recomendada: aplicables[0].via, ts: new Date().toISOString() };
    store.save(st);
    return ok({ id, vias_ordenadas_por_coste: aplicables, recomendada: aplicables[0].via, razon: "coste total estimado " + Number(aplicables[0].coste.toFixed(2)) + " frente a monto en juego " + c.monto_en_juego, expediente: { evidencias: c.evidencias.length, pretension: c.pretension } });
});
server.tool("close_case", "Cierra la disputa con la resolución aplicada y lecciones extraídas.", {
    id: z.string().describe("Id de la disputa"),
    resolucion: z.string().describe("Cómo se resolvió de verdad"),
    satisface_a: z.enum(["reclamante", "reclamado", "ambos", "ninguno"]).describe("Quien queda satisfecho"),
    leccion: z.string().describe("Qué cambiar para evitar repetir esta disputa").optional(),
}, async (args) => {
    const { id, resolucion, satisface_a, leccion } = args;
    const st = store.load();
    const c = (st.casos || []).find(x => x.id === id);
    if (!c)
        return fail("disputa no encontrada");
    if (c.estado !== "ABIERTO")
        return fail("ya cerrada");
    c.estado = "CERRADO";
    c.cierre = { resolucion, satisface_a, leccion: leccion || "", dias_abierto: Number(((Date.now() - new Date(c.creado).getTime()) / 86400000).toFixed(2)), ts: new Date().toISOString() };
    store.save(st);
    const patrones = (st.casos || []).filter(x => x.cierre && x.acuerdo_violado === c.acuerdo_violado).length;
    return ok({ id, cerrada: true, satisface_a, dias_abierto: c.cierre.dias_abierto, patrón_detectado: patrones > 1 ? "esta es la disputa #" + patrones + " sobre el mismo tipo de acuerdo: cambia el acuerdo de raíz" : "primera disputa de este tipo" });
});
server.tool("health_check", "Verifica que el servidor dispute-resolver está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "dispute-resolver", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[dispute-resolver] fatal:", e);
    process.exit(1);
});

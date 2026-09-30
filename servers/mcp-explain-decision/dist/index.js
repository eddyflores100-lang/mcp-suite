#!/usr/bin/env node
/**
 * MCP Server: Explain Decision
 * Explica decisiones post-hoc con evidencia: qué sabía, qué opciones descartó y por qué eligió
 *
 * Dolor que resuelve: El agente no puede explicar por qué hizo algo: no conserva qué información tenía, qué alternativas consideró ni qué criterio aplicó. Sin explicación, no hay confianza ni auditoría posible.
 * Categoría: Humano en el Bucle | Generado por mcp-suite | id: explain-decision
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
// ——— persistencia local: ~/.mcp-suite/explain-decision/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "explain-decision");
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
const server = new McpServer({ name: "explain-decision", version: "1.0.0" });
server.tool("record_decision", "Registra una decisión con su contexto completo (evidencia, opciones, criterio, elegida).", {
    decision: z.string().describe("Decisión tomada"),
    situacion: z.string().describe("Situación que la motivó"),
    evidencia: z.array(z.any()).describe("Datos/hechos en los que se basó"),
    opciones_consideradas: z.array(z.any()).describe("Alternativas evaluadas"),
    criterio: z.string().describe("Criterio de elección"),
    elegida_porque: z.string().describe("Por qué ganó la elegida"),
    resultado_esperado: z.string().describe("Qué se espera que ocurra"),
}, async (args) => {
    const { decision, situacion, evidencia, opciones_consideradas, criterio, elegida_porque, resultado_esperado } = args;
    const st = store.load();
    st.decisiones = st.decisiones || [];
    const d = {
        id: "dc_" + Date.now().toString(36),
        decision, situacion, evidencia: evidencia || [], opciones: opciones_consideradas || [], criterio, elegida_porque, resultado_esperado,
        resultado_real: null, ts: new Date().toISOString(),
    };
    st.decisiones.push(d);
    if (st.decisiones.length > 500)
        st.decisiones = st.decisiones.slice(-300);
    store.save(st);
    return ok({ decision_id: d.id, registrada: true, verificable: "registra el resultado real luego para calibrar el criterio" });
});
server.tool("explain", "Reconstruye la explicación completa de una decisión (para auditoría o pregunta del humano).", {
    decision_id: z.string().describe("ID de la decisión"),
}, async (args) => {
    const { decision_id } = args;
    const st = store.load();
    const d = (st.decisiones || []).find(x => x.id === decision_id);
    if (!d)
        return fail("decisión no encontrada");
    return ok({
        explicacion: [
            "DECISIÓN: " + d.decision,
            "SITUACIÓN: " + d.situacion,
            "EVIDENCIA QUE TENÍA: " + (d.evidencia.length ? d.evidencia.map((e, i) => (i + 1) + ". " + e).join("; ") : "(sin evidencia explícita registrada)"),
            "OPCIONES CONSIDERADAS: " + (d.opciones.length ? d.opciones.join(" | ") : "(solo una camino considerado)"),
            "CRITERIO: " + d.criterio,
            "POR QUÉ LA ELEGIDA: " + d.elegida_porque,
            "RESULTADO ESPERADO: " + d.resultado_esperado,
            "RESULTADO REAL: " + (d.resultado_real || "pendiente de registrar"),
        ],
        bandera_auditoria: d.evidencia.length < 2 ? "DECISIÓN CON EVIDENCIA DÉBIL (menos de 2 soportes): era una corazonada" : d.opciones.length < 2 ? "SIN ALTERNATIVAS EVALUADAS: se tomó el primer camino" : "decisión bien soportada",
    });
});
server.tool("record_outcome", "Registra el resultado real de la decisión y califica el criterio (acertó o no).", {
    decision_id: z.string().describe("ID de la decisión"),
    resultado_real: z.string().describe("Qué pasó realmente"),
    acierto: z.boolean().describe("¿El criterio acertó?"),
}, async (args) => {
    const { decision_id, resultado_real, acierto } = args;
    const st = store.load();
    const d = (st.decisiones || []).find(x => x.id === decision_id);
    if (!d)
        return fail("decisión no encontrada");
    d.resultado_real = resultado_real;
    d.acierto = acierto;
    store.save(st);
    return ok({ decision: d.id, acierto });
});
server.tool("decision_audit", "Auditoría de decisiones: tasa de acierto del criterio y patrones de decisiones mal soportadas.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ds = st.decisiones || [];
    if (!ds.length)
        return ok({ decisiones: 0 });
    const evaluadas = ds.filter(d => d.acierto !== null && d.acierto !== undefined);
    return ok({
        decisiones: ds.length, evaluadas: evaluadas.length,
        tasa_acierto_criterio: evaluadas.length ? Number((evaluadas.filter(d => d.acierto).length / evaluadas.length).toFixed(2)) : null,
        mal_soportadas: ds.filter(d => d.evidencia.length < 2).length,
        sin_alternativas: ds.filter(d => d.opciones.length < 2).length,
        sin_desenlace: ds.length - evaluadas.length,
        veredicto: ds.filter(d => d.evidencia.length < 2).length > ds.length * 0.4 ? "40%+ de decisiones con evidencia débil: exige 2+ soportes antes de decidir" : "disciplina decisional sana",
    });
});
server.tool("health_check", "Verifica que el servidor explain-decision está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "explain-decision", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[explain-decision] fatal:", e);
    process.exit(1);
});

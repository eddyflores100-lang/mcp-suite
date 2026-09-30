#!/usr/bin/env node
/**
 * MCP Server: Compliance Report
 * Reportes de cumplimiento por marco (HIPAA/GDPR/SOX-like): evidencia estructurada para el auditor
 *
 * Dolor que resuelve: Cuando llega la auditoría no hay nada que entregar: los controles existieron 'en teoría' pero no hay evidencia estructurada de qué control aplicó cuándo y con qué resultado.
 * Categoría: Cumplimiento | Generado por mcp-suite | id: compliance-report
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
// ——— persistencia local: ~/.mcp-suite/compliance-report/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "compliance-report");
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
const server = new McpServer({ name: "compliance-report", version: "1.0.0" });
server.tool("define_control", "Define un control de cumplimiento para un marco: qué exige y cómo se satisface.", {
    marco: z.enum(["gdpr", "hipaa", "sox", "iso27001", "interno"]).describe("Marco de referencia"),
    control_id: z.string().describe("Identificador del control (ej: Art.32)"),
    exige: z.string().describe("Qué exige el control"),
    como_se_cumple: z.string().describe("Cómo lo cubre el agente/sistema"),
}, async (args) => {
    const { marco, control_id, exige, como_se_cumple } = args;
    const st = store.load();
    st.controles = st.controles || [];
    if (st.controles.some(c => c.marco === marco && c.control_id === control_id))
        return fail("control ya definido en " + marco);
    st.controles.push({ marco, control_id, exige, como_se_cumple, estado: "declarado", evidencias: [], ts: new Date().toISOString() });
    store.save(st);
    return ok({ marco, control: control_id, estado: "declarado" });
});
server.tool("attach_evidence", "Adjunta evidencia a un control (prueba de que se aplicó) y actualiza su estado.", {
    marco: z.string().describe("Marco"),
    control_id: z.string().describe("Control"),
    evidencia: z.string().describe("Evidencia (log, artefacto, test)"),
    estado: z.enum(["implementado", "parcial", "faltante"]).describe("Estado resultante").default("implementado"),
}, async (args) => {
    const { marco, control_id, evidencia, estado } = args;
    const st = store.load();
    const c = (st.controles || []).find(x => x.marco === marco && x.control_id === control_id);
    if (!c)
        return fail("control no definido: usa define_control primero");
    c.evidencias.push({ evidencia, ts: new Date().toISOString() });
    c.estado = estado;
    store.save(st);
    return ok({ marco, control: control_id, evidencias: c.evidencias.length, estado: c.estado });
});
server.tool("generate_report", "Genera el reporte de cumplimiento de un marco: cobertura, controles sin evidencia y brechas.", {
    marco: z.string().describe("Marco a reportar (o 'todos')"),
}, async (args) => {
    const { marco } = args;
    const st = store.load();
    let cs = st.controles || [];
    if (marco !== "todos")
        cs = cs.filter(c => c.marco === marco);
    if (!cs.length)
        return fail("sin controles definidos para " + marco);
    const implementados = cs.filter(c => c.estado === "implementado" && c.evidencias.length > 0);
    const sinEvidencia = cs.filter(c => c.estado !== "implementado" || c.evidencias.length === 0);
    return ok({
        marco: marco === "todos" ? "todos" : marco,
        controles: cs.length,
        cobertura_pct: Math.round(implementados.length / cs.length * 100),
        implementados_con_evidencia: implementados.length,
        brechas: sinEvidencia.map(c => ({ control: c.control_id, exige: c.exige.slice(0, 80), estado: c.estado, evidencias: c.evidencias.length })),
        veredicto: sinEvidencia.length === 0 ? "listo para auditoría: todos los controles con evidencia" : "NO entregues esto a un auditor: " + sinEvidencia.length + " controles sin evidencia real",
        nota: "la evidencia debe generarse DURANTE la operación (logs, decisiones de policy-as-code), no fabricarse después",
    });
});
server.tool("gap_plan", "Plan de cierre de brechas: qué controlar primero según criticidad del control.", {
    marco: z.string().describe("Marco").default("todos"),
}, async (args) => {
    const { marco } = args;
    const st = store.load();
    let cs = st.controles || [];
    if (marco !== "todos")
        cs = cs.filter(c => c.marco === marco);
    const brechas = cs.filter(c => c.estado !== "implementado" || c.evidencias.length === 0);
    if (!brechas.length)
        return ok({ brechas: 0, mensaje: "sin brechas: cobertura completa" });
    const CRITICO = /(32|seguridad|seguridad|encript|cifrad|acceso|consentimiento|brecha|notificación|notificacion)/i;
    const priorizadas = brechas.map(b => ({
        marco: b.marco, control: b.control_id, exige: b.exige.slice(0, 70),
        criticidad: CRITICO.test(b.control_id + " " + b.exige) ? "alta" : "media",
        accion: "implementa el control Y su generación de evidencia simultáneamente",
    })).sort((a, b) => (a.criticidad === "alta" ? 0 : 1) - (b.criticidad === "alta" ? 0 : 1));
    return ok({ brechas: brechas.length, plan: priorizadas, primero: priorizadas[0]?.control });
});
server.tool("health_check", "Verifica que el servidor compliance-report está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "compliance-report", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[compliance-report] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Requirements Matrix
 * Trazabilidad requisito → tarea → evidencia: nada se pierde entre lo pedido y lo entregado
 *
 * Dolor que resuelve: Sin trazabilidad, requisitos se pierden en el camino: el agente los olvida, las tareas derivan y al final nadie puede demostrar que cada requisito pedido tiene evidencia de cumplimiento.
 * Categoría: Especificación y Requisitos | Generado por mcp-suite | id: requirements-matrix
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
// ——— persistencia local: ~/.mcp-suite/requirements-matrix/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "requirements-matrix");
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
const server = new McpServer({ name: "requirements-matrix", version: "1.0.0" });
server.tool("add_requirement", "Añade un requisito rastrible al backlog de la misión.", {
    requisito: z.string().describe("Texto del requisito"),
    fuente: z.string().describe("Quién lo pidió y cuándo").optional(),
}, async (args) => {
    const { requisito, fuente } = args;
    const st = store.load();
    st.reqs = st.reqs || [];
    const id = "R" + (st.reqs.length + 1).toString().padStart(3, "0");
    st.reqs.push({ id, requisito, fuente: fuente || null, tareas: [], evidencia: null, estado: "abierto", creado: new Date().toISOString() });
    store.save(st);
    return ok({ requisito_id: id, total: st.reqs.length });
});
server.tool("link_task", "Liga una tarea a un requisito (la tarea sirve a ese requisito).", {
    requisito_id: z.string().describe("ID del requisito (R001)"),
    tarea: z.string().describe("Descripción de la tarea"),
}, async (args) => {
    const { requisito_id, tarea } = args;
    const st = store.load();
    const r = (st.reqs || []).find(x => x.id === requisito_id);
    if (!r)
        return fail("requisito no encontrado: " + requisito_id);
    r.tareas.push({ tarea, estado: "pendiente", ts: new Date().toISOString() });
    store.save(st);
    return ok({ requisito: r.id, tareas_ligadas: r.tareas.length });
});
server.tool("complete_task", "Marca una tarea ligada como hecha; avanza el estado del requisito.", {
    requisito_id: z.string().describe("ID del requisito"),
    tarea: z.string().describe("Texto (prefijo) de la tarea a cerrar"),
}, async (args) => {
    const { requisito_id, tarea } = args;
    const st = store.load();
    const r = (st.reqs || []).find(x => x.id === requisito_id);
    if (!r)
        return fail("requisito no encontrado");
    const t = r.tareas.find(x => x.tarea.startsWith(tarea.slice(0, 30)) && x.estado !== "hecha");
    if (!t)
        return fail("tarea no encontrada o ya hecha");
    t.estado = "hecha";
    t.hecha_ts = new Date().toISOString();
    store.save(st);
    return ok({ tarea: t.tarea.slice(0, 70), restantes: r.tareas.filter(x => x.estado !== "hecha").length });
});
server.tool("attach_evidence", "Adjunta evidencia de cumplimiento a un requisito y márcalo cubierto.", {
    requisito_id: z.string().describe("ID del requisito"),
    evidencia: z.string().describe("Evidencia (test, URL, salida, revisión)"),
}, async (args) => {
    const { requisito_id, evidencia } = args;
    const st = store.load();
    const r = (st.reqs || []).find(x => x.id === requisito_id);
    if (!r)
        return fail("requisito no encontrado");
    if (r.tareas.length === 0)
        return ok({ advertencia: "requisito SIN tareas: la evidencia no tiene trabajo trazado detrás", requisito: r.id });
    r.evidencia = evidencia;
    r.estado = "cubierto";
    store.save(st);
    return ok({ requisito: r.id, estado: "cubierto", evidencia: evidencia.slice(0, 90) });
});
server.tool("trace_report", "Reporte de trazabilidad: cobertura, huérfanos (requisito sin tarea, tarea sin requisito) y % verificado.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const reqs = st.reqs || [];
    if (!reqs.length)
        return ok({ requisitos: 0 });
    const huerfanosReq = reqs.filter(r => r.tareas.length === 0);
    const cubiertos = reqs.filter(r => r.estado === "cubierto");
    return ok({
        requisitos: reqs.length,
        cubiertos_con_evidencia: cubiertos.length,
        cobertura_pct: Math.round(cubiertos.length / reqs.length * 100),
        requisitos_huerfanos_sin_tareas: huerfanosReq.map(r => ({ id: r.id, requisito: r.requisito.slice(0, 70) })),
        requisitos_sin_evidencia: reqs.filter(r => r.estado !== "cubierto" && r.tareas.length > 0).map(r => ({ id: r.id, tareas_hechas: r.tareas.filter(t => t.estado === "hecha").length + "/" + r.tareas.length })),
        tareas_totales: reqs.reduce((s, r) => s + r.tareas.length, 0),
        veredicto: cubiertos.length === reqs.length ? "trazabilidad completa: cada requisito tiene evidencia" : "faltan " + (reqs.length - cubiertos.length) + " requisitos por evidenciar",
    });
});
server.tool("audit_question", "Responde la pregunta de auditoría: '¿dónde está la evidencia del requisito X?'.", {
    requisito_id: z.string().describe("ID o texto parcial del requisito"),
}, async (args) => {
    const { requisito_id } = args;
    const st = store.load();
    const reqs = st.reqs || [];
    const r = reqs.find(x => x.id.toLowerCase() === String(requisito_id).toLowerCase()) || reqs.find(x => x.requisito.toLowerCase().includes(String(requisito_id).toLowerCase()));
    if (!r)
        return fail("requisito no encontrado");
    return ok({
        requisito: r.id, texto: r.requisito, fuente: r.fuente,
        tareas_trazadas: r.tareas.map(t => ({ tarea: t.tarea.slice(0, 70), estado: t.estado })),
        evidencia: r.evidencia || "SIN EVIDENCIA: no se puede auditar el cumplimiento",
    });
});
server.tool("health_check", "Verifica que el servidor requirements-matrix está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "requirements-matrix", tools: 7, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[requirements-matrix] fatal:", e);
    process.exit(1);
});

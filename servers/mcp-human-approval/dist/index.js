#!/usr/bin/env node
/**
 * MCP Server: Human Approval
 * Flujo de aprobación humana: solicitudes, vencimientos y registro
 *
 * Dolor que resuelve: Las acciones críticas se ejecutan sin visto bueno: human-in-the-loop es promesa, no práctica.
 * Categoría: Comunicación y Humano | Generado por mcp-suite | id: human-approval
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
// ——— persistencia local: ~/.mcp-suite/human-approval/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "human-approval");
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
const server = new McpServer({ name: "human-approval", version: "1.0.0" });
server.tool("request_approval", "Solicita aprobación para una acción: contexto, riesgo y qué pasa si no se aprueba. Vence en N horas.", {
    accion: z.string().describe("Acción que requiere aprobación"),
    contexto: z.string().describe("Por qué se propone"),
    riesgo_si_rechaza: z.string().describe("Riesgo de NO aprobar").optional(),
    vence_horas: z.number().describe("Vencimiento en horas").default(24),
}, async (args) => {
    const { accion, contexto, riesgo_si_rechaza, vence_horas } = args;
    const st = store.load();
    st.aprobaciones = st.aprobaciones || [];
    st.seq = (st.seq || 0) + 1;
    const req = { id: "A" + st.seq, accion, contexto, riesgo_si_rechaza: riesgo_si_rechaza || "", estado: "pendiente", solicitada: new Date().toISOString(), vence: new Date(Date.now() + (vence_horas ?? 24) * 3600000).toISOString() };
    st.aprobaciones.push(req);
    store.save(st);
    return ok({ aprobacion_id: req.id, vence: req.vence, mensaje_para_humano: "APROBACIÓN REQUERIDA: " + accion + "\nContexto: " + contexto + "\nResponde con respond_approval." });
});
server.tool("respond_approval", "Resuelve una aprobación: aprobar, rechazar (con motivo) o pedir más info.", {
    id: z.string().describe("ID de aprobación"),
    decision: z.enum(["aprobar", "rechazar", "mas-info"]).describe("Decisión"),
    motivo: z.string().describe("Motivo").optional(),
}, async (args) => {
    const { id, decision, motivo } = args;
    const st = store.load();
    const req = (st.aprobaciones || []).find((a) => a.id === id);
    if (!req)
        return fail("aprobación no existe");
    if (req.estado !== "pendiente")
        return fail("ya resuelta: " + req.estado);
    req.estado = decision;
    req.motivo = motivo || "";
    req.resuelta = new Date().toISOString();
    store.save(st);
    return ok({ id, estado: decision, accion_autorizada: decision === "aprobar" });
});
server.tool("pending_approvals", "Lista aprobaciones pendientes con sus vencimientos (marca las vencidas).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const pend = (st.aprobaciones || []).filter((a) => a.estado === "pendiente");
    const ahora = new Date();
    return ok({ pendientes: pend.length, vencidas: pend.filter((a) => new Date(a.vence) < ahora).length, items: pend.map((a) => ({ id: a.id, accion: a.accion, vence: a.vence, vencida: new Date(a.vence) < ahora })) });
});
server.tool("health_check", "Verifica que el servidor human-approval está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "human-approval", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[human-approval] fatal:", e);
    process.exit(1);
});

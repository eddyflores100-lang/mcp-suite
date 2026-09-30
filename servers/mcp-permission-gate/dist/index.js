#!/usr/bin/env node
/**
 * MCP Server: Permission Gate
 * Puerta de permisos: operaciones sensibles requieren aprobación explícita
 *
 * Dolor que resuelve: Las tools ejecutan acciones sensibles (borrar, pagar, publicar) sin puerta de aprobación: human-in-the-loop ausente.
 * Categoría: Seguridad | Generado por mcp-suite | id: permission-gate
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
// ——— persistencia local: ~/.mcp-suite/permission-gate/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "permission-gate");
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
const server = new McpServer({ name: "permission-gate", version: "1.0.0" });
server.tool("request", "Solicita permiso para una operación sensible: queda PENDIENTE hasta que el humano apruebe o deniegue.", {
    operacion: z.string().describe("Operación a autorizar"),
    justificacion: z.string().describe("Por qué es necesario"),
    riesgo: z.enum(["bajo", "medio", "alto", "critico"]).describe("Nivel de riesgo").default("medio"),
}, async (args) => {
    const { operacion, justificacion, riesgo } = args;
    const st = store.load();
    st.pendientes = st.pendientes || [];
    const req = { id: "perm-" + Math.random().toString(36).slice(2, 8), operacion, justificacion, riesgo: riesgo || "medio", estado: "pendiente", solicitada: new Date().toISOString() };
    st.pendientes.push(req);
    store.save(st);
    return ok({ permiso_id: req.id, estado: "pendiente", instrucciones: "presenta al humano y llama respond con aprobar=true/deny" });
});
server.tool("respond", "Resuelve una solicitud de permiso (aprobar o denegar) con motivo opcional.", {
    permiso_id: z.string().describe("ID del permiso"),
    aprobar: z.boolean().describe("true=aprobar, false=denegar"),
    motivo: z.string().describe("Motivo de la decisión").optional(),
}, async (args) => {
    const { permiso_id, aprobar, motivo } = args;
    const st = store.load();
    const req = (st.pendientes || []).find((p) => p.id === permiso_id);
    if (!req)
        return fail("permiso no existe");
    if (req.estado !== "pendiente")
        return fail("ya resuelto: " + req.estado);
    req.estado = aprobar ? "aprobado" : "denegado";
    req.motivo = motivo || "";
    req.resuelta = new Date().toISOString();
    st.historial = (st.historial || []).concat(req).slice(-200);
    st.pendientes = st.pendientes.filter((p) => p.id !== permiso_id);
    store.save(st);
    return ok({ permiso_id, estado: req.estado });
});
server.tool("check", "Verifica si una operación está autorizada (busca aprobación vigente ≤ 1 hora para operaciones equivalentes).", {
    operacion: z.string().describe("Operación a verificar"),
}, async (args) => {
    const { operacion } = args;
    const st = store.load();
    const recientes = (st.historial || []).filter((p) => p.operacion === operacion && p.estado === "aprobado" && Date.now() - new Date(p.resuelta).getTime() < 3600000);
    return ok({ autorizado: recientes.length > 0, aprobacion_previa: recientes[0]?.resuelta || null, pendientes: (st.pendientes || []).length });
});
server.tool("health_check", "Verifica que el servidor permission-gate está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "permission-gate", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[permission-gate] fatal:", e);
    process.exit(1);
});

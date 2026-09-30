#!/usr/bin/env node
/**
 * MCP Server: Handoff Notes
 * Notas de traspaso entre agentes/turnos: contexto, estado y pendientes en plantilla estandarizada
 *
 * Dolor que resuelve: El traspaso entre agentes (o turnos) pierde contexto crítico: cada receptor re-descubre todo.
 * Categoría: Comunicación y Humano | Generado por mcp-suite | id: handoff-notes
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
// ——— persistencia local: ~/.mcp-suite/handoff-notes/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "handoff-notes");
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
const server = new McpServer({ name: "handoff-notes", version: "1.0.0" });
server.tool("create_handoff", "Crea una nota de traspaso estandarizada: objetivo, estado actual, pendientes, riesgos, contexto esencial y contactos.", {
    tarea: z.string().describe("Tarea que se traspasa"),
    objetivo: z.string().describe("Objetivo"),
    estado_actual: z.string().describe("Dónde quedó todo"),
    pendientes: z.array(z.any()).describe("Pendientes concretos"),
    riesgos: z.array(z.any()).describe("Riesgos conocidos").optional(),
    contexto: z.string().describe("Contexto esencial (links, decisions)").optional(),
}, async (args) => {
    const { tarea, objetivo, estado_actual, pendientes, riesgos, contexto } = args;
    const st = store.load();
    st.handoffs = st.handoffs || [];
    const h = { id: "HO" + (st.handoffs.length + 1), tarea, objetivo, estado_actual, pendientes: Array.isArray(pendientes) ? pendientes : [], riesgos: Array.isArray(riesgos) ? riesgos : [], contexto: contexto || "", creado: new Date().toISOString() };
    st.handoffs.push(h);
    store.save(st);
    return ok({ handoff_id: h.id });
});
server.tool("render_handoff", "Renderiza la nota de traspaso en markdown listo para pegar al receptor.", {
    id: z.string().describe("ID del handoff"),
}, async (args) => {
    const { id } = args;
    const st = store.load();
    const h = (st.handoffs || []).find((x) => x.id === id);
    if (!h)
        return fail("handoff no existe");
    const md = [
        "# Traspaso: " + h.tarea, "",
        "**Objetivo:** " + h.objetivo, "",
        "## Estado actual", h.estado_actual, "",
        "## Pendientes", ...(h.pendientes.length ? h.pendientes.map((p) => "- [ ] " + p) : ["- nada pendiente"]), "",
        h.riesgos.length ? "## Riesgos" : "", ...(h.riesgos || []).map((r) => "- ⚠ " + r),
        h.contexto ? "## Contexto esencial" : "", h.contexto || "",
        "", "---", "*Creado: " + h.creado + "*",
    ].filter((l) => l !== "").join("\n");
    return ok({ markdown: md, pendientes: h.pendientes.length });
});
server.tool("completeness_check", "Verifica completitud del traspaso: ¿el receptor puede continuar sin preguntar nada?", {
    id: z.string().describe("ID del handoff"),
}, async (args) => {
    const { id } = args;
    const st = store.load();
    const h = (st.handoffs || []).find((x) => x.id === id);
    if (!h)
        return fail("handoff no existe");
    const faltas = [];
    if (!h.objetivo || h.objetivo.length < 20)
        faltas.push("objetivo débil: el receptor no sabrá para qué");
    if (!h.estado_actual || h.estado_actual.length < 40)
        faltas.push("estado actual insuficiente");
    if (!h.pendientes.length)
        faltas.push("sin pendientes: ¿de verdad no queda nada?");
    if (!h.contexto)
        faltas.push("sin contexto esencial: agrega links/decisiones");
    return ok({ completo: faltas.length === 0, faltas, veredicto: faltas.length === 0 ? "listo para traspasar" : "completa antes de traspasar" });
});
server.tool("health_check", "Verifica que el servidor handoff-notes está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "handoff-notes", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[handoff-notes] fatal:", e);
    process.exit(1);
});

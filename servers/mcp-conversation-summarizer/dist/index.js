#!/usr/bin/env node
/**
 * MCP Server: Conversation Summarizer
 * Resumen incremental de conversaciones largas sin perder los compromisos
 *
 * Dolor que resuelve: Al resumir una conversación se pierden decisiones y tareas pendientes: el resumen debe conservar compromisos, no solo tema.
 * Categoría: Memoria y Contexto | Generado por mcp-suite | id: conversation-summarizer
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
// ——— persistencia local: ~/.mcp-suite/conversation-summarizer/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "conversation-summarizer");
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
const server = new McpServer({ name: "conversation-summarizer", version: "1.0.0" });
server.tool("add_message", "Añade un mensaje a la conversación activa (rol + contenido). Se guarda cronológicamente.", {
    rol: z.enum(["user", "assistant", "system", "tool"]).describe("Autor del mensaje"),
    contenido: z.string().describe("Contenido del mensaje"),
}, async (args) => {
    const { rol, contenido } = args;
    const st = store.load();
    st.mensajes = st.mensajes || [];
    st.mensajes.push({ rol, contenido, ts: new Date().toISOString() });
    if (st.mensajes.length > 500)
        st.mensajes = st.mensajes.slice(-500);
    store.save(st);
    return ok({ total_mensajes: st.mensajes.length });
});
server.tool("summarize", "Genera resumen estructurado de la conversación: temas, decisiones detectadas, tareas pendientes y preguntas abiertas. Base perfecta para handoff.", {
    ultimo_n: z.number().describe("Solo los últimos N mensajes").optional(),
}, async (args) => {
    const { ultimo_n } = args;
    const st = store.load();
    const msgs = st.mensajes || [];
    const use = ultimo_n ? msgs.slice(-ultimo_n) : msgs;
    if (!use.length)
        return fail("conversación vacía: add_message primero");
    const texto = use.map((m) => m.rol + ": " + m.contenido).join("\n");
    const decisiones = use.filter((m) => /decid|acuerd|confirm|eleg|vamos con|aprobado|ok,? hagamos/i.test(m.contenido)).map((m) => m.rol + ": " + m.contenido.slice(0, 200));
    const tareas = use.filter((m) => /tarea|pendiente|to.?do|hacer|falta|debo|hay que|pr[oó]ximo paso/i.test(m.contenido)).map((m) => m.contenido.slice(0, 200));
    const preguntas = use.filter((m) => m.contenido.includes("?")).map((m) => m.contenido.slice(0, 150));
    const temas = {};
    for (const m of use)
        for (const w of m.contenido.toLowerCase().split(/\s+/))
            if (w.length > 6)
                temas[w] = (temas[w] || 0) + 1;
    const top_temas = __ents(temas).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
    return ok({ mensajes: use.length, mensajes_totales: msgs.length, temas_principales: top_temas, decisiones: decisiones.slice(0, 10), tareas_detectadas: tareas.slice(0, 10), preguntas_abiertas: preguntas.slice(0, 5), tokens_estimados: Math.ceil(texto.length / 4) });
});
server.tool("reset", "Reinicia la conversación activa (guardando archivo de histórico si confirmar=true).", {
    confirmar: z.boolean().describe("Confirmar reset").default(false),
}, async (args) => {
    const { confirmar } = args;
    if (!confirmar)
        return fail("requiere confirmar=true");
    const st = store.load();
    st.historico = st.historico || [];
    if (st.mensajes?.length)
        st.historico.push({ cerrada: new Date().toISOString(), mensajes: st.mensajes.length });
    st.mensajes = [];
    store.save(st);
    return ok({ reset: true, conversaciones_historicas: st.historico.length });
});
server.tool("health_check", "Verifica que el servidor conversation-summarizer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "conversation-summarizer", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[conversation-summarizer] fatal:", e);
    process.exit(1);
});

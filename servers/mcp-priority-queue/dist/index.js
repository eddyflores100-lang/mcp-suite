#!/usr/bin/env node
/**
 * MCP Server: Priority Queue
 * Cola de prioridades con matriz Eisenhower: urgente vs importante
 *
 * Dolor que resuelve: El agente ataca lo último que llegó (recency bias): sin matriz de prioridades, lo urgente devora lo importante.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: priority-queue
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
// ——— persistencia local: ~/.mcp-suite/priority-queue/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "priority-queue");
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
const server = new McpServer({ name: "priority-queue", version: "1.0.0" });
server.tool("add", "Añade un item con urgencia e importancia (0-10): se clasifica en la matriz Eisenhower automáticamente.", {
    descripcion: z.string().describe("Qué hay que hacer"),
    urgencia: z.number().describe("Urgencia 0-10"),
    importancia: z.number().describe("Importancia 0-10"),
    vence_horas: z.number().describe("Vence en N horas").optional(),
}, async (args) => {
    const { descripcion, urgencia, importancia, vence_horas } = args;
    const st = store.load();
    st.items = st.items || [];
    st.seq = (st.seq || 0) + 1;
    const u = Math.max(0, Math.min(10, urgencia));
    const i = Math.max(0, Math.min(10, importancia));
    const cuadrante = u >= 5 && i >= 5 ? "hacer-ya" : i >= 5 ? "planificar" : u >= 5 ? "delegar" : "eliminar";
    const item = { id: "P" + st.seq, descripcion, urgencia: u, importancia: i, cuadrante, vence: vence_horas ? new Date(Date.now() + vence_horas * 3600000).toISOString() : null, creado: new Date().toISOString() };
    st.items.push(item);
    store.save(st);
    return ok({ item, score: u * 0.6 + i * 0.4 });
});
server.tool("pop", "Saca el item de mayor prioridad (ponderado urgencia 60% / importancia 40%, con penalización por vencido).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const items = st.items || [];
    if (!items.length)
        return ok({ item: null });
    const score = (it) => it.urgencia * 0.6 + it.importancia * 0.4 + (it.vence && new Date(it.vence) < new Date() ? 5 : 0);
    items.sort((a, b) => score(b) - score(a));
    const top = items.shift();
    store.save(st);
    return ok({ item: top, restantes: items.length });
});
server.tool("matrix", "Snapshot de la matriz Eisenhower: items por cuadrante.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const items = st.items || [];
    const cuadrantes = { "hacer-ya": [], "planificar": [], "delegar": [], "eliminar": [] };
    for (const it of items)
        (cuadrantes[it.cuadrante] || cuadrantes.eliminar).push(it.id + " " + it.descripcion.slice(0, 60));
    return ok({ total: items.length, cuadrantes });
});
server.tool("health_check", "Verifica que el servidor priority-queue está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "priority-queue", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[priority-queue] fatal:", e);
    process.exit(1);
});

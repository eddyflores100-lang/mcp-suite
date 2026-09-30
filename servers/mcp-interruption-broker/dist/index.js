#!/usr/bin/env node
/**
 * MCP Server: Interruption Broker
 * Gestiona interrupciones del humano: pausa limpia, preserva estado y replanifica al reanudar
 *
 * Dolor que resuelve: El humano interrumpe al agente a mitad de tarea y el agente o ignora la interrupción o pierde todo el estado: no hay protocolo de pausa que preserve qué estaba haciendo y por dónde iba.
 * Categoría: Humano en el Bucle | Generado por mcp-suite | id: interruption-broker
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
// ——— persistencia local: ~/.mcp-suite/interruption-broker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "interruption-broker");
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
const server = new McpServer({ name: "interruption-broker", version: "1.0.0" });
server.tool("interrupt", "El humano interrumpe: graba snapshot del estado actual del agente y prioriza el nuevo pedido.", {
    razon: z.string().describe("Por qué interrumpe el humano"),
    tarea_en_curso: z.string().describe("Qué estaba haciendo el agente"),
    paso_actual: z.string().describe("Por dónde iba exactamente"),
    siguiente_accion_prevista: z.string().describe("Qué iba a hacer a continuación"),
    nuevo_pedido: z.string().describe("Lo que el humano quiere ahora").optional(),
}, async (args) => {
    const { razon, tarea_en_curso, paso_actual, siguiente_accion_prevista, nuevo_pedido } = args;
    const st = store.load();
    st.interrupciones = st.interrupciones || [];
    const int = { n: st.interrupciones.length + 1, razon, snapshot: { tarea_en_curso, paso_actual, siguiente_accion_prevista }, nuevo_pedido: nuevo_pedido || null, estado: "activa", ts: new Date().toISOString(), reanudada: null };
    st.interrupciones.push(int);
    store.save(st);
    return ok({
        interrupcion_n: int.n,
        snapshot_preservado: true,
        prioridad: nuevo_pedido ? "atender el nuevo pedido PERO no descartes la tarea en curso sin decisión explícita" : "aclarar qué quiere el humano antes de continuar",
    });
});
server.tool("resume", "Reanuda tras la interrupción: devuelve el snapshot y sugiere replanificación si el contexto cambió.", {
    interrupcion_n: z.number().describe("Número de la interrupción a reanudar").optional(),
    contexto_cambio: z.string().describe("Qué cambió durante la interrupción (si algo)").optional(),
}, async (args) => {
    const { interrupcion_n, contexto_cambio } = args;
    const st = store.load();
    const ints = st.interrupciones || [];
    const int = interrupcion_n ? ints.find(i => i.n === interrupcion_n && i.estado === "activa") : [...ints].reverse().find(i => i.estado === "activa");
    if (!int)
        return fail("no hay interrupción activa");
    int.estado = "reanudada";
    int.reanudada = new Date().toISOString();
    store.save(st);
    const replanificar = !!contexto_cambio || !!int.nuevo_pedido;
    return ok({
        interrupcion: int.n,
        snapshot_recuperado: int.snapshot,
        pedido_pendiente_del_humano: int.nuevo_pedido,
        minutos_pausado: Number(((new Date(int.reanudada).getTime() - new Date(int.ts).getTime()) / 60000).toFixed(1)),
        plan: replanificar
            ? ["1. integra el cambio: " + (contexto_cambio || int.nuevo_pedido), "2. decide explícitamente si la tarea en curso sigue siendo válida (scope-guard)", "3. recalcula pasos restantes antes de ejecutar"]
            : ["1. re-valida que el paso actual sigue siendo correcto", "2. continúa desde: " + int.snapshot.siguiente_accion_prevista],
    });
});
server.tool("pending_interruptions", "Lista interrupciones activas (sin reanudar) con su antigüedad.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const activas = (st.interrupciones || []).filter(i => i.estado === "activa");
    return ok({
        activas: activas.length,
        pendientes: activas.map(i => ({ n: i.n, razon: i.razon.slice(0, 70), tarea_congelada: i.snapshot.tarea_en_curso.slice(0, 60), minutos: Number(((Date.now() - new Date(i.ts).getTime()) / 60000).toFixed(0)) })),
        aviso: activas.length > 2 ? "3+ tareas congeladas: el humano está frenando trabajo: pregunta si priorizar o cancelar" : null,
    });
});
server.tool("interruption_stats", "Estadísticas: frecuencia de interrupciones por sesión y motivo dominante.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ints = st.interrupciones || [];
    if (!ints.length)
        return ok({ interrupciones: 0 });
    const motivos = {};
    for (const i of ints) {
        const k = /error|mal|fallo/i.test(i.razon) ? "corrección de rumbo" : /prioridad|urgente|antes/i.test(i.razon) ? "cambio de prioridad" : /pregunta|duda|aclar/i.test(i.razon) ? "consulta" : /idea|mejor|cambio de plan/i.test(i.razon) ? "idea nueva" : "otro";
        motivos[k] = (motivos[k] || 0) + 1;
    }
    return ok({
        interrupciones: ints.length,
        reanudadas: ints.filter(i => i.estado === "reanudada").length,
        abandonadas: ints.filter(i => i.estado !== "activa" && i.estado !== "reanudada").length,
        por_motivo: motivos,
        lectura: __ents(motivos).sort((a, b) => b[1] - a[1])[0][0] + " domina: si es corrección de rumbo, el agente no entendió el objetivo inicial (spec-clarifier)",
    });
});
server.tool("health_check", "Verifica que el servidor interruption-broker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "interruption-broker", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[interruption-broker] fatal:", e);
    process.exit(1);
});

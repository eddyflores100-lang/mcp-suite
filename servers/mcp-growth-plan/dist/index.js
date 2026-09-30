#!/usr/bin/env node
/**
 * MCP Server: Growth Plan
 * Plan de práctica deliberada del agente: debilidades convertidas en ejercicios con progresión y revisión
 *
 * Dolor que resuelve: El agente 'aprende' de sus errores en el sentido de que los vuelve a cometer distinto. Sin convertir debilidades en ejercicios con progresión, la experiencia se acumula como edad, no como habilidad.
 * Categoría: Auto-Mejora | Generado por mcp-suite | id: growth-plan
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
// ——— persistencia local: ~/.mcp-suite/growth-plan/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "growth-plan");
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
const server = new McpServer({ name: "growth-plan", version: "1.0.0" });
server.tool("add_weakness", "Añade una debilidad detectada (con origen trazable).", {
    debilidad: z.string().describe("La debilidad en una frase accionable"),
    origen: z.string().describe("Dónde se detectó (familia de errores, reflexión, incidente)"),
    frecuencia: z.number().describe("Cuántas veces ha pasado").default(1),
}, async (args) => {
    const { debilidad, origen, frecuencia } = args;
    const st = store.load();
    st.debilidades = st.debilidades || [];
    const existe = st.debilidades.find(d => d.debilidad.toLowerCase().slice(0, 40) === debilidad.toLowerCase().slice(0, 40));
    if (existe) {
        existe.frecuencia += frecuencia;
        store.save(st);
        return ok({ id: existe.id, debilidad: existe.debilidad, frecuencia_acumulada: existe.frecuencia, aviso: "debilidad recurrente: prioridad subida automáticamente" });
    }
    st.debilidades.push({ id: "deb_" + String(st.debilidades.length + 1).padStart(3, "0"), debilidad, origen, frecuencia, ejercicios: [], cerrada: false, ts: new Date().toISOString() });
    store.save(st);
    return ok({ id: "deb_" + String(st.debilidades.length).padStart(3, "0"), debilidad: debilidad.slice(0, 80), origen, siguiente: "diseña el ejercicio con plan_practice" });
});
server.tool("plan_practice", "Diseña una unidad de práctica deliberada para una debilidad.", {
    debilidad_id: z.string().describe("Id de la debilidad (deb_001)"),
    ejercicio: z.string().describe("El ejercicio concreto y reproducible"),
    criterio_exito: z.string().describe("Cómo se sabe que se superó (medible)"),
    repeticiones_objetivo: z.number().describe("Éxitos consecutivos para cerrar").default(3),
}, async (args) => {
    const { debilidad_id, ejercicio, criterio_exito, repeticiones_objetivo } = args;
    const st = store.load();
    const d = (st.debilidades || []).find(x => x.id === debilidad_id);
    if (!d)
        return fail("debilidad no encontrada: " + debilidad_id + " (disponibles: " + (st.debilidades || []).filter(x => !x.cerrada).map(x => x.id).join(", ") + ")");
    if (!criterio_exito.includes("/"))
        return fail("el criterio de éxito debe ser MEDIBLE (número/total, %, ms): '" + criterio_exito + "' es una impresión");
    d.ejercicios.push({ ejercicio, criterio_exito, repeticiones_objetivo, exitos_consecutivos: 0, intentos: 0, historial: [] });
    store.save(st);
    return ok({ debilidad_id: d.id, debilidad: d.debilidad.slice(0, 60), ejercicio: ejercicio.slice(0, 80), criterio: criterio_exito, objetivo: repeticiones_objetivo + " éxitos consecutivos", diseño: "práctica DELIBERADA: apunta JUSTO a la debilidad (no a la tarea general) con criterio binario de éxito" });
});
server.tool("log_practice", "Registra un intento de práctica con su resultado contra el criterio.", {
    debilidad_id: z.string().describe("Debilidad"),
    ejercicio_idx: z.number().describe("Índice del ejercicio (1-based)"),
    exito: z.boolean().describe("¿Superó el criterio?"),
    observacion: z.string().describe("Qué pasó exactamente").optional(),
}, async (args) => {
    const { debilidad_id, ejercicio_idx, exito, observacion } = args;
    const st = store.load();
    const d = (st.debilidades || []).find(x => x.id === debilidad_id);
    if (!d)
        return fail("debilidad no encontrada");
    const e = d.ejercicios[ejercicio_idx - 1];
    if (!e)
        return fail("ejercicio no encontrado: hay " + d.ejercicios.length);
    e.intentos++;
    if (exito)
        e.exitos_consecutivos++;
    else
        e.exitos_consecutivos = 0;
    e.historial.push({ exito, observacion: observacion || "", ts: new Date().toISOString() });
    let cerrada = false;
    if (e.exitos_consecutivos >= e.repeticiones_objetivo && !d.cerrada) {
        d.cerrada = true;
        d.cerrada_ts = new Date().toISOString();
        cerrada = true;
    }
    store.save(st);
    return ok({ debilidad_id: d.id, debilidad: d.debilidad.slice(0, 60), intentos: e.intentos, exitos_consecutivos: e.exitos_consecutivos, objetivo: e.repeticiones_objetivo, cerrada: d.cerrada, estado: cerrada ? "DEBILIDAD CERRADA: " + e.repeticiones_objetivo + " éxitos consecutivos alcanzados" : e.exitos_consecutivos === 0 && e.intentos > 3 ? "ESTANCADA: 3+ intentos sin éxito: el ejercicio es demasiado difícil o el criterio está mal puesto: rediséñalo" : "en progresión" });
});
server.tool("progress_review", "Revisión global del plan de crecimiento: qué se cerró, qué se estancó, qué se ignora.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const debs = st.debilidades || [];
    if (!debs.length)
        return ok({ debilidades: 0, mensaje: "sin debilidades registradas: ¿cero defectos o cero honestidad?" });
    const cerradas = debs.filter(d => d.cerrada);
    const activas = debs.filter(d => !d.cerrada);
    const estancadas = activas.filter(d => d.ejercicios.some(e => e.intentos > 3 && e.exitos_consecutivos === 0));
    const sinEjercicio = activas.filter(d => !d.ejercicios.length);
    const prioridad = activas.slice().sort((a, b) => b.frecuencia - a.frecuencia).slice(0, 3);
    return ok({ debilidades: debs.length, cerradas: cerradas.length, activas: activas.length, estancadas: estancadas.map(d => d.id + " " + d.debilidad.slice(0, 50)), sin_plan_de_practica: sinEjercicio.map(d => d.id + " " + d.debilidad.slice(0, 50)), top_prioridad_por_frecuencia: prioridad.map(d => ({ id: d.id, debilidad: d.debilidad.slice(0, 60), veces: d.frecuencia })), lectura: sinEjercicio.length > activas.length / 2 ? "la mayoría de debilidades no tienen ejercicio: reconocer sin entrenar es llorar sin entrenar" : cerradas.length > activas.length ? "más cerradas que abiertas: el plan funciona" : "progresión razonable: ataca las estancadas" });
});
server.tool("health_check", "Verifica que el servidor growth-plan está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "growth-plan", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[growth-plan] fatal:", e);
    process.exit(1);
});

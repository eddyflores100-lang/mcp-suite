#!/usr/bin/env node
/**
 * MCP Server: Time Horizon Planner
 * Planificación por horizontes (hoy / semana / mes) con recalendización explícita
 *
 * Dolor que resuelve: El agente planifica todo como si fuera 'ahora': mezcla lo urgente con lo de dentro de tres semanas, y cuando algo se retrasa, recalendizar a mano es tan caro que no se hace.
 * Categoría: Objetivos y Largo Plazo | Generado por mcp-suite | id: time-horizon-planner
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
// ——— persistencia local: ~/.mcp-suite/time-horizon-planner/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "time-horizon-planner");
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
const server = new McpServer({ name: "time-horizon-planner", version: "1.0.0" });
server.tool("plan_task", "Añade una tarea al plan con horizonte, esfuerzo estimado y dependencias.", {
    tarea: z.string().describe("Descripción de la tarea"),
    horizonte: z.enum(["hoy", "semana", "mes", "trimestre"]).describe("Horizonte temporal"),
    esfuerzo_horas: z.number().describe("Esfuerzo estimado").optional(),
    depende_de: z.array(z.any()).describe("IDs de tareas previas").default([]),
    fecha_objetivo: z.string().describe("Fecha ISO objetivo (opcional)").optional(),
}, async (args) => {
    const { tarea, horizonte, esfuerzo_horas, depende_de, fecha_objetivo } = args;
    const st = store.load();
    st.tareas = st.tareas || [];
    const id = "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    st.tareas.push({ id, tarea, horizonte, esfuerzo: esfuerzo_horas || null, depende_de: depende_de || [], fecha_objetivo: fecha_objetivo || null, estado: "planificada", creada: new Date().toISOString() });
    store.save(st);
    return ok({ tarea_id: id, horizonte, dependencias: (depende_de || []).length });
});
server.tool("horizon_view", "Vista por horizontes: carga de hoy vs semana vs mes, y alerta de sobrecarga de un horizonte.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ts = st.tareas || [];
    if (!ts.length)
        return ok({ plan: "vacío", sugerencia: "añade tareas con plan_task" });
    const grupos = { hoy: [], semana: [], mes: [], trimestre: [] };
    for (const t of ts)
        if (!["hecha", "descartada"].includes(t.estado))
            (grupos[t.horizonte] || grupos.mes).push(t);
    const carga = {};
    for (const [h, lista] of __ents(grupos))
        carga[h] = { tareas: lista.length, horas: lista.reduce((s, t) => s + (t.esfuerzo || 0), 0) };
    return ok({
        carga,
        hoy: grupos.hoy.map(t => ({ id: t.id, tarea: t.tarea.slice(0, 70), estado: t.estado })),
        alertas: [
            ...(carga.hoy.tareas > 6 ? ["más de 6 tareas para HOY: realista es 3-4, mueve el resto a semana"] : []),
            ...(carga.hoy.horas > 8 ? ["hoy suma " + carga.hoy.horas + "h de esfuerzo estimado"] : []),
            ...(carga.hoy.tareas === 0 && (carga.semana.tareas + carga.mes.tareas) > 0 ? ["hoy está vacío pero hay backlog: promueve 1-3 tareas de semana"] : []),
        ],
        backlog: { semana: grupos.semana.length, mes: grupos.mes.length, trimestre: grupos.trimestre.length },
    });
});
server.tool("promote", "Promueve una tarea al horizonte inmediato superior (trimestre→mes→semana→hoy) validando dependencias.", {
    tarea_id: z.string().describe("ID de la tarea"),
}, async (args) => {
    const { tarea_id } = args;
    const st = store.load();
    const t = (st.tareas || []).find(x => x.id === tarea_id);
    if (!t)
        return fail("tarea no encontrada");
    const orden = { hoy: 0, semana: 1, mes: 2, trimestre: 3 };
    if (orden[t.horizonte] === 0)
        return fail("ya está en 'hoy': no hay horizonte más inmediato");
    const pendientes = (t.depende_de || []).filter(dep => {
        const d = st.tareas.find(x => x.id === dep);
        return d && !["hecha"].includes(d.estado);
    });
    if (pendientes.length)
        return ok({ promovida: false, bloqueada_por: pendientes, consejo: "termina las dependencias o promuévelas también" });
    t.horizonte = { semana: "hoy", mes: "semana", trimestre: "mes" }[t.horizonte];
    store.save(st);
    return ok({ promovida: true, nuevo_horizonte: t.horizonte });
});
server.tool("complete", "Marca una tarea como hecha y desbloquea dependientes (devuelve qué se liberó).", {
    tarea_id: z.string().describe("ID de la tarea"),
}, async (args) => {
    const { tarea_id } = args;
    const st = store.load();
    const t = (st.tareas || []).find(x => x.id === tarea_id);
    if (!t)
        return fail("tarea no encontrada");
    t.estado = "hecha";
    t.hecha_ts = new Date().toISOString();
    const liberadas = st.tareas.filter(x => (x.depende_de || []).includes(tarea_id) && !["hecha", "descartada"].includes(x.estado)).map(x => x.id);
    store.save(st);
    return ok({ tarea: t.id, hecha: true, desbloquea: liberadas });
});
server.tool("reschedule_cascade", "Mueve una tarea de fecha y recalendiza en cascada todo lo que depende de ella (efecto dominó calculado).", {
    tarea_id: z.string().describe("ID de la tarea que se retrasa"),
    desplazar_dias: z.number().describe("Días de retraso (positivo)"),
}, async (args) => {
    const { tarea_id, desplazar_dias } = args;
    const st = store.load();
    const t = (st.tareas || []).find(x => x.id === tarea_id);
    if (!t)
        return fail("tarea no encontrada");
    if (desplazar_dias <= 0)
        return fail("desplazar_dias debe ser > 0");
    const afectadas = new Set([tarea_id]);
    let creciendo = true;
    while (creciendo) {
        creciendo = false;
        for (const x of st.tareas || []) {
            if (afectadas.has(x.id) || ["hecha", "descartada"].includes(x.estado))
                continue;
            if ((x.depende_de || []).some(d => afectadas.has(d))) {
                afectadas.add(x.id);
                creciendo = true;
            }
        }
    }
    const detalle = [];
    for (const id of afectadas) {
        const x = st.tareas.find(y => y.id === id);
        if (x.fecha_objetivo) {
            const d = new Date(x.fecha_objetivo);
            d.setDate(d.getDate() + desplazar_dias);
            x.fecha_objetivo = d.toISOString();
        }
        detalle.push({ id: x.id, tarea: x.tarea.slice(0, 60), nuevo_horizonte: x.horizonte });
    }
    store.save(st);
    return ok({ retrada_raiz: desplazar_dias + " días", afectadas_en_cascada: detalle.length, detalle });
});
server.tool("plan_stats", "Estadísticas del plan: throughput, precisión de estimación (esfuerzo vs real) y horizonte más congestionado.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ts = st.tareas || [];
    if (!ts.length)
        return ok({ total: 0 });
    const hechas = ts.filter(t => t.estado === "hecha");
    const porHorizonte = {};
    for (const t of ts)
        porHorizonte[t.horizonte] = (porHorizonte[t.horizonte] || 0) + 1;
    return ok({
        total: ts.length, hechas: hechas.length, tasa_completado: Number((hechas.length / ts.length).toFixed(2)),
        por_horizonte: porHorizonte,
        mas_congestionado: __ents(porHorizonte).sort((a, b) => b[1] - a[1])[0],
        descartadas: ts.filter(t => t.estado === "descartada").length,
    });
});
server.tool("health_check", "Verifica que el servidor time-horizon-planner está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "time-horizon-planner", tools: 7, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[time-horizon-planner] fatal:", e);
    process.exit(1);
});

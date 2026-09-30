#!/usr/bin/env node
/**
 * MCP Server: Escalation Policy
 * Política de escalamiento: cuándo molestar al humano y con qué paquete — ni spam ni silencio
 *
 * Dolor que resuelve: Sin política de escalamiento el agente o molesta al humano cada 5 minutos (spam) o se calla problemas hasta el desastre. Decidir cuándo escalar es LA política que ningún agente trae.
 * Categoría: Humano en el Bucle | Generado por mcp-suite | id: escalation-policy
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
// ——— persistencia local: ~/.mcp-suite/escalation-policy/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "escalation-policy");
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
const server = new McpServer({ name: "escalation-policy", version: "1.0.0" });
server.tool("add_rule", "Añade una regla de escalamiento: condición evaluable y acción a tomar.", {
    nombre: z.string().describe("Nombre de la regla"),
    condicion: z.string().describe("Condición observable (ej: 'error 3 veces seguidas')"),
    accion: z.enum(["continuar", "registrar", "preguntar_humano", "abortar"]).describe("Qué hacer"),
    cooldown_minutos: z.number().describe("Minutos mínimos entre escalos de esta regla").default(60),
}, async (args) => {
    const { nombre, condicion, accion, cooldown_minutos } = args;
    const st = store.load();
    st.reglas = st.reglas || [];
    if (st.reglas.some(r => r.nombre === nombre))
        return fail("regla existente");
    st.reglas.push({ nombre, condicion, accion, cooldown_minutos: cooldown_minutos ?? 60, disparos: 0, ultimo: null, creado: new Date().toISOString() });
    store.save(st);
    return ok({ regla: nombre, accion, cooldown: cooldown_minutos ?? 60 });
});
server.tool("evaluate", "Evalúa una situación contra las reglas: devuelve la acción a tomar respetando cooldowns.", {
    situacion: z.string().describe("Descripción de la situación actual"),
    intentos_fallidos: z.number().describe("Intentos fallidos consecutivos").default(0),
}, async (args) => {
    const { situacion, intentos_fallidos } = args;
    const st = store.load();
    const reglas = st.reglas || [];
    if (!reglas.length)
        return fail("sin reglas: añade con add_rule");
    const ahora = Date.now();
    let accion = "continuar";
    let reglaGanadora = null;
    const evaluadas = [];
    for (const r of reglas) {
        const t = String(situacion).toLowerCase() + " " + intentos_fallidos + " fallos";
        const dispara = /error|fallo|excepción|excepcion/i.test(r.condicion) && intentos_fallidos >= 3
            || /\d+\s*(veces|intentos)/i.test(r.condicion) && new RegExp(r.condicion.match(/\d+/)?.[0] || "999").test(String(intentos_fallidos))
            || t.includes(r.condicion.toLowerCase().split(/\s+/).slice(0, 3).join(" "));
        const enCooldown = r.ultimo && (ahora - new Date(r.ultimo).getTime()) < r.cooldown_minutos * 60000;
        evaluadas.push({ regla: r.nombre, dispara, en_cooldown: enCooldown });
        if (dispara && !enCooldown) {
            const orden = { continuar: 0, registrar: 1, preguntar_humano: 2, abortar: 3 };
            if (orden[r.accion] > orden[accion]) {
                accion = r.accion;
                reglaGanadora = r;
            }
        }
        else if (dispara && enCooldown && r.accion === "preguntar_humano") {
            accion = accion === "abortar" ? accion : "registrar";
            reglaGanadora = reglaGanadora || { ...r, nota: "suprimido por cooldown" };
        }
    }
    if (reglaGanadora && !reglaGanadora.nota) {
        reglaGanadora.disparos++;
        reglaGanadora.ultimo = new Date().toISOString();
        store.save(st);
    }
    return ok({
        accion_recomendada: accion,
        regla_que_dispara: reglaGanadora?.nombre || null,
        suprimidas_por_cooldown: evaluadas.filter(e => e.dispara && e.en_cooldown).map(e => e.regla),
        significado: { continuar: "sigue sin molestar a nadie", registrar: "anota y sigue (observabilidad)", preguntar_humano: "arma paquete de takeover (takeover-request)", abortar: "detén y preserva estado (checkpoint-undo)" }[accion],
    });
});
server.tool("interruption_budget", "Presupuesto de interrupciones al humano hoy: respétalo o serás silenciado.", {
    max_por_dia: z.number().describe("Máximo de interrupciones diarias acordado").default(5),
}, async (args) => {
    const { max_por_dia } = args;
    const st = store.load();
    const reglas = st.reglas || [];
    const hoy = new Date().toISOString().slice(0, 10);
    st.calendario = st.calendario || {};
    st.calendario[hoy] = st.calendario[hoy] || 0;
    const usadas = st.calendario[hoy];
    const restantes = Math.max(0, max_por_dia - usadas);
    return ok({
        fecha: hoy,
        interrupciones_usadas: usadas,
        presupuesto: max_por_dia,
        restantes: restantes,
        estado: restantes === 0 ? "AGOTADO: agrupa pendientes en UNA sola interrupción con prioridades" : restantes <= 1 ? "queda 1: úsala solo para bloqueante real" : "con margen",
        consejo: "si siempre agotas el presupuesto: tus reglas escalan demasiado pronto (sube cooldown o baja acción)",
    });
});
server.tool("count_interruption", "Consume una interrupción del presupuesto diario (llámalo solo al preguntar de verdad al humano).", {
    motivo: z.string().describe("Por qué interrumpiste"),
}, async (args) => {
    const { motivo } = args;
    const st = store.load();
    const hoy = new Date().toISOString().slice(0, 10);
    st.calendario = st.calendario || {};
    st.calendario[hoy] = (st.calendario[hoy] || 0) + 1;
    st.log_interrupciones = st.log_interrupciones || [];
    st.log_interrupciones.push({ dia: hoy, motivo, ts: new Date().toISOString() });
    store.save(st);
    return ok({ interrupciones_hoy: st.calendario[hoy], motivo });
});
server.tool("policy_report", "Reporte de la política: reglas, disparos y motivos de interrupción del período.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const reglas = st.reglas || [];
    const logs = st.log_interrupciones || [];
    if (!reglas.length)
        return ok({ reglas: 0 });
    return ok({
        reglas: reglas.map(r => ({ nombre: r.nombre, accion: r.accion, disparos: r.disparos, cooldown: r.cooldown_minutos })),
        interrupciones_registradas: logs.length,
        ultimos_motivos: logs.slice(-8).map(l => l.motivo.slice(0, 70)),
        reglas_muertas: reglas.filter(r => r.disparos === 0).map(r => r.nombre),
        consejo: reglas.filter(r => r.disparos === 0).length > reglas.length / 2 ? "la mitad de reglas nunca disparó: la condición es inalcanzable, revísala" : "política activa",
    });
});
server.tool("health_check", "Verifica que el servidor escalation-policy está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "escalation-policy", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[escalation-policy] fatal:", e);
    process.exit(1);
});

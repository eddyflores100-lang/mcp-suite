#!/usr/bin/env node
/**
 * MCP Server: Action Limiter
 * Cinturón de seguridad del agente: limita frecuencia y volumen de acciones destructivas aunque el modelo insista
 *
 * Dolor que resuelve: El agente entra en bucle y repite la llamada destructiva 47 veces porque 'el error dice que reintentes'. Sin limitador local, ni el prompt ni el buen propósito frenan la máquina.
 * Categoría: Pre-Vuelo | Generado por mcp-suite | id: action-limiter
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
// ——— persistencia local: ~/.mcp-suite/action-limiter/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "action-limiter");
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
const server = new McpServer({ name: "action-limiter", version: "1.0.0" });
server.tool("set_policy", "Define el límite para una clase de acciones (verbo sobre objetivo).", {
    verbo: z.string().describe("Verbo de la acción (delete, send, update, create...)"),
    objetivo: z.string().describe("Patrón del objetivo (archivo:*, tabla:*, api:*)").default("*"),
    max_por_hora: z.number().describe("Máximo permitido por hora (0 = ilimitado)").default(0),
    max_por_sesion: z.number().describe("Máximo por sesión (0 = ilimitado)").default(0),
    escala: z.enum(["avisar", "confirmar_humano", "bloquear"]).describe("Qué hacer al superarlo").default("bloquear"),
}, async (args) => {
    const { verbo, objetivo, max_por_hora, max_por_sesion, escala } = args;
    const st = store.load();
    st.politicas = st.politicas || {};
    const clave = verbo.toLowerCase() + "::" + (objetivo || "*");
    st.politicas[clave] = { verbo: verbo.toLowerCase(), objetivo: objetivo || "*", max_por_hora, max_por_sesion, escala, creado: new Date().toISOString() };
    store.save(st);
    return ok({ politica: clave, max_por_hora, max_por_sesion, escala, politicas_totales: Object.keys(st.politicas).length });
});
server.tool("check_action", "Pregunta ANTES de ejecutar: ¿esta acción está dentro de límite? Devuelve PERMITIDO / AVISADO / CONFIRMAR_HUMANO / BLOQUEADO con motivo.", {
    verbo: z.string().describe("Verbo de la acción"),
    objetivo: z.string().describe("Objetivo concreto (ej: tabla:usuarios)"),
    sesion: z.string().describe("Sesión/agente que ejecuta").default("default"),
}, async (args) => {
    const { verbo, objetivo, sesion } = args;
    const st = store.load();
    st.eventos = st.eventos || [];
    const politicas = __vals(st.politicas || {});
    const v = verbo.toLowerCase();
    const politica = politicas.filter(p => p.verbo === v).sort((a, b) => (b.objetivo === "*" ? 0 : 1) - (a.objetivo === "*" ? 0 : 1)).find(p => p.objetivo === "*" || (objetivo || "").startsWith(p.objetivo.replace(/\*$/, "")) || (objetivo || "").includes(p.objetivo));
    if (!politica)
        return ok({ decision: "PERMITIDO", motivo: "sin política para " + v + ": define una si es destructivo", politica: null });
    const ahora = Date.now();
    st.eventos = st.eventos.filter(e => ahora - new Date(e.ts).getTime() < 3600000);
    const propios = st.eventos.filter(e => e.verbo === politica.verbo && e.sesion === sesion);
    const mismosObjetivo = propios.filter(e => (objetivo || "").includes(e.objetivo.slice(0, 20)));
    const enVentana = propios.filter(e => true);
    const porHora = politica.max_por_hora > 0 ? enVentana.length >= politica.max_por_hora : false;
    const porSesion = politica.max_por_sesion > 0 ? propios.length >= politica.max_por_sesion : false;
    let decision = "PERMITIDO";
    let motivo = "dentro de límites (" + enVentana.length + "/h, " + propios.length + "/sesión)";
    if (porHora || porSesion) {
        if (politica.escala === "avisar") {
            decision = "AVISADO";
            motivo = "límite superado (" + (porHora ? enVentana.length + "/" + politica.max_por_hora + " por hora" : propios.length + "/" + politica.max_por_sesion + " por sesión") + "): puede continuar pero el exceso queda registrado";
        }
        else if (politica.escala === "confirmar_humano") {
            decision = "CONFIRMAR_HUMANO";
            motivo = "límite superado: requiere confirmación humana explícita para continuar";
        }
        else {
            decision = "BLOQUEADO";
            motivo = "límite superado (" + (porHora ? "ventana horaria" : "sesión") + ") y la política manda bloquear: NIEGA la acción al agente";
        }
    }
    return ok({ decision, motivo, politica: { verbo: politica.verbo, objetivo: politica.objetivo, max_por_hora: politica.max_por_hora, max_por_sesion: politica.max_por_sesion, escala: politica.escala }, uso_actual: { ultima_hora: enVentana.length, sesion: propios.length, mismo_objetivo: mismosObjetivo.length }, siguiente: decision === "PERMITIDO" ? "ejecuta y luego registra con register_action" : "obedece la decisión: el limitador es inapelable" });
});
server.tool("register_action", "Registra la ejecución real de la acción (alimenta los contadores).", {
    verbo: z.string().describe("Verbo ejecutado"),
    objetivo: z.string().describe("Objetivo"),
    resultado: z.string().describe("exito | error | parcial").default("exito"),
    sesion: z.string().describe("Sesión").default("default"),
}, async (args) => {
    const { verbo, objetivo, resultado, sesion } = args;
    const st = store.load();
    st.eventos = st.eventos || [];
    st.eventos.push({ verbo: verbo.toLowerCase(), objetivo, resultado, sesion, ts: new Date().toISOString() });
    store.save(st);
    return ok({ registrado: true, eventos_totales: st.eventos.length });
});
server.tool("usage_report", "Consumo por verbo/objetivo en la última hora y estado frente a cada política.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ahora = Date.now();
    const eventos = (st.eventos || []).filter(e => ahora - new Date(e.ts).getTime() < 3600000);
    const porVerbo = {};
    eventos.forEach(e => { const k = e.verbo + "::" + e.objetivo.slice(0, 30); porVerbo[k] = (porVerbo[k] || 0) + 1; });
    const politicas = __vals(st.politicas || {}).map(p => {
        const uso = eventos.filter(e => e.verbo === p.verbo).length;
        return { politica: p.verbo + "::" + p.objetivo, limite_hora: p.max_por_hora, uso_ultima_hora: uso, estado: p.max_por_hora > 0 ? (uso >= p.max_por_hora ? "EN LÍMITE" : uso >= p.max_por_hora * 0.7 ? "ACERCÁNDOSE" : "holgado") : "sin límite horario" };
    });
    return ok({ eventos_ultima_hora: eventos.length, por_verbo_objetivo: porVerbo, politicas, errores_repetidos: eventos.filter(e => e.resultado === "error").length });
});
server.tool("health_check", "Verifica que el servidor action-limiter está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "action-limiter", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[action-limiter] fatal:", e);
    process.exit(1);
});

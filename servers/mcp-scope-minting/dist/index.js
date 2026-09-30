#!/usr/bin/env node
/**
 * MCP Server: Scope Minting
 * Acuña capacidades de mínimo privilegio como tokens: verbo + recurso + límites, verificables en un paso
 *
 * Dolor que resuelve: Al agente se le dan credenciales todopoderosas para leer UN archivo: la única granularidad disponible es 'todo o nada'. Sin tokens de alcance fino, cualquier filtración de credencial es total.
 * Categoría: Identidad Federada | Generado por mcp-suite | id: scope-minting
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
// ——— persistencia local: ~/.mcp-suite/scope-minting/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "scope-minting");
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
const server = new McpServer({ name: "scope-minting", version: "1.0.0" });
server.tool("define_capability", "Declara una capacidad acuñable: verbo sobre recurso con restricciones.", {
    nombre: z.string().describe("Nombre único de la capacidad"),
    verbo: z.string().describe("Verbo permitido (leer, escribir, llamar...)"),
    recurso: z.string().describe("Recurso objetivo (ruta, tabla, endpoint)"),
    restricciones: z.any().describe("Límites extra {max_registros, solo_columnas, horas}").optional(),
}, async (args) => {
    const { nombre, verbo, recurso, restricciones } = args;
    const st = store.load();
    st.capacidades = st.capacidades || {};
    if (st.capacidades[nombre])
        return fail("capacidad ya definida: " + nombre);
    st.capacidades[nombre] = { nombre, verbo: verbo.toLowerCase(), recurso, restricciones: restricciones || {}, minteados: 0, creado: new Date().toISOString() };
    store.save(st);
    return ok({ nombre, capacidad: verbo.toLowerCase() + " -> " + recurso, restricciones, nota: "principio de mínimo privilegio: acuña tokens con mint_token solo cuando se necesiten" });
});
server.tool("mint_token", "Acuña un token de capacidad con expiración y usos máximos.", {
    capacidad: z.string().describe("Nombre de la capacidad"),
    portador: z.string().describe("Agente que portará el token"),
    expira_horas: z.number().describe("Vigencia en horas").default(1),
    max_usos: z.number().describe("Usos máximos (0 = ilimitado hasta expirar)").default(1),
}, async (args) => {
    const { capacidad, portador, expira_horas, max_usos } = args;
    const st = store.load();
    const cap = (st.capacidades || {})[capacidad];
    if (!cap)
        return fail("capacidad no definida: " + capacidad);
    st.tokens = st.tokens || [];
    const crypto = await import("node:crypto");
    const nonce = crypto.randomBytes(8).toString("hex");
    const id = "tk_" + String(st.tokens.length + 1).padStart(4, "0");
    st.tokens.push({ id, nonce, capacidad, portador, expira: new Date(Date.now() + expira_horas * 3600000).toISOString(), max_usos, usos: 0, quemado: false, emitido: new Date().toISOString() });
    cap.minteados++;
    store.save(st);
    return ok({ id, nonce, capacidad, portador, expira_en: expira_horas + "h", usos_permitidos: max_usos === 0 ? "ilimitados hasta expirar" : max_usos, uso: "presenta {id, nonce} al ejecutar la acción" });
});
server.tool("check_token", "Verifica si un token autoriza UNA acción concreta (verbo+recurso exactos) y consume el uso.", {
    id: z.string().describe("Id del token"),
    nonce: z.string().describe("Nonce del token"),
    accion_verbo: z.string().describe("Verbo que se quiere ejecutar"),
    accion_recurso: z.string().describe("Recurso que se quiere tocar"),
    consumir: z.boolean().describe("Consumir el uso si autoriza").default(true),
}, async (args) => {
    const { id, nonce, accion_verbo, accion_recurso, consumir } = args;
    const st = store.load();
    const t = (st.tokens || []).find(x => x.id === id);
    if (!t)
        return fail("token inexistente: " + id);
    if (t.nonce !== nonce)
        return fail("nonce inválido: token presentado incorrectamente");
    if (t.quemado)
        return ok({ autorizado: false, razon: "token quemado deliberadamente" });
    if (new Date(t.expira).getTime() < Date.now())
        return ok({ autorizado: false, razon: "token EXPIRADO en " + t.expira });
    const cap = (st.capacidades || {})[t.capacidad];
    if (!cap)
        return ok({ autorizado: false, razon: "la capacidad detrás del token fue eliminada" });
    const verboOk = cap.verbo === accion_verbo.toLowerCase();
    const recursoOk = cap.recurso === accion_recurso || cap.recurso.endsWith("*") && accion_recurso.startsWith(cap.recurso.slice(0, -1));
    const usosOk = t.max_usos === 0 || t.usos < t.max_usos;
    if (!verboOk)
        return ok({ autorizado: false, razon: "el token concede '" + cap.verbo + "' y pides '" + accion_verbo + "': fuera de alcance" });
    if (!recursoOk)
        return ok({ autorizado: false, razon: "el token apunta a '" + cap.recurso + "' y tocas '" + accion_recurso + "'" });
    if (!usosOk)
        return ok({ autorizado: false, razon: "usos agotados (" + t.usos + "/" + t.max_usos + ")" });
    if (consumir) {
        t.usos++;
        store.save(st);
    }
    return ok({ autorizado: true, capacidad: t.capacidad, portador: t.portador, usos_restantes: t.max_usos === 0 ? "ilimitados" : t.max_usos - t.usos, expira: t.expira, restricciones: cap.restricciones });
});
server.tool("burn_token", "Quema un token antes de su expiración (ya no se necesita o hay sospecha).", {
    id: z.string().describe("Token a quemar"),
    motivo: z.string().describe("Motivo").optional(),
}, async (args) => {
    const { id, motivo } = args;
    const st = store.load();
    const t = (st.tokens || []).find(x => x.id === id);
    if (!t)
        return fail("token inexistente");
    if (t.quemado)
        return fail("ya quemado");
    t.quemado = true;
    t.quemado_motivo = motivo || "revocación manual";
    t.quemado_ts = new Date().toISOString();
    store.save(st);
    return ok({ id, quemado: true, usos_que_hizo: t.usos, motivo: t.quemado_motivo });
});
server.tool("token_census", "Censo de tokens: activos, por capacidad, agotados y quemados.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ts = st.tokens || [];
    if (!ts.length)
        return ok({ tokens: 0, mensaje: "sin tokens acuñados" });
    const ahora = Date.now();
    const activos = ts.filter(t => !t.quemado && new Date(t.expira).getTime() > ahora && (t.max_usos === 0 || t.usos < t.max_usos));
    const porCap = {};
    ts.forEach(t => { porCap[t.capacidad] = (porCap[t.capacidad] || 0) + 1; });
    return ok({ total_acuñados: ts.length, activos: activos.length, expirados: ts.filter(t => !t.quemado && new Date(t.expira).getTime() <= ahora).length, agotados: ts.filter(t => !t.quemado && t.max_usos > 0 && t.usos >= t.max_usos).length, quemados: ts.filter(t => t.quemado).length, por_capacidad: porCap, aviso: activos.length > 20 ? "20+ tokens activos: revisa que no haya minteo indiscriminado" : null });
});
server.tool("health_check", "Verifica que el servidor scope-minting está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "scope-minting", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[scope-minting] fatal:", e);
    process.exit(1);
});

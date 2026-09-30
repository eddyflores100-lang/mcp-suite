#!/usr/bin/env node
/**
 * MCP Server: Prompt Versioner
 * Control de versiones para prompts y system prompts: commits con diff, semántica y puntero de despliegue
 *
 * Dolor que resuelve: El prompt se 'mejora' editando el archivo a mano: no hay diff, ni versión previa, ni forma de volver. Si el agente empeora, nadie sabe qué línea cambió ni cuándo: el prompt es el código más editado y el menos versionado del planeta.
 * Categoría: Agent CI/CD | Generado por mcp-suite | id: prompt-versioner
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
// ——— persistencia local: ~/.mcp-suite/prompt-versioner/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "prompt-versioner");
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
const server = new McpServer({ name: "prompt-versioner", version: "1.0.0" });
server.tool("register_prompt", "Registra un prompt nuevo con su contenido inicial (versión 0.1.0).", {
    nombre: z.string().describe("Identificador del prompt"),
    contenido: z.string().describe("Texto completo del prompt"),
    proposito: z.string().describe("Para qué sirve").optional(),
}, async (args) => {
    const { nombre, contenido, proposito } = args;
    const st = store.load();
    st.prompts = st.prompts || {};
    if (st.prompts[nombre])
        return fail("prompt ya registrado: " + nombre + " (usa commit_version para evolucionarlo)");
    if (!contenido || contenido.trim().length < 10)
        return fail("contenido demasiado corto para versionar");
    st.prompts[nombre] = { nombre, proposito: proposito || "", versiones: [{ version: "0.1.0", contenido, commit: "registro inicial", ts: new Date().toISOString() }], puntero: "0.1.0" };
    store.save(st);
    return ok({ nombre, version: "0.1.0", lineas: contenido.split("\n").length, caracteres: contenido.length });
});
server.tool("commit_version", "Commit de una nueva versión con bump semántico y mensaje explicando el cambio.", {
    nombre: z.string().describe("Prompt a versionar"),
    contenido: z.string().describe("Texto COMPLETO de la nueva versión"),
    commit: z.string().describe("Mensaje del commit (qué y por qué)"),
    bump: z.enum(["patch", "minor", "major"]).describe("Severidad del cambio"),
}, async (args) => {
    const { nombre, contenido, commit, bump } = args;
    const st = store.load();
    const p = (st.prompts || {})[nombre];
    if (!p)
        return fail("prompt no registrado: " + nombre);
    const anterior = p.versiones[p.versiones.length - 1];
    if (anterior.contenido === contenido)
        return fail("contenido idéntico a la versión " + anterior.version + ": nada que commitear");
    const [ma, mi, pa] = anterior.version.split(".").map(Number);
    const nueva = bump === "major" ? [ma + 1, 0, 0] : bump === "minor" ? [ma, mi + 1, 0] : [ma, mi, pa + 1];
    const version = nueva.join(".");
    p.versiones.push({ version, contenido, commit, bump, ts: new Date().toISOString(), parent: anterior.version });
    store.save(st);
    return ok({ nombre, version, parent: anterior.version, commit, total_versiones: p.versiones.length, desplegada: p.puntero === version ? "SI (el puntero ya apunta aquí)" : "NO: usa set_pointer para desplegarla" });
});
server.tool("diff_versions", "Diff línea a línea entre dos versiones del prompt.", {
    nombre: z.string().describe("Prompt"),
    desde: z.string().describe("Versión origen").optional(),
    hasta: z.string().describe("Versión destino").optional(),
}, async (args) => {
    const { nombre, desde, hasta } = args;
    const st = store.load();
    const p = (st.prompts || {})[nombre];
    if (!p)
        return fail("prompt no registrado");
    const vs = p.versiones;
    const a = vs.find(v => v.version === (desde || vs[vs.length - 2]?.version));
    const b = vs.find(v => v.version === (hasta || vs[vs.length - 1]?.version));
    if (!a || !b)
        return fail("versiones no encontradas: disponibles " + vs.map(v => v.version).join(", "));
    const la = a.contenido.split("\n"), lb = b.contenido.split("\n");
    const setA = new Map(la.map((l, i) => [l + "#" + i, l]));
    const borradas = la.filter(l => !lb.includes(l));
    const añadidas = lb.filter(l => !la.includes(l));
    const comunes = la.filter(l => lb.includes(l)).length;
    return ok({ nombre, desde: a.version, hasta: b.version, lineas_antes: la.length, lineas_despues: lb.length, eliminadas: borradas.length, añadidas: añadidas.length, intactas: comunes, detalle_eliminadas: borradas.slice(0, 15).map(l => "- " + l.slice(0, 90)), detalle_añadidas: añadidas.slice(0, 15).map(l => "+ " + l.slice(0, 90)), riesgo: añadidas.length + borradas.length > la.length * 0.4 ? "ALTO: más del 40% del prompt cambió: valida con canary antes de desplegar" : "moderado/bajo" });
});
server.tool("set_pointer", "Mueve el puntero de despliegue a una versión concreta (deploy explícito, auditable).", {
    nombre: z.string().describe("Prompt"),
    version: z.string().describe("Versión a desplegar"),
    razon: z.string().describe("Por qué se despliega").optional(),
}, async (args) => {
    const { nombre, version, razon } = args;
    const st = store.load();
    const p = (st.prompts || {})[nombre];
    if (!p)
        return fail("prompt no registrado");
    const v = p.versiones.find(x => x.version === version);
    if (!v)
        return fail("versión inexistente: " + version + " (disponibles: " + p.versiones.map(x => x.version).join(", ") + ")");
    const anterior = p.puntero;
    p.puntero = version;
    p.despliegues = p.despliegues || [];
    p.despliegues.push({ desde: anterior, a: version, razon: razon || "", ts: new Date().toISOString() });
    store.save(st);
    return ok({ nombre, desplegada: version, anterior, con_rollback_rapido: "rollback_manager puede volver a " + anterior + " en un paso" });
});
server.tool("history", "Historia completa del prompt con commits y despliegues.", {
    nombre: z.string().describe("Prompt"),
}, async (args) => {
    const { nombre } = args;
    const st = store.load();
    const p = (st.prompts || {})[nombre];
    if (!p)
        return fail("prompt no registrado");
    return ok({ nombre, desplegada_actualmente: p.puntero, proposito: p.proposito, versiones: p.versiones.map(v => ({ version: v.version, commit: v.commit, bump: v.bump || "init", ts: v.ts, caracteres: v.contenido.length })), despliegues: (p.despliegues || []).slice(-10), crecimiento: Number((p.versiones[p.versiones.length - 1].contenido.length / p.versiones[0].contenido.length).toFixed(2)) + "x desde la primera versión" });
});
server.tool("health_check", "Verifica que el servidor prompt-versioner está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "prompt-versioner", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[prompt-versioner] fatal:", e);
    process.exit(1);
});

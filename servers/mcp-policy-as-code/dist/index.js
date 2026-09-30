#!/usr/bin/env node
/**
 * MCP Server: Policy As Code
 * Políticas ejecutables para agentes regulados: cada acción se valida contra reglas, no contra intuición
 *
 * Dolor que resuelve: En industrias reguladas la política vive en PDFs que el agente nunca lee: cada acción es un riesgo de incumplimiento porque las reglas no son ejecutables por la máquina.
 * Categoría: Cumplimiento | Generado por mcp-suite | id: policy-as-code
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
// ——— persistencia local: ~/.mcp-suite/policy-as-code/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "policy-as-code");
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
const server = new McpServer({ name: "policy-as-code", version: "1.0.0" });
server.tool("add_policy", "Añade una política ejecutable: condición sobre atributos de la acción y veredicto.", {
    nombre: z.string().describe("Nombre de la política"),
    descripcion: z.string().describe("Qué controla"),
    condicion: z.string().describe("Condición sobre atributos (ej: 'datos=pii y destino=externo')"),
    veredicto: z.enum(["permitir", "negar", "requerir_aprobacion", "registrar"]).describe("Resultado si aplica"),
    marco: z.string().describe("Marco de referencia (HIPAA, GDPR, SOX, interno)").default("interno"),
}, async (args) => {
    const { nombre, descripcion, condicion, veredicto, marco } = args;
    const st = store.load();
    st.politicas = st.politicas || [];
    if (st.politicas.some(p => p.nombre === nombre))
        return fail("política existente");
    st.politicas.push({ nombre, descripcion, condicion, veredicto, marco, disparos: 0, ts: new Date().toISOString() });
    store.save(st);
    return ok({ politica: nombre, veredicto, marco });
});
server.tool("evaluate_action", "Evalúa una acción contra todas las políticas: veredicto final (más restrictivo gana) con trazas.", {
    accion: z.string().describe("Acción contemplada"),
    atributos: z.any().describe("Atributos {datos, destino, volumen, usuario...}"),
}, async (args) => {
    const { accion, atributos } = args;
    const st = store.load();
    const politicas = st.politicas || [];
    if (!politicas.length)
        return fail("sin políticas: añade con add_policy");
    const atr = atributos || {};
    const texto = (accion + " " + JSON.stringify(atr)).toLowerCase();
    function aplica(cond) {
        const c = String(cond).toLowerCase();
        if (c.includes(" y "))
            return c.split(" y ").every(clausula => clausulaSimple(clausula));
        if (c.includes(" o "))
            return c.split(" o ").some(clausula => clausulaSimple(clausula));
        return clausulaSimple(c);
        function clausulaSimple(cl) {
            const m = cl.match(/^(\w+)\s*=\s*(\w+)$/);
            if (m)
                return String(atr[m[1]] ?? "").toLowerCase() === m[2];
            return texto.includes(cl.trim());
        }
    }
    const trazas = [];
    let veredicto = "permitir";
    const ORDEN = { permitir: 0, registrar: 1, requerir_aprobacion: 2, negar: 3 };
    for (const p of politicas) {
        if (!aplica(p.condicion))
            continue;
        p.disparos++;
        trazas.push({ politica: p.nombre, marco: p.marco, veredicto: p.veredicto });
        if (ORDEN[p.veredicto] > ORDEN[veredicto])
            veredicto = p.veredicto;
    }
    st.auditoria = st.auditoria || [];
    st.auditoria.push({ accion, atributos: atr, veredicto, trazas, ts: new Date().toISOString() });
    if (st.auditoria.length > 300)
        st.auditoria = st.auditoria.slice(-200);
    store.save(st);
    return ok({
        accion: accion.slice(0, 80),
        veredicto,
        politicas_disparadas: trazas,
        significado: { permitir: "puedes ejecutar", registrar: "ejecuta y registra evidencia", requerir_aprobacion: "PAUSA: pide aprobación humana documentada", negar: "PROHIBIDO: no ejecutes ni intentes workaround" }[veredicto],
    });
});
server.tool("conflict_scan", "Detecta políticas que pueden disparar veredictos contradictorios para la misma acción.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ps = st.politicas || [];
    if (ps.length < 2)
        return ok({ politicas: ps.length });
    const conflictos = [];
    for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
            const tokensA = new Set(String(ps[i].condicion).toLowerCase().split(/\s+/));
            const tokensB = new Set(String(ps[j].condicion).toLowerCase().split(/\s+/));
            const overlap = [...tokensA].filter(w => tokensB.has(w) && w.length > 2).length;
            if (overlap >= 1 && ps[i].veredicto !== ps[j].veredicto && (ps[i].veredicto === "negar" || ps[j].veredicto === "negar")) {
                conflictos.push({ a: ps[i].nombre, b: ps[j].nombre, veredictos: ps[i].veredicto + " vs " + ps[j].veredicto, solucion: "especifica qué política prevalece (añade condición más estrecha)" });
            }
        }
    }
    return ok({ politicas: ps.length, conflictos_potenciales: conflictos.length, detalle: conflictos.slice(0, 6) });
});
server.tool("compliance_log", "Registro de auditoría de decisiones de política: qué se evaluó, cuándo y con qué veredicto.", {
    solo_bloqueos: z.boolean().describe("Solo negadas/requiere aprobación").default(false),
}, async (args) => {
    const { solo_bloqueos } = args;
    const st = store.load();
    let log = st.auditoria || [];
    if (solo_bloqueos)
        log = log.filter(a => a.veredicto === "negar" || a.veredicto === "requerir_aprobacion");
    return ok({
        evaluaciones: log.length,
        por_veredicto: log.reduce((acc, a) => { acc[a.veredicto] = (acc[a.veredicto] || 0) + 1; return acc; }, {}),
        ultimas: log.slice(-10).reverse().map(a => ({ ts: a.ts, accion: a.accion.slice(0, 70), veredicto: a.veredicto, politicas: a.trazas.map(t => t.politica) })),
    });
});
server.tool("health_check", "Verifica que el servidor policy-as-code está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "policy-as-code", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[policy-as-code] fatal:", e);
    process.exit(1);
});

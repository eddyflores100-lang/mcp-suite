#!/usr/bin/env node
/**
 * MCP Server: Acceptance Criteria
 * Convierte requests en criterios GIVEN/WHEN/THEN verificables con prioridad y trazabilidad
 *
 * Dolor que resuelve: Los 'definition of done' del agente son difusos: dice 'listo' cuando compiló, no cuando cumple criterios verificables que el humano podría auditar.
 * Categoría: Especificación y Requisitos | Generado por mcp-suite | id: acceptance-criteria
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
// ——— persistencia local: ~/.mcp-suite/acceptance-criteria/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "acceptance-criteria");
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
const server = new McpServer({ name: "acceptance-criteria", version: "1.0.0" });
server.tool("add_requirement", "Registra un requerimiento y genera su borrador de criterios de aceptación GIVEN/WHEN/THEN.", {
    requerimiento: z.string().describe("Texto del requerimiento"),
    prioridad: z.enum(["must", "should", "could", "wont"]).describe("MoSCoW").default("must"),
    contexto: z.string().describe("Contexto adicional").optional(),
}, async (args) => {
    const { requerimiento, prioridad, contexto } = args;
    const st = store.load();
    st.reqs = st.reqs || [];
    const id = "rq_" + Date.now().toString(36);
    const acciones = ["mostrar", "mostrará", "listar", "devolver", "crear", "guardar", "procesar", "calcular", "validar", "enviar", "notificar", "buscar", "filtrar", "generar"];
    const entidadesGuess = requerimiento.split(/\s+/).slice(0, 4).join(" ");
    st.reqs.push({
        id, requerimiento, prioridad, contexto: contexto || null,
        criterios: [
            { GIVEN: "el sistema en estado normal", WHEN: "solicito: " + entidadesGuess, THEN: "obtengo el resultado descrito sin errores" },
            { GIVEN: "datos de entrada inválidos o vacíos", WHEN: "solicito: " + entidadesGuess, THEN: "recibo error explícito y el estado no se corrompe" },
            { GIVEN: "el resultado anterior", WHEN: "reviso la salida", THEN: "cumple el requerimiento literal: '" + requerimiento.slice(0, 90) + "'" },
        ].map((c, i) => ({ n: i + 1, ...c, estado: "pendiente", evidencia: null })),
        creado: new Date().toISOString(),
    });
    store.save(st);
    return ok({ requerimiento_id: id, prioridad, criterios_borrador: 3, aviso: "edita/refina los criterios con refine_criterion: el borrador es el punto de partida" });
});
server.tool("refine_criterion", "Refina un criterio concreto (GIVEN/WHEN/THEN exactos) para hacerlo objetivamente verificable.", {
    requerimiento_id: z.string().describe("ID del requerimiento"),
    n: z.number().describe("Número del criterio"),
    given: z.string().describe("Contexto previo exacto"),
    when: z.string().describe("Acción concreta"),
    then: z.string().describe("Resultado observable y medible"),
}, async (args) => {
    const { requerimiento_id, n, given, when, then } = args;
    const st = store.load();
    const r = (st.reqs || []).find(x => x.id === requerimiento_id);
    if (!r)
        return fail("requerimiento no encontrado");
    const c = r.criterios.find(x => x.n === n);
    if (!c)
        return fail("criterio inexistente");
    const problemas = [];
    if (/\d/.test(then) === false && /(tiempo|segundos|ms|elementos|resultados)/i.test(then))
        problemas.push("THEN menciona magnitud sin número");
    if (then.split(/\s+/).length < 5)
        problemas.push("THEN demasiado corto para ser observable");
    if (when.split(/\s+/).length < 3)
        problemas.push("WHEN demasiado vago: ¿qué acción exacta?");
    c.GIVEN = given;
    c.WHEN = when;
    c.THEN = then;
    c.refinado = true;
    store.save(st);
    return ok({ criterio: n, actualizado: true, problemas_estilo: problemas, estado: problemas.length ? "mejorable" : "verificable" });
});
server.tool("verify_criterion", "Marca un criterio como verificado (o fallido) con evidencia: la definición objetiva de 'listo'.", {
    requerimiento_id: z.string().describe("ID del requerimiento"),
    n: z.number().describe("Número del criterio"),
    pasado: z.boolean().describe("¿Verificado?"),
    evidencia: z.string().describe("Cómo se verificó (test, revisión, salida)"),
}, async (args) => {
    const { requerimiento_id, n, pasado, evidencia } = args;
    const st = store.load();
    const r = (st.reqs || []).find(x => x.id === requerimiento_id);
    if (!r)
        return fail("requerimiento no encontrado");
    const c = r.criterios.find(x => x.n === n);
    if (!c)
        return fail("criterio inexistente");
    if (!evidencia)
        return fail("sin evidencia no hay verificación: ¿cómo lo comprobaste?");
    c.estado = pasado ? "verificado" : "fallido";
    c.evidencia = evidencia;
    c.verificado_ts = new Date().toISOString();
    store.save(st);
    const verificados = r.criterios.filter(x => x.estado === "verificado").length;
    return ok({ criterio: n, estado: c.estado, progreso: verificados + "/" + r.criterios.length, listo: verificados === r.criterios.length });
});
server.tool("ready_check", "¿Se puede declarar 'listo'? Solo si todos los must están verificados; lista lo que falta.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const reqs = st.reqs || [];
    if (!reqs.length)
        return ok({ requerimientos: 0 });
    const faltantes = [];
    for (const r of reqs) {
        if (r.prioridad !== "must")
            continue;
        for (const c of r.criterios)
            if (c.estado !== "verificado")
                faltantes.push({ req: r.id, texto: r.requerimiento.slice(0, 70), criterio: c.n, when: c.WHEN, estado: c.estado });
    }
    const musts = reqs.filter(r => r.prioridad === "must");
    return ok({
        requerimientos: reqs.length, musts: musts.length,
        LISTO: faltantes.length === 0 && musts.length > 0,
        criterios_must_pendientes: faltantes.length,
        faltantes: faltantes.slice(0, 12),
        veredicto: faltantes.length === 0 ? "todos los must verificados: puedes declarar 'listo' con evidencia" : "NO declares listo: faltan " + faltantes.length + " criterios must",
    });
});
server.tool("coverage_matrix", "Matriz requerimiento × criterios con estado, para auditoría rápida del avance.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const reqs = st.reqs || [];
    return ok({
        total_reqs: reqs.length,
        matriz: reqs.map(r => ({
            id: r.id, req: r.requerimiento.slice(0, 60), prioridad: r.prioridad,
            criterios: r.criterios.map(c => c.estado === "verificado" ? "V" : c.estado === "fallido" ? "F" : "·").join(" "),
            pct: Math.round(r.criterios.filter(c => c.estado === "verificado").length / r.criterios.length * 100),
        })),
    });
});
server.tool("health_check", "Verifica que el servidor acceptance-criteria está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "acceptance-criteria", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[acceptance-criteria] fatal:", e);
    process.exit(1);
});

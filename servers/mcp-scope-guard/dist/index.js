#!/usr/bin/env node
/**
 * MCP Server: Scope Guard
 * Detecta scope creep del agente: trabajo fuera del alcance acordado antes de gastar tokens en él
 *
 * Dolor que resuelve: El agente 'ayuda de más': pide validar un formulario y termina refactorizando la app entera. El scope creep quema presupuesto y introduce riesgo sin que nadie lo autorizara.
 * Categoría: Objetivos y Largo Plazo | Generado por mcp-suite | id: scope-guard
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
// ——— persistencia local: ~/.mcp-suite/scope-guard/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "scope-guard");
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
const server = new McpServer({ name: "scope-guard", version: "1.0.0" });
server.tool("define_scope", "Define el alcance del encargo: qué incluye y qué queda EXPLÍCITAMENTE fuera (lo segundo es lo que importa).", {
    incluye: z.array(z.any()).describe("Ámbitos incluidos"),
    excluye: z.array(z.any()).describe("Ámbitos explícitamente fuera de alcance"),
    presupuesto_tokens: z.number().describe("Presupuesto total del encargo").optional(),
}, async (args) => {
    const { incluye, excluye, presupuesto_tokens } = args;
    const st = store.load();
    st.alcance = { incluye: (incluye || []).map(String), excluye: (excluye || []).map(String), presupuesto_tokens: presupuesto_tokens || null, definido: new Date().toISOString(), eventos: [], tokens_fuera_scope: 0 };
    store.save(st);
    return ok({ alcance_definido: true, incluye: (incluye || []).length, excluye: (excluye || []).length, regla: "tarea fuera de alcance = para, pregunta, no hagas" });
});
server.tool("check_task", "Clasifica una tarea contra el alcance: dentro / borde / fuera, con el ámbito excluido que pisa (si aplica).", {
    tarea: z.string().describe("Tarea o sub-tarea a clasificar"),
}, async (args) => {
    const { tarea } = args;
    const st = store.load();
    if (!st.alcance)
        return fail("define el alcance con define_scope");
    const a = st.alcance;
    const tokens = (s) => new Set(String(s).toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const t = [...tokens(tarea)];
    function mejorMatch(frase) { const ft = [...tokens(frase)]; const hit = ft.filter(w => t.includes(w)).length; return { hit, score: ft.length ? hit / ft.length : 0, frase }; }
    const inc = a.incluye.map(mejorMatch).sort((x, y) => y.score - x.score)[0] || { score: 0 };
    const exc = a.excluye.map(mejorMatch).sort((x, y) => y.score - x.score)[0] || { score: 0 };
    let veredicto;
    if (exc.score >= 0.5 && exc.score >= inc.score)
        veredicto = "FUERA: pisa el ámbito excluido '" + exc.frase + "'";
    else if (inc.score >= 0.5)
        veredicto = "dentro del alcance";
    else if (exc.score >= 0.3)
        veredicto = "BORDE: sospechoso de '" + exc.frase + "', confirma antes";
    else
        veredicto = "BORDE: sin match claro ni con incluye ni excluye: pregunta";
    a.eventos.push({ tarea: tarea.slice(0, 100), veredicto, ts: new Date().toISOString() });
    store.save(st);
    return ok({ veredicto, match_incluye: Number(inc.score.toFixed(2)), match_excluye: Number(exc.score.toFixed(2)), accion: veredicto.startsWith("FUERA") ? "NO ejecutar sin autorización: propón una enmienda de alcance al humano" : veredicto.startsWith("BORDE") ? "confirma con el humano (una línea) antes de gastar tokens" : "ejecuta" });
});
server.tool("log_out_of_scope", "Registra trabajo fuera de alcance ya realizado (confesión) con tokens gastados: deuda de scope.", {
    tarea: z.string().describe("Qué se hizo fuera de alcance"),
    tokens_gastados: z.number().describe("Tokens quemados").optional(),
    resultado_util: z.boolean().describe("¿Produjo algo aprovechable?").default(false),
}, async (args) => {
    const { tarea, tokens_gastados, resultado_util } = args;
    const st = store.load();
    if (!st.alcance)
        return fail("sin alcance definido");
    st.alcance.deuda = st.alcance.deuda || [];
    st.alcance.deuda.push({ tarea, tokens: tokens_gastados || 0, util: resultado_util, ts: new Date().toISOString() });
    st.alcance.tokens_fuera_scope += tokens_gastados || 0;
    store.save(st);
    const pct = st.alcance.presupuesto_tokens ? Number((st.alcance.tokens_fuera_scope / st.alcance.presupuesto_tokens * 100).toFixed(1)) : null;
    return ok({ deuda_registrada: true, tokens_fuera_scope_total: st.alcance.tokens_fuera_scope, pct_presupuesto_desperdiciado: pct, incidentes: st.alcance.deuda.length });
});
server.tool("scope_report", "Reporte de disciplina de alcance: tareas clasificadas, deuda acumulada y % de presupuesto desperdiciado.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    if (!st.alcance)
        return fail("sin alcance definido");
    const a = st.alcance;
    const evs = a.eventos || [];
    const fuera = evs.filter(e => e.veredicto.startsWith("FUERA")).length;
    const borde = evs.filter(e => e.veredicto.startsWith("BORDE")).length;
    return ok({
        tareas_evaluadas: evs.length,
        dentro: evs.length - fuera - borde, borde, fuera,
        disciplina_pct: evs.length ? Number((((evs.length - fuera) / evs.length) * 100).toFixed(1)) : null,
        deuda_scope: { incidentes: (a.deuda || []).length, tokens_desperdiciados: a.tokens_fuera_scope, pct_presupuesto: a.presupuesto_tokens ? Number((a.tokens_fuera_scope / a.presupuesto_tokens * 100).toFixed(1)) : null },
        ultimas_fueras: evs.filter(e => e.veredicto.startsWith("FUERA")).slice(-5).map(e => e.tarea),
        veredicto: fuera === 0 ? "agente disciplinado" : fuera > evs.length * 0.2 ? "scope creep severo: endurece el excluye" : "creep moderado: vigila los BORDE",
    });
});
server.tool("amend_scope", "Enmienda el alcance formalmente (nuevo incluye/excluye) con motivo: crecer alcance con permiso, no de contrabando.", {
    incluye_extra: z.array(z.any()).describe("Nuevos ámbitos incluidos").optional(),
    excluye_extra: z.array(z.any()).describe("Nuevos ámbitos excluidos").optional(),
    motivo: z.string().describe("Quién autoriza y por qué"),
}, async (args) => {
    const { incluye_extra, excluye_extra, motivo } = args;
    const st = store.load();
    if (!st.alcance)
        return fail("sin alcance definido");
    if (!motivo)
        return fail("la enmienda de alcance necesita motivo y autorizador");
    const a = st.alcance;
    a.incluye.push(...(incluye_extra || []).map(String));
    a.excluye.push(...(excluye_extra || []).map(String));
    a.enmiendas = a.enmiendas || [];
    a.enmiendas.push({ motivo, incluye: a.incluye.length, excluye: a.excluye.length, ts: new Date().toISOString() });
    store.save(st);
    return ok({ enmienda_n: a.enmiendas.length, incluye: a.incluye.length, excluye: a.excluye.length });
});
server.tool("health_check", "Verifica que el servidor scope-guard está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "scope-guard", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[scope-guard] fatal:", e);
    process.exit(1);
});

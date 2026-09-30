#!/usr/bin/env node
/**
 * MCP Server: Counterfactual Lab
 * Laboratorio de contrafactuales: cambia UNA variable del pasado y compara mundos con el conjunto mínimo de cambios
 *
 * Dolor que resuelve: El agente razona 'si hubiéramos hecho X habría pasado Y' por pura narrativa: cambia cinco cosas a la vez, atribuye el resultado a la que le conviene y la lección aprendida es ficción retrospectiva.
 * Categoría: Razonamiento | Generado por mcp-suite | id: counterfactual-lab
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
// ——— persistencia local: ~/.mcp-suite/counterfactual-lab/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "counterfactual-lab");
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
const server = new McpServer({ name: "counterfactual-lab", version: "1.0.0" });
server.tool("register_facts", "Registra la línea de hechos del mundo real (secuencia causal).", {
    escenario: z.string().describe("Nombre del escenario a estudiar"),
    hechos: z.array(z.any()).describe("Hechos en orden {que_paso, causa?, efecto?}"),
}, async (args) => {
    const { escenario, hechos } = args;
    const st = store.load();
    st.escenarios = st.escenarios || {};
    if (st.escenarios[escenario])
        return fail("escenario ya registrado: " + escenario);
    const limpios = (hechos || []).map((h, i) => ({ idx: i + 1, que_paso: String(h.que_paso || ""), causa: String(h.causa || ""), efecto: String(h.efecto || "") })).filter(h => h.que_paso);
    if (limpios.length < 2)
        return fail("necesitas al menos 2 hechos encadenados");
    st.escenarios[escenario] = { escenario, hechos: limpios, contrafactuales: {}, registrado: new Date().toISOString() };
    store.save(st);
    return ok({ escenario, hechos: limpios.length, cadena: limpios.map(h => h.idx + ". " + h.que_paso.slice(0, 60)), siguiente: "crea el contrafactual con run_counterfactual" });
});
server.tool("run_counterfactual", "Cambia hechos desde un punto y calcula el conjunto mínimo de consecuencias que se alteran.", {
    escenario: z.string().describe("Escenario base"),
    desde_hecho: z.number().describe("Número de hecho donde se inyecta el cambio"),
    cambio: z.string().describe("Qué pasa distinto a partir de ahí"),
}, async (args) => {
    const { escenario, desde_hecho, cambio } = args;
    const st = store.load();
    const e = (st.escenarios || {})[escenario];
    if (!e)
        return fail("escenario no registrado");
    if (desde_hecho < 1 || desde_hecho > e.hechos.length)
        return fail("hecho inexistente: hay " + e.hechos.length);
    const afectados = e.hechos.filter(h => h.idx >= desde_hecho);
    const nombre = "cf-" + desde_hecho + "-" + cambio.toLowerCase().slice(0, 20).replace(/[^a-z0-9]+/g, "-");
    e.contrafactuales[nombre] = { desde_hecho, cambio, hechos_reescritos: afectados.length, creado: new Date().toISOString() };
    store.save(st);
    const minimos = afectados.filter(h => h.causa && afectados.some(o => o.efecto && o.causa.includes(h.que_paso.slice(0, 20))) || h.idx === desde_hecho);
    return ok({ contrafactual: nombre, escenario, punto_de_bifurcacion: "hecho #" + desde_hecho + ": " + e.hechos[desde_hecho - 1].que_paso.slice(0, 70), cambio_inyectado: cambio, hechos_afectados_desde_el_punto: afectados.length, conjunto_minimo_a_revisar: minimos.length, regla_ceteris_paribus: "todo lo ANTERIOR a #" + desde_hecho + " permanece igual: si tu análisis requiere tocarlo, no es un contrafactual limpio", hechos_a_reescribir: afectados.map(h => ({ idx: h.idx, original: h.que_paso.slice(0, 60), pendiente: "reescribe este hecho asumiendo que '" + cambio + "' ocurrió" })) });
});
server.tool("compare_worlds", "Compara mundo real vs contrafactual: qué cambia, qué permanece y dónde diverge la narrativa.", {
    escenario: z.string().describe("Escenario"),
    contrafactual: z.string().describe("Contrafactual registrado"),
    hechos_alternativos: z.array(z.any()).describe("Hechos reescritos del mundo contrafactual {idx, que_paso}"),
}, async (args) => {
    const { escenario, contrafactual, hechos_alternativos } = args;
    const st = store.load();
    const e = (st.escenarios || {})[escenario];
    if (!e)
        return fail("escenario no encontrado");
    const cf = e.contrafactuales[contrafactual];
    if (!cf)
        return fail("contrafactual no encontrado: disponibles " + Object.keys(e.contrafactuales).join(", "));
    const alt = new Map((hechos_alternativos || []).map(h => [Number(h.idx), String(h.que_paso)]));
    if (!alt.size)
        return fail("sin hechos alternativos: reescribe los hechos afectados");
    const distintos = [];
    const iguales = [];
    e.hechos.forEach(h => {
        const a = alt.get(h.idx);
        if (a === undefined)
            iguales.push({ idx: h.idx, hecho: h.que_paso.slice(0, 50), estado: "intacto (anterior al punto de bifurcación)" });
        else if (a.trim() === h.que_paso.trim())
            iguales.push({ idx: h.idx, hecho: h.que_paso.slice(0, 50), estado: "idéntico pese a estar después del cambio: sospechoso" });
        else
            distintos.push({ idx: h.idx, real: h.que_paso.slice(0, 60), contrafactual: a.slice(0, 60) });
    });
    const sospechosos = iguales.filter(i => i.estado.startsWith("idéntico"));
    return ok({ escenario, contrafactual, cambian: distintos.length, permanecen: iguales.length, tabla_de_mundos: { divergencias: distintos, permanencias: iguales }, distancia_entre_mundos: Number((distintos.length / e.hechos.length).toFixed(2)) + " del escenario reescrito", alerta: sospechosos.length ? "hay hechos POSTERIORES al cambio que quedaron idénticos: o son verdaderamente independientes (verifícalo) o el contrafactual está mal construido" : "consistencia razonable", leccion_candidata: distintos.length ? "la diferencia de desenlace se atribuye al ÚNICO cambio inyectado: '" + cf.cambio.slice(0, 60) + "'" : "sin divergencias: el cambio no alteró el desenlace, no le atribuyas mérito ni culpa" });
});
server.tool("health_check", "Verifica que el servidor counterfactual-lab está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "counterfactual-lab", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[counterfactual-lab] fatal:", e);
    process.exit(1);
});

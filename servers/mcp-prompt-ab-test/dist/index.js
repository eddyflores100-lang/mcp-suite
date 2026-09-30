#!/usr/bin/env node
/**
 * MCP Server: Prompt A/B Test
 * Experimentos A/B de prompts con métricas objetivas: deja de afinar prompts por intuición
 *
 * Dolor que resuelve: Se afina el prompt por intuición y 'se siente mejor': sin A/B con métricas, la mitad de los cambios de prompt empeoran y nadie lo sabe.
 * Categoría: Evaluación Continua | Generado por mcp-suite | id: prompt-ab-test
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
// ——— persistencia local: ~/.mcp-suite/prompt-ab-test/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "prompt-ab-test");
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
const server = new McpServer({ name: "prompt-ab-test", version: "1.0.0" });
server.tool("create_experiment", "Crea un experimento A/B: nombre, qué se está probando y métrica de éxito.", {
    nombre: z.string().describe("Nombre del experimento"),
    hipotesis: z.string().describe("Qué crees que mejorará y por qué"),
    metrica: z.enum(["contiene_clave", "concision", "sigue_formato", "manual"]).describe("Métrica principal").default("contiene_clave"),
    clave: z.string().describe("Palabra/frase clave esperada en la salida (para contiene_clave)").optional(),
}, async (args) => {
    const { nombre, hipotesis, metrica, clave } = args;
    const st = store.load();
    st.exps = st.exps || {};
    if (st.exps[nombre])
        return fail("experimento existente");
    st.exps[nombre] = { nombre, hipotesis, metrica, clave: clave || null, variantes: {}, resultados: {}, cerrado: null, creado: new Date().toISOString() };
    store.save(st);
    return ok({ experimento: nombre, metrica, hipotesis: hipotesis.slice(0, 90) });
});
server.tool("add_variant", "Añade una variante (A, B, C...) con el texto del prompt o configuración a comparar.", {
    experimento: z.string().describe("Nombre del experimento"),
    etiqueta: z.string().describe("Etiqueta de la variante (A, B...)"),
    contenido: z.string().describe("Texto/cambio concreto de la variante"),
}, async (args) => {
    const { experimento, etiqueta, contenido } = args;
    const st = store.load();
    const e = (st.exps || {})[experimento];
    if (!e)
        return fail("experimento no encontrado");
    if (e.variantes[etiqueta])
        return fail("variante existente");
    e.variantes[etiqueta] = contenido;
    e.resultados[etiqueta] = [];
    store.save(st);
    return ok({ experimento, variante: etiqueta, total_variantes: Object.keys(e.variantes).length });
});
server.tool("record_result", "Registra el resultado de una variante en un caso: salida obtenida (+costo en tokens opcional).", {
    experimento: z.string().describe("Nombre del experimento"),
    variante: z.string().describe("Etiqueta de la variante"),
    caso: z.string().describe("Identificador del caso de prueba"),
    salida: z.string().describe("Salida obtenida"),
    exito_manual: z.boolean().describe("Para metrica=manual: ¿fue buena?").optional(),
    tokens: z.number().describe("Costo en tokens de la salida").optional(),
}, async (args) => {
    const { experimento, variante, caso, salida, exito_manual, tokens } = args;
    const st = store.load();
    const e = (st.exps || {})[experimento];
    if (!e)
        return fail("experimento no encontrado");
    if (!e.variantes[variante])
        return fail("variante no registrada: " + variante);
    e.resultados[variante].push({ caso, salida: String(salida), exito_manual: exito_manual ?? null, tokens: tokens || null, ts: new Date().toISOString() });
    store.save(st);
    return ok({ variante, n_resultados: e.resultados[variante].length });
});
server.tool("analyze", "Analiza el experimento: tasa de éxito por variante según la métrica, longitud media y recomendación de ganador.", {
    experimento: z.string().describe("Nombre del experimento"),
}, async (args) => {
    const { experimento } = args;
    const st = store.load();
    const e = (st.exps || {})[experimento];
    if (!e)
        return fail("experimento no encontrado");
    const labels = Object.keys(e.variantes);
    if (labels.length < 2)
        return fail("necesitas >=2 variantes");
    function score(res) {
        const s = res.salida;
        switch (e.metrica) {
            case "contiene_clave": return e.clave && s.toLowerCase().includes(e.clave.toLowerCase()) ? 1 : 0;
            case "concision": return s.length > 0 && s.length <= 1500 ? 1 : 0;
            case "sigue_formato": return /(^\n?[\-\d*•]|```|^\{|^\[)/m.test(s) ? 1 : 0;
            case "manual": return res.exito_manual === true ? 1 : 0;
        }
    }
    const resumen = labels.map(l => {
        const rs = e.resultados[l] || [];
        const exitos = rs.filter(r => score(r) === 1).length;
        const tokens = rs.filter(r => r.tokens).map(r => r.tokens);
        return {
            variante: l,
            casos: rs.length,
            tasa_exito: rs.length ? Number((exitos / rs.length).toFixed(2)) : null,
            longitud_media: rs.length ? Math.round(rs.reduce((s, r) => s + r.salida.length, 0) / rs.length) : null,
            tokens_medios: tokens.length ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length) : null,
        };
    });
    const conDatos = resumen.filter(r => r.tasa_exito !== null).sort((a, b) => b.tasa_exito - a.tasa_exito);
    const mejor = conDatos[0];
    const segundo = conDatos[1];
    const significativo = mejor && segundo && (mejor.tasa_exito - segundo.tasa_exito) >= 0.15 && mejor.casos >= 5;
    e.analisis = { resumen, ganador: significativo ? mejor.variante : null, ts: new Date().toISOString() };
    store.save(st);
    return ok({
        metrica: e.metrica, clave: e.clave,
        resumen,
        ganador_sugerido: mejor?.variante || null,
        significancia_aprox: significativo ? "diferencia >= 15 puntos con n>=5 por variante: aceptable" : "insuficiente: registra más casos por variante antes de decidir",
        consejo: significativo ? "adopta la variante " + mejor.variante + " y cierra el experimento" : "sigue recolectando: decidir ahora es intuición disfrazada de dato",
    });
});
server.tool("close_experiment", "Cierra el experimento archivando el veredicto (qué variante se adoptó y qué se aprendió).", {
    experimento: z.string().describe("Nombre del experimento"),
    ganador: z.string().describe("Variante adoptada"),
    aprendizaje: z.string().describe("Qué se aprendió (para el futuro)"),
}, async (args) => {
    const { experimento, ganador, aprendizaje } = args;
    const st = store.load();
    const e = (st.exps || {})[experimento];
    if (!e)
        return fail("experimento no encontrado");
    if (!e.variantes[ganador])
        return fail("la variante " + ganador + " no existe en este experimento");
    e.cerrado = { ganador, aprendizaje, ts: new Date().toISOString() };
    store.save(st);
    return ok({ experimento, cerrado: true, ganador, aprendizaje: aprendizaje.slice(0, 120) });
});
server.tool("health_check", "Verifica que el servidor prompt-ab-test está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "prompt-ab-test", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[prompt-ab-test] fatal:", e);
    process.exit(1);
});

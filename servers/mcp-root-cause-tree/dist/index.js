#!/usr/bin/env node
/**
 * MCP Server: Root Cause Tree
 * Cinco porqués disciplinados: cada porqué debe responder al anterior o el árbol se corta antes de la raíz
 *
 * Dolor que resuelve: El agente hace 'análisis de causa raíz' en un párrafo: los porqués no se encadenan, saltan de tema y la 'raíz' es en realidad el tercer síntoma. Sin disciplina estructural, el RCA es literatura.
 * Categoría: Auto-Mejora | Generado por mcp-suite | id: root-cause-tree
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
// ——— persistencia local: ~/.mcp-suite/root-cause-tree/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "root-cause-tree");
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
const server = new McpServer({ name: "root-cause-tree", version: "1.0.0" });
server.tool("start_tree", "Abre un árbol de análisis con el problema observable.", {
    problema: z.string().describe("El problema visible (síntoma, no causa)"),
}, async (args) => {
    const { problema } = args;
    const st = store.load();
    st.arboles = st.arboles || [];
    const id = "rct_" + String(st.arboles.length + 1).padStart(4, "0");
    st.arboles.push({ id, problema, niveles: [], raiz_declarada: null, factores: [], creado: new Date().toISOString() });
    store.save(st);
    return ok({ id, problema: problema.slice(0, 100), regla: "cada porqué debe responder EXACTAMENTE al nivel anterior: si cambia de tema, es un árbol nuevo" });
});
server.tool("add_why", "Añade un nivel de porqué respondiendo al nivel anterior.", {
    id: z.string().describe("Id del árbol"),
    respuesta: z.string().describe("Respuesta al porqué actual"),
    evidencia: z.string().describe("Qué te hace creer esa respuesta").optional(),
}, async (args) => {
    const { id, respuesta, evidencia } = args;
    const st = store.load();
    const a = (st.arboles || []).find(x => x.id === id);
    if (!a)
        return fail("árbol no encontrado");
    if (a.raiz_declarada)
        return fail("árbol ya cerrado con raíz: abre otro para explorar más");
    const nivel = a.niveles.length + 1;
    if (nivel > 7)
        return fail("más de 7 porqués: el problema está mal delimitado o estás dando vueltas");
    a.niveles.push({ nivel, respuesta: respuesta.slice(0, 200), evidencia: evidencia || "", ts: new Date().toISOString() });
    store.save(st);
    return ok({ id, nivel, respuesta: respuesta.slice(0, 80), profundidad_recomendada: nivel < 5 ? "sigue preguntando: aún en zona de síntomas" : "zona de raíz: valida antes de profundizar más", siguiente: nivel >= 3 ? "valida la coherencia con validate_chain" : "añade el siguiente porqué" });
});
server.tool("validate_chain", "Valida que la cadena de porqués es coherente: cada respuesta trata sobre la anterior.", {
    id: z.string().describe("Árbol"),
}, async (args) => {
    const { id } = args;
    const st = store.load();
    const a = (st.arboles || []).find(x => x.id === id);
    if (!a)
        return fail("árbol no encontrado");
    const n = a.niveles.length;
    if (n < 2)
        return fail("necesitas al menos 2 niveles");
    const tokens = (x) => new Set(String(x).toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 3));
    const problemas = [];
    for (let i = 1; i < n; i++) {
        const ant = tokens(a.niveles[i - 1].respuesta);
        const act = tokens(a.niveles[i].respuesta);
        const solape = [...ant].filter(w => act.has(w)).length;
        const ratio = solape / Math.max(ant.size, 1);
        if (ratio < 0.08)
            problemas.push({ entre_niveles: [i, i + 1], tipo: "SALTO_DE_TEMA", detalle: "la respuesta " + (i + 1) + " no menciona nada del nivel " + i + ": probablemente cambiaste de problema a mitad de cadena" });
        if (ratio > 0.85)
            problemas.push({ entre_niveles: [i, i + 1], tipo: "TAUTOLOGÍA", detalle: "la respuesta " + (i + 1) + " repite el nivel " + i + " casi igual: estás girando en el sitio" });
    }
    const sinEvidencia = a.niveles.filter(x => !x.evidencia).length;
    return ok({ id, niveles: n, problemas_de_cadena: problemas, niveles_sin_evidencia: sinEvidencia, veredicto: problemas.length ? "cadena ROTA: corrige los saltos antes de declarar raíz (una raíz alcanzada por una cadena rota es una raíz imaginaria)" : "cadena coherente" + (n >= 5 ? " y profunda" : " pero CORTA: con " + n + " niveles sueles parar en síntomas intermedios"), aviso_evidencia: sinEvidencia > n / 2 ? "más de la mitad de los niveles son conjetura sin evidencia: la raíz será una hipótesis, no un hallazgo" : null });
});
server.tool("declare_root", "Declara la causa raíz (con validación de profundidad y factores contribuyentes).", {
    id: z.string().describe("Árbol"),
    causa_raiz: z.string().describe("La causa raíz identificada"),
    tipo_causa: z.enum(["proceso", "conocimiento", "herramienta", "datos", "incentivo", "humana"]).describe("Naturaleza de la raíz"),
    factores_contribuyentes: z.array(z.any()).describe("Factores que empeoraron sin causar").optional(),
}, async (args) => {
    const { id, causa_raiz, tipo_causa, factores_contribuyentes } = args;
    const st = store.load();
    const a = (st.arboles || []).find(x => x.id === id);
    if (!a)
        return fail("árbol no encontrado");
    if (a.raiz_declarada)
        return fail("raíz ya declarada");
    const n = a.niveles.length;
    if (n < 3)
        return fail("con " + n + " niveles has parado demasiado arriba: esa no es raíz, es el síntoma disfrazado");
    a.raiz_declarada = { causa_raiz, tipo_causa, niveles_excavados: n, declarada: new Date().toISOString() };
    a.factores = (factores_contribuyentes || []).map(String);
    store.save(st);
    return ok({ id, causa_raiz: causa_raiz.slice(0, 120), tipo_causa, niveles_excavados: n, factores_contribuyentes: a.factores, correccion_esperada: tipo_causa === "proceso" ? "cambia el PROCESO (checklist, gate): el 'ten más cuidado' no arregla procesos" : tipo_causa === "herramienta" ? "cambia la HERRAMIENTA o su configuración" : tipo_causa === "conocimiento" ? "añade el conocimiento al sistema (doc recuperable, lección en lesson-library)" : tipo_causa === "datos" ? "arregla los DATOS en origen y añade validación de entrada" : tipo_causa === "incentivo" ? "los incentivos hacen que el error sea racional: sin cambiarlos, el error volverá" : "causa humana: simplifica la tarea, no blames al humano" });
});
server.tool("health_check", "Verifica que el servidor root-cause-tree está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "root-cause-tree", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[root-cause-tree] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Hypothesis Tracker
 * Hipótesis científicas del agente: enuncia, prueba y concluye
 *
 * Dolor que resuelve: El agente asume en vez de hipotetizar: sin registro de hipótesis testeables, los supuestos se vuelven 'verdades'.
 * Categoría: Cognición y Planificación | Generado por mcp-suite | id: hypothesis-tracker
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
// ——— persistencia local: ~/.mcp-suite/hypothesis-tracker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "hypothesis-tracker");
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
const server = new McpServer({ name: "hypothesis-tracker", version: "1.0.0" });
server.tool("add", "Registra una hipótesis: enunciado, predicción falsable y cómo testearla.", {
    enunciado: z.string().describe("Hipótesis (ej: X mejorará Y)"),
    prediccion: z.string().describe("Predicción falsable"),
    test: z.string().describe("Cómo testear").optional(),
}, async (args) => {
    const { enunciado, prediccion, test } = args;
    const st = store.load();
    st.hipotesis = st.hipotesis || [];
    const h = { id: "H" + (st.hipotesis.length + 1), enunciado, prediccion, test: test || "", estado: "sin_testear", creada: new Date().toISOString() };
    st.hipotesis.push(h);
    store.save(st);
    return ok({ hipotesis: h });
});
server.tool("record_result", "Registra el resultado de un test de hipótesis: confirmada, refutada o inconclusa (con datos).", {
    id: z.string().describe("ID de hipótesis"),
    resultado: z.enum(["confirmada", "refutada", "inconclusa"]).describe("Resultado"),
    evidencia: z.string().describe("Evidencia observada").optional(),
}, async (args) => {
    const { id, resultado, evidencia } = args;
    const st = store.load();
    const h = (st.hipotesis || []).find((x) => x.id === id);
    if (!h)
        return fail("hipótesis no existe");
    h.estado = resultado;
    h.evidencia = evidencia || "";
    h.testeada = new Date().toISOString();
    store.save(st);
    return ok({ id, estado: resultado });
});
server.tool("report", "Reporte de hipótesis: cuántas confirmadas/refutadas/sin testear y ratio de acierto (calibración del agente).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const hs = st.hipotesis || [];
    const conteo = {};
    for (const h of hs)
        conteo[h.estado] = (conteo[h.estado] || 0) + 1;
    const testeadas = (conteo.confirmada || 0) + (conteo.refutada || 0);
    return ok({ total: hs.length, ...conteo, ratio_confirmacion: testeadas ? Math.round((conteo.confirmada / testeadas) * 100) + "%" : "sin datos", interpretacion: testeadas ? ((conteo.confirmada || 0) / testeadas > 0.8 ? "sobre-confiado: hipótesis demasiado fáciles" : "calibración razonable") : "sin datos", pendientes: hs.filter((h) => h.estado === "sin_testear").map((h) => h.id + ": " + h.enunciado.slice(0, 80)) });
});
server.tool("health_check", "Verifica que el servidor hypothesis-tracker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "hypothesis-tracker", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[hypothesis-tracker] fatal:", e);
    process.exit(1);
});

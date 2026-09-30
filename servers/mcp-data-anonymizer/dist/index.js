#!/usr/bin/env node
/**
 * MCP Server: Data Anonymizer
 * Anonimiza datasets: pseudonimos estables, emails fake y análisis de riesgo de reidentificación
 *
 * Dolor que resuelve: Compartir datasets con PII raw es ilegal: hace falta anonimización con mapeo estable (no romper joins).
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: data-anonymizer
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
// ——— persistencia local: ~/.mcp-suite/data-anonymizer/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "data-anonymizer");
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
const server = new McpServer({ name: "data-anonymizer", version: "1.0.0" });
server.tool("pseudonymize", "Pseudonimiza un dataset: reemplaza valores de columnas sensibles por IDs estables (mismo input → mismo seudónimo, los joins sobreviven).", {
    data: z.array(z.any()).describe("Lista de registros (objetos)"),
    columnas_sensibles: z.array(z.any()).describe("Columnas a pseudonimizar"),
    prefijo: z.string().describe("Prefijo del seudónimo").default("persona"),
}, async (args) => {
    const { data, columnas_sensibles, prefijo } = args;
    const st = store.load();
    st.mapa = st.mapa || {};
    const registros = Array.isArray(data) ? data : [];
    const cols = Array.isArray(columnas_sensibles) ? columnas_sensibles : [];
    let siguiente = st.siguiente || 1;
    const salida = registros.map((reg) => {
        const nuevo = { ...reg };
        for (const c of cols) {
            const original = String(reg[c] ?? "");
            if (!original)
                continue;
            if (!st.mapa[original]) {
                st.mapa[original] = prefijo + "-" + siguiente;
                siguiente++;
            }
            nuevo[c] = st.mapa[original];
        }
        return nuevo;
    });
    st.siguiente = siguiente;
    store.save(st);
    return ok({ registros_procesados: salida.length, valores_mapeados: Object.keys(st.mapa).length, aviso: "el mapa original→seudónimo vive en ~/.mcp-suite: es dato sensible (k-anonimidad depende de él)" });
});
server.tool("reidentification_risk", "Evalúa riesgo de reidentificación de un dataset: cuasi-identificadores (combinaciones únicas) estilo k-anonimidad.", {
    data: z.array(z.any()).describe("Registros"),
    columnas_quasi: z.array(z.any()).describe("Columnas cuasi-identificadoras (edad, ciudad, zip...)"),
}, async (args) => {
    const { data, columnas_quasi } = args;
    const registros = Array.isArray(data) ? data : [];
    const cols = Array.isArray(columnas_quasi) ? columnas_quasi : [];
    if (!registros.length || !cols.length)
        return fail("necesitas data y columnas_quasi");
    const combos = {};
    for (const r of registros) {
        const clave = cols.map((c) => String(r[c] ?? "?")).join("|");
        combos[clave] = (combos[clave] || 0) + 1;
    }
    const grupos = __vals(combos);
    const unicos = grupos.filter((g) => g === 1).length;
    const k = Math.min(...grupos);
    return ok({ registros: registros.length, combinaciones_distintas: Object.keys(combos).length, k_minimo: k, registros_unicos_k1: unicos, riesgo: k === 1 ? "ALTO: hay combinaciones que identifican a una sola persona" : k < 5 ? "MEDIO: k=" + k + ", generaliza más columnas" : "BAJO: k=" + k, recomendacion: k < 5 ? "generaliza (redondear edades, truncar zip) o elimina columnas" : "aceptable" });
});
server.tool("health_check", "Verifica que el servidor data-anonymizer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "data-anonymizer", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[data-anonymizer] fatal:", e);
    process.exit(1);
});

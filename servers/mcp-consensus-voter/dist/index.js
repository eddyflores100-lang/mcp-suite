#!/usr/bin/env node
/**
 * MCP Server: Consensus Voter
 * Votación entre N respuestas del mismo prompt: self-consistency sin infraestructura
 *
 * Dolor que resuelve: Una sola pasada del LLM puede ser un outlier: self-consistency (votar entre N muestras) mejora precisión pero falta tooling.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: consensus-voter
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
// ——— persistencia local: ~/.mcp-suite/consensus-voter/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "consensus-voter");
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
const server = new McpServer({ name: "consensus-voter", version: "1.0.0" });
server.tool("add_answer", "Añade una respuesta candidata (de una pasada distinta) a la pregunta activa.", {
    pregunta: z.string().describe("La pregunta (misma para todas)"),
    respuesta: z.string().describe("Respuesta candidata"),
}, async (args) => {
    const { pregunta, respuesta } = args;
    const st = store.load();
    st.rondas = st.rondas || {};
    const k = pregunta.slice(0, 150);
    st.rondas[k] = st.rondas[k] || { pregunta: k, respuestas: [] };
    st.rondas[k].respuestas.push({ texto: respuesta, ts: new Date().toISOString() });
    store.save(st);
    return ok({ pregunta: k, total_respuestas: st.rondas[k].respuestas.length });
});
server.tool("vote", "Calcula el consenso: agrupa respuestas por similitud (números clave + Jaccard) y devuelve la ganadora con nivel de acuerdo.", {
    pregunta: z.string().describe("La pregunta de la ronda"),
}, async (args) => {
    const { pregunta } = args;
    const st = store.load();
    const k = pregunta.slice(0, 150);
    const ronda = st.rondas?.[k];
    if (!ronda?.respuestas?.length)
        return fail("sin respuestas registradas: add_answer primero");
    const resp = ronda.respuestas.map((r) => String(r.texto));
    const clusters = [];
    for (const texto of resp) {
        const nums = (texto.match(/\d+(\.\d+)?/g) || []).sort().join(",");
        const words = new Set(texto.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
        const cluster = clusters.find((c) => {
            const inter = [...words].filter((w) => c.words.has(w)).length;
            const sim = inter / (words.size + c.words.size - inter || 1);
            const sameNums = nums && nums === c.nums;
            return sim > 0.55 || (sameNums && sim > 0.3);
        });
        if (cluster) {
            cluster.miembros.push(texto);
        }
        else
            clusters.push({ nums, words, miembros: [texto] });
    }
    clusters.sort((a, b) => b.miembros.length - a.miembros.length);
    const ganador = clusters[0];
    const acuerdo = Math.round((ganador.miembros.length / resp.length) * 100);
    return ok({ total_respuestas: resp.length, clusters: clusters.map((c) => ({ votos: c.miembros.length, ejemplo: c.miembros[0].slice(0, 150) })), respuesta_consenso: ganador.miembros[0], acuerdo: acuerdo + "%", fuerte: acuerdo >= 70 });
});
server.tool("health_check", "Verifica que el servidor consensus-voter está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "consensus-voter", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[consensus-voter] fatal:", e);
    process.exit(1);
});

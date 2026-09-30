#!/usr/bin/env node
/**
 * MCP Server: Feedback Loop
 * Recolecta feedback estructurado y detecta sentimiento sin APIs externas
 *
 * Dolor que resuelve: El feedback llega suelto por chat: sin registro ni análisis, el agente repite lo que molesta.
 * Categoría: Comunicación y Humano | Generado por mcp-suite | id: feedback-loop
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
// ——— persistencia local: ~/.mcp-suite/feedback-loop/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "feedback-loop");
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
const server = new McpServer({ name: "feedback-loop", version: "1.0.0" });
server.tool("collect", "Registra feedback: categoría (claridad, velocidad, calidad, error), texto y puntuación opcional 1-5.", {
    categoria: z.enum(["claridad", "velocidad", "calidad", "error", "sugerencia"]).describe("Categoría"),
    texto: z.string().describe("El feedback"),
    puntuacion: z.number().describe("1-5 opcional").optional(),
}, async (args) => {
    const { categoria, texto, puntuacion } = args;
    const st = store.load();
    st.feedback = st.feedback || [];
    st.feedback.push({ categoria, texto, puntuacion: puntuacion ?? null, ts: new Date().toISOString() });
    store.save(st);
    return ok({ total_feedback: st.feedback.length });
});
server.tool("sentiment_lite", "Sentimiento léxico local (ES): positivo/negativo/neutral con los términos detectados, sin APIs.", {
    texto: z.string().describe("Feedback a analizar"),
}, async (args) => {
    const { texto } = args;
    const positivas = ["bien", "excelente", "genial", "gracias", "perfecto", "claro", "útil", "rápido", "sí", "correcto", "me gusta", "funciona", "increíble", "buen", "bueno", "buena", "excelente"];
    const negativas = ["mal", "malo", "mala", "lento", "error", "fallo", "no funciona", "confuso", "no entiendo", "difícil", "peor", "molesto", "no me gusta", "equivocado", "roto", "pésimo", "inútil", "no"];
    const t = " " + texto.toLowerCase() + " ";
    let score = 0;
    const hallados_pos = [];
    const hallados_neg = [];
    for (const p of positivas) {
        const re = new RegExp("\\b" + p + "\\b");
        if (re.test(t)) {
            score++;
            hallados_pos.push(p);
        }
    }
    for (const n of negativas) {
        const re = new RegExp("\\b" + n + "\\b");
        if (re.test(t)) {
            score--;
            hallados_neg.push(n);
        }
    }
    const excl = /[!]{2,}/.test(texto) ? 1 : 0;
    const sentimiento = score + excl > 0 ? "positivo" : score < 0 ? "negativo" : "neutral";
    return ok({ sentimiento, score, terminos_positivos: hallados_pos, terminos_negativos: hallados_neg, intensidad: Math.abs(score) });
});
server.tool("summarize_feedback", "Resumen del feedback acumulado: promedio por categoría, temas frecuentes y sentimiento global.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const fb = st.feedback || [];
    if (!fb.length)
        return fail("sin feedback registrado");
    const por_categoria = {};
    for (const f of fb) {
        por_categoria[f.categoria] = por_categoria[f.categoria] || { n: 0, suma: 0, textos: [] };
        por_categoria[f.categoria].n++;
        if (f.puntuacion)
            por_categoria[f.categoria].suma += f.puntuacion;
        por_categoria[f.categoria].textos.push(f.texto);
    }
    const resumen = __ents(por_categoria).map(([cat, d]) => ({ categoria: cat, n: d.n, promedio: d.suma ? Math.round((d.suma / d.n) * 10) / 10 : null, ejemplo: d.textos[0]?.slice(0, 80) }));
    const scores = fb.filter((f) => f.puntuacion).map((f) => f.puntuacion);
    return ok({ total: fb.length, promedio_global: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null, por_categoria: resumen });
});
server.tool("health_check", "Verifica que el servidor feedback-loop está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "feedback-loop", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[feedback-loop] fatal:", e);
    process.exit(1);
});

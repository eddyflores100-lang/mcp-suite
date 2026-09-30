#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Recommender
 * Recomienda skills MCP por caso de uso con evidencia de score y categoría
 *
 * Dolor que resuelve: Con 66.496 skills el agente se ahoga: elegir la skill correcta para un caso de uso es el cuello de botella.
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-recommend
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
// ——— datos embebidos (carpeta data/) ———
function loadData(name) {
    const p = fileURLToPath(new URL("../data/" + name, import.meta.url));
    return JSON.parse(readFileSync(p, "utf8"));
}
const server = new McpServer({ name: "marketnow-recommend", version: "1.0.0" });
server.tool("recommend_for_use_case", "Dado un caso de uso en lenguaje natural (ej: 'manejar postgres', 'scrapear web'), recomienda las skills top del snapshot por afinidad de palabras + score.", {
    caso_uso: z.string().describe("Qué quieres resolver"),
    max: z.number().describe("Máximo recomendaciones").default(5),
}, async (args) => {
    const { caso_uso, max } = args;
    const snap = loadData("skills-snapshot.json");
    const words = caso_uso.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
    const sinonimos = { db: "postgres", database: "postgres", web: "scrape", scraping: "scrape", browser: "playwright", chat: "discord", mail: "email", search: "search", money: "finance", secure: "security" };
    const expanded = [...new Set([...words, ...words.map(w => sinonimos[w] || "").filter(Boolean)])];
    const scored = snap.skills.map(s => {
        const texto = (s.name + " " + s.description + " " + (s.tags || []).join(" ")).toLowerCase();
        let af = 0;
        for (const w of expanded)
            if (texto.includes(w))
                af++;
        return { skill: s, afinidad: af, valor: af * 10 + (s.sentinel_score ?? 0) };
    }).filter(x => x.afinidad > 0).sort((a, b) => b.valor - a.valor).slice(0, max ?? 5);
    return ok({ caso_uso, recomendaciones: scored.map(x => ({ name: x.skill.name, score: x.skill.sentinel_score, install: x.skill.install, desc: x.skill.description.slice(0, 120), afinidad: x.afinidad })) });
});
server.tool("top_by_category", "Top skills por categoría del snapshot, ordenadas por sentinel score.", {
    categoria: z.string().describe("Categoría (ej: Developer Tools, Security, AI/ML, Data)"),
    n: z.number().describe("Cuántas").default(5),
}, async (args) => {
    const { categoria, n } = args;
    const snap = loadData("skills-snapshot.json");
    const items = snap.skills.filter(s => (s.category || "").toLowerCase() === categoria.toLowerCase())
        .sort((a, b) => (b.sentinel_score ?? 0) - (a.sentinel_score ?? 0)).slice(0, n ?? 5);
    if (!items.length)
        return fail("categoría no encontrada. Usa list_categories del MCP marketnow-search");
    return ok({ categoria, top: items.map(s => ({ name: s.name, score: s.sentinel_score, install: s.install, price: s.price })) });
});
server.tool("best_free", "Las mejores skills gratuitas del snapshot (score máximo, price=0): oro gratis para presupuestos ajustados.", {
    n: z.number().describe("Cuántas").default(10),
}, async (args) => {
    const { n } = args;
    const snap = loadData("skills-snapshot.json");
    const items = snap.skills.filter(s => (s.price ?? 0) === 0 && (s.sentinel_score ?? 0) >= 8)
        .sort((a, b) => (b.sentinel_score ?? 0) - (a.sentinel_score ?? 0)).slice(0, n ?? 10);
    return ok({ gratis_y_seguras: items.map(s => ({ name: s.name, score: s.sentinel_score, install: s.install, categoria: s.category })) });
});
server.tool("health_check", "Verifica que el servidor marketnow-recommend está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "marketnow-recommend", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[marketnow-recommend] fatal:", e);
    process.exit(1);
});

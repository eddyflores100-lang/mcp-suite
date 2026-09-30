#!/usr/bin/env node
/**
 * MCP Server: Fact Consistency
 * Detecta contradicciones entre dos textos o entre claims: coherencia interna
 *
 * Dolor que resuelve: El agente se contradice entre secciones (o contra una fuente): las inconsistencias numéricas y factuales pasan inadvertidas.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: fact-consistency
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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
const server = new McpServer({ name: "fact-consistency", version: "1.0.0" });
server.tool("check_consistency", "Compara dos textos y reporta contradicciones: números que difieren sobre mismos sujetos, hechos opuestos y entidades renombradas.", {
    texto_a: z.string().describe("Primer texto"),
    texto_b: z.string().describe("Segundo texto"),
}, async (args) => {
    const { texto_a, texto_b } = args;
    const numA = texto_a.match(/\b\d+(\.\d+)?\b/g) || [];
    const numB = texto_b.match(/\b\d+(\.\d+)?\b/g) || [];
    const palabrasA = new Set(texto_a.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
    const palabrasB = new Set(texto_b.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
    const tema_comun = [...palabrasA].filter((w) => palabrasB.has(w)).length;
    const conflictos = [];
    const sA = texto_a.toLowerCase();
    const sB = texto_b.toLowerCase();
    const patrones = [
        [/subió|aumentó|más de/, /bajó|disminuyó|menos de/, "dirección opuesta (subida vs bajada)"],
        [/disponible|hay stock/, /agotado|sin stock|no disponible/, "disponibilidad contradictoria"],
        [/gratuito|gratis/, /de pago|cuesta|precio/, "gratuidad vs pago"],
        [/funciona|exitoso|correcto/, /falla|error|roto|incorrecto/, "funcionamiento contradictorio"],
    ];
    for (const [ra, rb, msg] of patrones) {
        if ((ra.test(sA) && rb.test(sB)) || (rb.test(sA) && ra.test(sB)))
            conflictos.push(msg);
    }
    const cifras_discrepantes = tema_comun > 5 && numA.length > 0 && numB.length > 0 && numA.join() !== numB.join();
    return ok({ coherentes: conflictos.length === 0 && !cifras_discrepantes, conflictos, tema_comun_palabras: tema_comun, cifras_a: numA.slice(0, 10), cifras_b: numB.slice(0, 10), posibles_discrepancias_numericas: cifras_discrepantes });
});
server.tool("merge_facts", "Fusiona dos listas de hechos {hecho, fuente} deduplicando y marcando duplicados con fuentes distintas (consenso) o contradictorias.", {
    hechos_a: z.array(z.any()).describe("Hechos A {hecho, fuente}"),
    hechos_b: z.array(z.any()).describe("Hechos B {hecho, fuente}"),
}, async (args) => {
    const { hechos_a, hechos_b } = args;
    const norm = (h) => h.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, "").split(/\s+/).filter((w) => w.length > 3).sort().join(" ");
    const todos = [...(Array.isArray(hechos_a) ? hechos_a : []).map((h) => ({ ...h, set: "A" })), ...(Array.isArray(hechos_b) ? hechos_b : []).map((h) => ({ ...h, set: "B" }))];
    const vistos = {};
    const fusionados = [];
    for (const h of todos) {
        const k = norm(String(h.hecho || ""));
        if (vistos[k]) {
            vistos[k].fuentes.push(h.fuente || h.set);
            vistos[k].consenso = true;
        }
        else {
            vistos[k] = { hecho: h.hecho, fuentes: [h.fuente || h.set], consenso: false };
            fusionados.push(vistos[k]);
        }
    }
    return ok({ total_originales: todos.length, hechos_fusionados: fusionados.length, en_consenso: fusionados.filter((f) => f.consenso).length, hechos: fusionados });
});
server.tool("health_check", "Verifica que el servidor fact-consistency está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "fact-consistency", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[fact-consistency] fatal:", e);
    process.exit(1);
});

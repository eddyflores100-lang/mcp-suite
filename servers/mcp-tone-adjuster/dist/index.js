#!/usr/bin/env node
/**
 * MCP Server: Tone Adjuster
 * Analiza y ajusta el tono del texto del agente: formalidad, cortesía y claridad
 *
 * Dolor que resuelve: El agente responde con tono inadecuado (demasiado seco para clientes, demasiado efusivo para técnicos): nadie mide el tono.
 * Categoría: Comunicación y Humano | Generado por mcp-suite | id: tone-adjuster
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
const server = new McpServer({ name: "tone-adjuster", version: "1.0.0" });
server.tool("analyze_tone", "Analiza el tono de un texto: formalidad (léxico), cortesía, asertividad, longitud de oraciones y jerga técnica.", {
    texto: z.string().describe("Texto a analizar"),
}, async (args) => {
    const { texto } = args;
    const t = String(texto);
    const palabras = t.split(/\s+/).filter(Boolean);
    const oraciones = t.split(/[.!?]+/).filter((s) => s.trim());
    const formal = ["por lo tanto", "asimismo", "en consecuencia", "sírvase", "agradezco", "cordialmente", "estimado", "adjunto", "conforme", "de acuerdo con"];
    const informal = ["ok", "dale", "ya quoi", "bueno", "o sea", "en plan", "tío", "chevere", "bacán", "ni modo"];
    const cortes = ["por favor", "gracias", "podrías", "te agradecería", "cuando puedas", "disculpa", "permiso"];
    const jerga = ["deploy", "endpoint", "payload", "rollback", "k8s", "latencia", "throughput", "idempotente", "schema", "parse"];
    const contar = (lista) => lista.filter((f) => t.toLowerCase().includes(f)).length;
    const f = contar(formal), inf = contar(informal), c = contar(cortes), j = contar(jerga);
    const prom_oracion = oraciones.length ? Math.round(palabras.length / oraciones.length) : 0;
    const formalidad = f > inf ? "formal" : inf > f ? "informal" : "neutral";
    return ok({ formalidad, cortesia: c > 0 ? "presente" : "ausente", jerga_tecnica: j, palabras, prom_palabras_por_oracion: prom_oracion, exhortacion: prom_oracion > 25 ? "oraciones largas: partir para claridad" : "ok", lecturabilidad: prom_oracion < 15 ? "alta" : prom_oracion < 25 ? "media" : "baja" });
});
server.tool("adjust_hints", "Devuelve instrucciones concretas para ajustar el tono al objetivo deseado (profesional, cálido, técnico, directo).", {
    tono_objetivo: z.enum(["profesional", "calido", "tecnico", "directo", "empatico"]).describe("Tono deseado"),
    texto: z.string().describe("Texto actual").optional(),
}, async (args) => {
    const { tono_objetivo, texto } = args;
    const guias = {
        profesional: ["elimina muletillas e informalidades", "usa tratamientos formales (usted/estimado)", "cifras y datos concretos", "cierre con acción clara"],
        calido: ["saluda por nombre si lo conoces", "agradecer antes de pedir", "suaviza imperativos: 'podrías revisar' vs 'revisa'", "emojis solo si el canal los usa"],
        tecnico: ["precisión sobre prosa", "nombra versiones/ids exactos", "incluye comandos/logs textuales", "evita adjetivos calificativos"],
        directo: ["una idea por oración", "la petición en la primera línea", "elimina preámbulos", "bullets para listas"],
        empatico: ["reconoce el problema antes de proponer", "evita 'simplemente' y 'solo tienes que'", "ofrece 2 caminos con trade-offs", "cierra con disposición de ayuda"],
    };
    const hints = guias[tono_objetivo] || guias.profesional;
    return ok({ tono_objetivo, hints: hints.map((h) => "- " + h) });
});
server.tool("health_check", "Verifica que el servidor tone-adjuster está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "tone-adjuster", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[tone-adjuster] fatal:", e);
    process.exit(1);
});

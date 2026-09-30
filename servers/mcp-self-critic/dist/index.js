#!/usr/bin/env node
/**
 * MCP Server: Self Critic
 * El agente se critica a sí mismo: checklist de reflexión antes de entregar
 *
 * Dolor que resuelve: Sin reflexión previa a la entrega, el agente repite errores evitables (técnica reflect de los papers de agentes).
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: self-critic
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
const server = new McpServer({ name: "self-critic", version: "1.0.0" });
server.tool("critique", "Aplica checklist de autocrítica a una salida: rigor, completitud, sesgos, seguridad y accionabilidad. Genera issues concretos.", {
    salida: z.string().describe("Salida a criticar"),
    tarea: z.string().describe("Tarea original que debía resolver"),
}, async (args) => {
    const { salida, tarea } = args;
    const t = salida;
    const issues = [];
    if (t.length < 80)
        issues.push({ severidad: "alta", issue: "salida mínima para la tarea: ¿falta desarrollo?" });
    if (/\b(por supuesto|obviamente|como todos saben|es bien conocido)\b/i.test(t))
        issues.push({ severidad: "media", issue: "presuposiciones no verificadas: cites o elimina" });
    if (t.toLowerCase().split(/\s+/).filter((w) => ["bueno", "malo", "mejor", "peor"].includes(w)).length > 6)
        issues.push({ severidad: "media", issue: "juicios de valor sin criterios explícitos" });
    if (!/\d/.test(t) && /analiza|compara|cifra|dato|estadístic/i.test(tarea))
        issues.push({ severidad: "alta", issue: "tarea pedía análisis y la salida no tiene ni un número" });
    if (/\b(nunca|siempre|todos|ninguno|imposible)\b/i.test(t))
        issues.push({ severidad: "media", issue: "generalizaciones absolutas: súqualas o matízalas" });
    if (!/(paso|1\.|2\.|primero|luego|finalmente)/i.test(t) && /instrucc|cómo|how|guía|tutorial/i.test(tarea))
        issues.push({ severidad: "media", issue: "instrucciones sin secuencia clara" });
    const score = Math.max(0, 100 - issues.reduce((a, i) => a + (i.severidad === "alta" ? 30 : 12), 0));
    return ok({ score_autocritica: score, issues, veredicto: score >= 75 ? "entregable" : score >= 50 ? "corregir antes de entregar" : "revisar profundamente" });
});
server.tool("reflect_prompt", "Genera el prompt de reflexión (estilo Reflexion) para que el modelo mejore su salida en el siguiente intento.", {
    tarea: z.string().describe("La tarea original"),
    intento: z.string().describe("El intento fallido"),
    feedback: z.string().describe("Qué salió mal").optional(),
}, async (args) => {
    const { tarea, intento, feedback } = args;
    const prompt = [
        "Reflexiona sobre tu intento anterior y mejora la respuesta.",
        "TAREA ORIGINAL: " + tarea,
        "INTENTO ANTERIOR: " + String(intento).slice(0, 2000),
        feedback ? "FEEDBACK RECIBIDO: " + feedback : "",
        "INSTRUCCIONES:",
        "1. Identifica 2-3 errores concretos del intento anterior",
        "2. Explica por qué ocurrieron",
        "3. Produce una versión corregida que evite esos errores",
        "4. Verifica contra la tarea original antes de responder",
    ].filter(Boolean).join("\n\n");
    return ok({ prompt_de_reflexion: prompt });
});
server.tool("health_check", "Verifica que el servidor self-critic está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "self-critic", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[self-critic] fatal:", e);
    process.exit(1);
});

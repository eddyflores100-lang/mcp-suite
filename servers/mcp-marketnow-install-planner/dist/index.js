#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Install Planner
 * Planifica instalaciones de skills MCP: comandos, orden, riesgos y validación previa
 *
 * Dolor que resuelve: Instalar skills MCP a ciegas rompe entornos: el agente necesita un plan con comandos exactos, riesgo por skill y orden de instalación.
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-install-planner
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
const server = new McpServer({ name: "marketnow-install-planner", version: "1.0.0" });
server.tool("plan_install", "Dada una lista de skills (ids o nombres del snapshot), genera un plan: comando de instalación exacto, tier de riesgo, dependencias de orden y checklist previo.", {
    skills: z.array(z.any()).describe("Lista de ids o nombres de skills a instalar"),
}, async (args) => {
    const { skills } = args;
    const snap = loadData("skills-snapshot.json");
    const plan = [];
    for (const raw of skills) {
        const key = String(raw).toLowerCase();
        const s = snap.skills.find(x => (x.id || "").toLowerCase() === key || (x.name || "").toLowerCase() === key || (x.slug || "").toLowerCase() === key);
        if (!s) {
            plan.push({ skill: raw, encontrado: false });
            continue;
        }
        const sc = s.sentinel_score ?? 0;
        plan.push({ skill: s.name, encontrado: true, install: s.install, score: sc, tier: sc >= 8 ? "safe" : sc >= 5 ? "caution" : sc >= 3 ? "risky" : "dangerous", accion: sc >= 8 ? "instalar directo" : "revisar README y permisos antes" });
    }
    const peligros = plan.filter(p => p.tier === "risky" || p.tier === "dangerous");
    return ok({ plan, orden: plan.map(p => p.install).filter(Boolean), alertas: peligros.length ? peligros.length + " skills requieren revisión manual" : "ninguna" });
});
server.tool("validate_install_command", "Valida un comando de instalación (npx/npm install/pip): detecta flags peligrosos, versiones no fijadas, curl|sh y uso de sudo.", {
    comando: z.string().describe("Comando a validar"),
}, async (args) => {
    const { comando } = args;
    const c = comando.toLowerCase();
    const hallazgos = [];
    if (c.includes("curl") && c.includes("|") && (c.includes("sh") || c.includes("bash")))
        hallazgos.push("CRÍTICO: curl | sh ejecuta código remoto sin inspección");
    if (c.includes("sudo"))
        hallazgos.push("ALTO: sudo eleva privilegios");
    if (c.includes("--force") || c.includes("-f "))
        hallazgos.push("MEDIO: force ignora validaciones");
    if (c.includes("npm i ") || c.includes("npm install ")) {
        if (!/@\d|@latest/.test(c))
            hallazgos.push("BAJO: versión no fijada — reproducibilidad sufre");
    }
    if (c.startsWith("npx -y") || c.includes("npx --yes"))
        hallazgos.push("INFO: npx -y descarga sin confirmar; verifica sentinel_score primero");
    const nivel = hallazgos.some(h => h.startsWith("CRÍTICO")) ? "rechazar" : hallazgos.some(h => h.startsWith("ALTO")) ? "revisar" : "ok";
    return ok({ comando, nivel, hallazgos });
});
server.tool("prerequisitos", "Checklist de prerrequisitos antes de instalar skills MCP: runtime, config del cliente, variables de entorno y espacio.", {
    cliente: z.enum(["claude-desktop", "cursor", "cline", "continue", "aider"]).describe("Cliente MCP objetivo").default("claude-desktop"),
}, async (args) => {
    const { cliente } = args;
    return ok({ cliente, pasos: [
            "1. Verifica node >= 18 (node -v) y npm (npm -v)",
            "2. Backup del archivo de config del cliente (" + cliente + ")",
            "3. Consulta sentinel_score de cada skill (marketnow-trust)",
            "4. Prepara variables de entorno requeridas (nunca hardcodear secrets)",
            "5. Instala de a una skill y prueba health_check antes de la siguiente",
            "6. Documenta qué skills quedaron registradas y por qué",
        ], tip: "MarketNow expone marketnow-mcp como instalador: npx -y marketnow-mcp" });
});
server.tool("health_check", "Verifica que el servidor marketnow-install-planner está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "marketnow-install-planner", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[marketnow-install-planner] fatal:", e);
    process.exit(1);
});

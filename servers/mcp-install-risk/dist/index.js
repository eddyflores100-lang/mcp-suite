#!/usr/bin/env node
/**
 * MCP Server: Install Risk
 * Clasifica el riesgo de instalar cualquier paquete/comando antes de ejecutarlo
 *
 * Dolor que resuelve: npm install a ciegas rompe entornos e instala malware: falta una capa de clasificación de riesgo previa a toda instalación.
 * Categoría: MarketNow Ops | Generado por mcp-suite | id: install-risk
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
const server = new McpServer({ name: "install-risk", version: "1.0.0" });
server.tool("classify_command", "Clasifica cualquier comando shell en tier de riesgo de instalación (safe/caution/risky/dangerous) con reglas explicadas.", {
    comando: z.string().describe("Comando completo a clasificar"),
}, async (args) => {
    const { comando } = args;
    const c = comando.toLowerCase();
    let puntos = 0;
    const motivos = [];
    const reglas = [
        ["curl", 1, "descarga de red"], ["wget", 1, "descarga de red"],
        ["sudo", 3, "privilegios elevados"], ["rm ", 3, "borrado de archivos"],
        ["| sh", 4, "ejecución de stream"], ["| bash", 4, "ejecución de stream"],
        ["chmod 777", 2, "permisos peligrosos"], ["--force", 1, "ignora validaciones"],
        ["npx -y", 1, "auto-descarga"], ["eval ", 3, "eval dinámico"],
        ["> /etc", 4, "escritura en sistema"], ["mkfs", 5, "formateo de disco"],
        ["dd if=", 4, "escritura cruda de disco"],
    ];
    for (const [pat, pts, motivo] of reglas)
        if (c.includes(pat)) {
            puntos += pts;
            motivos.push(motivo + " (" + pts + ")");
        }
    const tier = puntos >= 6 ? "dangerous" : puntos >= 3 ? "risky" : puntos >= 1 ? "caution" : "safe";
    return ok({ comando, puntos, tier, motivos, accion: tier === "safe" ? "proceder" : tier === "caution" ? "proceder con monitoreo" : "revisar manualmente o abortar" });
});
server.tool("safer_alternative", "Sugiere una versión más segura de un comando riesgoso: fijar versión, quitar sudo/force, evitar pipe-to-shell.", {
    comando: z.string().describe("Comando a mejorar"),
}, async (args) => {
    const { comando } = args;
    let mejorado = comando;
    const cambios = [];
    if (/npx\s+(--yes\s+)?(?!-y)/.test(mejorado) && !/@\d/.test(mejorado)) {
        cambios.push("fijar versión del paquete");
    }
    if (mejorado.includes("sudo")) {
        mejorado = mejorado.replace(/sudo\s+/g, "");
        cambios.push("quitar sudo");
    }
    if (mejorado.includes("--force")) {
        mejorado = mejorado.replace(/\s--force/g, "");
        cambios.push("quitar --force");
    }
    if (/curl[^|]*\|\s*(ba)?sh/.test(mejorado)) {
        cambios.push("descargar el script, revisarlo, luego ejecutarlo");
    }
    if (/npm\s+install\s+\S+/.test(mejorado) && !/@\d/.test(mejorado)) {
        cambios.push("usar npm install paquete@x.y.z exacta");
    }
    return ok({ original: comando, mejorado, cambios, nota: cambios.length ? "aplica los cambios listados" : "el comando ya es razonablemente seguro" });
});
server.tool("health_check", "Verifica que el servidor install-risk está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "install-risk", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[install-risk] fatal:", e);
    process.exit(1);
});

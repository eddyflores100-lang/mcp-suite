#!/usr/bin/env node
/**
 * MCP Server: Skill Publisher
 * Prepara tu skill para publicar en MarketNow: checklist L1, manifest y readme generados
 *
 * Dolor que resuelve: Publicar una skill requiere README, manifest, licencia y checks de seguridad: mucha fricción para el dev que quiere monetizar.
 * Categoría: MarketNow Ops | Generado por mcp-suite | id: skill-publisher
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
const server = new McpServer({ name: "skill-publisher", version: "1.0.0" });
server.tool("check_readiness", "Evalúa si tu skill está lista para publicar: exige nombre, descripción, install command, licencia y repo. Checklist completo.", {
    skill: z.any().describe("Datos de la skill: {name, description, install, license, repository}"),
}, async (args) => {
    const { skill } = args;
    const s = skill || {};
    const faltan = [];
    if (!s.name)
        faltan.push("name");
    if (!s.description || s.description.length < 30)
        faltan.push("description >= 30 chars");
    if (!s.install)
        faltan.push("install command");
    if (!s.license)
        faltan.push("license");
    if (!s.repository)
        faltan.push("repository URL");
    return ok({ lista_para_publicar: faltan.length === 0, faltan, siguientes_pasos: faltan.length ? "completa los campos faltantes" : "envía a auditoría Sentinel v3.0 (gratis) y define precio" });
});
server.tool("generate_manifest", "Genera un package.json pulido para publicar como skill MCP: metadata completa, bin, keywords mcp.", {
    nombre: z.string().describe("Nombre del paquete (sin @scope)"),
    version: z.string().describe("Versión semver").default("1.0.0"),
    descripcion: z.string().describe("Descripción de la skill"),
    licencia: z.string().describe("Licencia").default("MIT"),
    repo: z.string().describe("URL del repositorio").optional(),
    autor: z.string().describe("Nombre del autor").optional(),
}, async (args) => {
    const { nombre, version, descripcion, licencia, repo, autor } = args;
    const manifest = {
        name: nombre.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        version: version || "1.0.0",
        description: descripcion,
        license: licencia || "MIT",
        type: "module",
        main: "dist/index.js",
        bin: { [nombre.toLowerCase().replace(/[^a-z0-9-]/g, "-")]: "dist/index.js" },
        scripts: { build: "tsc -p ." },
        keywords: ["mcp", "model-context-protocol", "ai-agent", "skill"],
        author: autor || "",
        repository: repo ? { type: "git", url: repo } : undefined,
        mcp: { transport: "stdio" },
    };
    return ok({ manifest, siguiente_paso: "usa sentinel-lite scan_manifest para validar antes de publicar" });
});
server.tool("readme_template", "Genera un README.md de plantilla de alta conversión para tu skill (qué resuelve, tools, install, config).", {
    nombre: z.string().describe("Nombre de la skill"),
    resuelve: z.string().describe("Qué problema resuelve"),
    install_cmd: z.string().describe("Comando de instalación"),
}, async (args) => {
    const { nombre, resuelve, install_cmd } = args;
    const fence = String.fromCharCode(96, 96, 96);
    const json_cfg = '{ "mcpServers": { "' + nombre.toLowerCase().replace(/[^a-z0-9-]/g, "-") + '": { "command": "node", "args": ["./dist/index.js"] } } }';
    const readme = [
        "# " + nombre, "",
        "> " + resuelve, "",
        "## Instalación", "", fence + "bash", install_cmd, fence, "",
        "## Configuración (Claude Desktop)", "", fence + "json", json_cfg, fence, "",
        "## Tools", "", "- health_check: verifica el servidor", "",
        "## Seguridad", "",
        "- Sin telemetría, sin acceso a red salvo indicado - Estado local en ~/.mcp-suite/", "",
    ].join("\n");
    return ok({ readme });
});
server.tool("health_check", "Verifica que el servidor skill-publisher está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "skill-publisher", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[skill-publisher] fatal:", e);
    process.exit(1);
});

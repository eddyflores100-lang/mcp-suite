#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Quickstart
 * Guía al agente para operar el marketplace: instalar, buscar, publicar y cobrar
 *
 * Dolor que resuelve: El agente llega al marketplace sin manual: qué endpoints usar, cómo instalar, cómo publicar skill propia y cómo cobran las comisiones.
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-quickstart
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
const server = new McpServer({ name: "marketnow-quickstart", version: "1.0.0" });
server.tool("how_to_install", "Cómo instalar skills del marketplace: instalador oficial, clientes soportados y flujo recomendado.", {
// sin parámetros
}, async (args) => {
    return ok({ instalador_oficial: "npx -y marketnow-mcp", instalador_stack: "npx -y marketnow-install-stack", clientes: ["Claude Desktop", "Cursor", "Cline", "Continue", "Aider"], flujo: ["buscar skill (search_skills)", "revisar sentinel_score y tier", "instalar via npx", "verificar con health_check", "registrar en config del cliente"] });
});
server.tool("how_to_publish", "Cómo publicar tu skill en MarketNow: requisitos L1, auditoría Sentinel gratis y modelo económico (80/20).", {
// sin parámetros
}, async (args) => {
    return ok({ pasos: [
            "1. Repo público con README, manifest (package.json) y licencia",
            "2. Pasa los 10 checks L1 (usa el MCP sentinel-lite para auto-evaluar)",
            "3. Envía a auditoría Sentinel v3.0 (gratis)",
            "4. Define precio (0 = gratis) — listado es gratis",
            "5. Publica: cada venta te deja el 80%, MarketNow retiene 20%",
        ], requisitos_minimos: ["README", "manifest", "licencia", "sin secrets", "install reproducible"] });
});
server.tool("marketplace_facts", "Cifras clave del marketplace MarketNow para decisiones rápidas: tamaño, scans, comisiones, licencia del sitio.", {
// sin parámetros
}, async (args) => {
    return ok({ skills_indexadas: "66.496+", tracked_ecosistema: "130.845", l2_deep_scans: "688 tarballs (29 reglas Sentinel)", comision_seller: "20% (seller conserva 80%)", afiliados: "5% de referidos", coste_listado: "gratis (auditoría Sentinel incluida)", licencia_sitio: "MNNC-1.0 (source-available), AliceLabs LLC", transporte_remoto: "SSE/WebSocket/JSON-RPC en /api/mcp" });
});
server.tool("health_check", "Verifica que el servidor marketnow-quickstart está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "marketnow-quickstart", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[marketnow-quickstart] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Debug Console
 * Introspección del entorno del agente: capacidades, variables y salud del runtime
 *
 * Dolor que resuelve: Debuggear a ciegas: el agente no sabe qué runtime, variables o versiones tiene debajo.
 * Categoría: Observabilidad | Generado por mcp-suite | id: debug-console
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { homedir, tmpdir, cpus, freemem, totalmem } from "node:os";

// ——— helpers de respuesta ———
function ok(data: any) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg: any) {
  return { content: [{ type: "text" as const, text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true as const };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o: any): any[] { return Object.values(o); }
function __ents(o: any): [string, any][] { return Object.entries(o); }

const server = new McpServer({ name: "debug-console", version: "1.0.0" });

server.tool(
  "env_probe",
  "Sondea el entorno: versión de node, plataforma, CPUs, memoria y variables de entorno RELEVANTES (solo whitelist, nunca valores secretos).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const seguras = ["NODE_ENV", "LANG", "TZ", "SHELL", "TERM", "HOME"];
const detectadas: any = {};
for (const k of seguras) if (process.env[k]) detectadas[k] = process.env[k];
return ok({ node: process.version, plataforma: process.platform, arquitectura: process.arch, cpus: cpus().length, memoria_libre_mb: Math.round(freemem() / 1048576), memoria_total_mb: Math.round(totalmem() / 1048576), uptime_proceso_s: Math.round(process.uptime()), env_seguras: detectadas, nota: "nunca se exponen valores de secrets" });
  }
);

server.tool(
  "capabilities",
  "Reporta las capacidades de este runtime MCP: transporte, tools disponibles y features del entorno.",
  {
  // sin parámetros
  },
  async (args: any) => {
    return ok({ servidor: "debug-console", transporte: "stdio", protocolo: "MCP 2025-03-26", features: { fetch_global: typeof fetch === "function", crypto_node: true, fs_local: true, persistencia: "~/.mcp-suite/" }, red: typeof fetch === "function" ? "disponible" : "no" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor debug-console está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "debug-console", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[debug-console] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: OWASP MCP Matrix
 * Matriz de cumplimiento del OWASP MCP Cheat Sheet: 12 controles, auto-evaluación y reporte
 *
 * Dolor que resuelve: Construir MCP servers sin checklist de seguridad OWASP: faltan controles estandarizados (authz, secrets, sandbox, logging).
 * Categoría: MarketNow Ops | Generado por mcp-suite | id: owasp-mcp-matrix
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";


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

const server = new McpServer({ name: "owasp-mcp-matrix", version: "1.0.0" });

server.tool(
  "get_controls",
  "Los 12 controles del OWASP MCP Cheat Sheet con estado recomendado y cómo implementarlos.",
  {
  // sin parámetros
  },
  async (args: any) => {
    return ok({ controles: [
  { c: "MC-1", nombre: "Autenticación del servidor", como: "tokens/API keys, nunca anon en producción" },
  { c: "MC-2", nombre: "Autorización por tool", como: "scopes por herramienta, least privilege" },
  { c: "MC-3", nombre: "Secrets fuera del código", como: "variables de entorno / vault" },
  { c: "MC-4", nombre: "Sandboxing de ejecución", como: "gVisor/contenedores para código externo" },
  { c: "MC-5", nombre: "Validación de inputs", como: "schemas estrictos en cada tool" },
  { c: "MC-6", nombre: "Rate limiting", como: "límites por cliente/tool" },
  { c: "MC-7", nombre: "Sanitización de prompts", como: "escanear inyecciones en entradas" },
  { c: "MC-8", nombre: "Logging auditable", como: "bitácora inmutable de llamadas" },
  { c: "MC-9", nombre: "Cifrado en tránsito", como: "TLS en transportes remotos" },
  { c: "MC-10", nombre: "Monitoreo de anomalías", como: "métricas y alertas de abuso" },
  { c: "MC-11", nombre: "Rotación de credenciales", como: "expiración y revocación" },
  { c: "MC-12", nombre: "Respuesta a incidentes", como: "plan de contención y kill-switch" },
] });
  }
);

server.tool(
  "self_assess",
  "Auto-evaluación: marca qué controles cumples (lista de IDs) y obtiene score de cumplimiento + brechas críticas.",
  {
  cumplidos: z.array(z.any()).describe("IDs cumplidos (ej: ['MC-1','MC-3'])"),
  },
  async (args: any) => {
    const { cumplidos } = args as any;
    const todos = ["MC-1","MC-2","MC-3","MC-4","MC-5","MC-6","MC-7","MC-8","MC-9","MC-10","MC-11","MC-12"];
const hechos = new Set((Array.isArray(cumplidos) ? cumplidos : []).map((x) => String(x).toUpperCase()));
const faltan = todos.filter((c) => !hechos.has(c));
const criticos = faltan.filter((c) => ["MC-1", "MC-2", "MC-3", "MC-5", "MC-8"].includes(c));
return ok({ cumplidos: hechos.size + "/12", score: Math.round((hechos.size / 12) * 100) + "%", faltan, criticos: criticos.length ? criticos : "ninguno", veredicto: criticos.length === 0 ? "Aceptable" : "Brechas críticas: atender antes de producción" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor owasp-mcp-matrix está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "owasp-mcp-matrix", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[owasp-mcp-matrix] fatal:", e);
  process.exit(1);
});

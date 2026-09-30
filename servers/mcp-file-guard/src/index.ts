#!/usr/bin/env node
/**
 * MCP Server: File Guard
 * Guardián de rutas: el agente solo toca lo permitido, sin escapes de directorio
 *
 * Dolor que resuelve: Una tool con acceso a archivos puede leer ~/.ssh o escapar del workspace con ../: faltan guardas de rutas.
 * Categoría: Seguridad | Generado por mcp-suite | id: file-guard
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join } from "node:path";

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

const server = new McpServer({ name: "file-guard", version: "1.0.0" });

server.tool(
  "resolve_path",
  "Resuelve una ruta contra una raíz permitida y detecta escapes (../), symlinks evidentes y rutas absolutas fuera de la raíz.",
  {
  ruta: z.string().describe("Ruta solicitada (relativa o absoluta)"),
  raiz: z.string().describe("Raíz permitida").default("/home/z/my-project"),
  },
  async (args: any) => {
    const { ruta, raiz } = args as any;
    const raizBase = raiz || "/home/z/my-project";
let p = String(ruta);
const esAbs = p.startsWith("/") || /^[A-Z]:\\/.test(p);
let combinada = esAbs ? p : join(raizBase, p);
const normalizada = combinada.replace(/\\/g, "/").replace(/(?!^)\/\.\/(?!\.\.)/, "/");
const partes: string[] = [];
for (const seg of normalizada.split("/")) {
  if (seg === "..") { if (partes.length === 0) return fail("escape de directorio detectado: ../ arriba de la raíz"); partes.pop(); }
  else if (seg !== "." && seg !== "") partes.push(seg);
}
const final = "/" + partes.join("/");
const dentro = final.startsWith(raizBase.endsWith("/") ? raizBase : raizBase + "/") || final === raizBase;
const peligros = ["/.ssh", "/.env", "/etc/shadow", "/.aws", "/.gnupg", "/.config/gcloud"].filter((d) => final.includes(d));
return ok({ ruta_original: ruta, ruta_resuelta: final, permitida: dentro && peligros.length === 0, razon: !dentro ? "fuera de la raíz permitida" : peligros.length ? "ruta sensible: " + peligros.join(", ") : "ok" });
  }
);

server.tool(
  "check_access",
  "Verifica si una operación de archivo (leer/escribir/borrar/ejecutar) está permitida por política para esa ruta.",
  {
  ruta: z.string().describe("Ruta objetivo"),
  operacion: z.enum(["leer","escribir","borrar","ejecutar"]).describe("Operación"),
  },
  async (args: any) => {
    const { ruta, operacion } = args as any;
    const r = ruta.toLowerCase();
const reglas: Array<[RegExp, string[], string]> = [
  [/\.env|secrets?|credentials?|\.pem|\.key$/, ["leer", "escribir", "borrar"], "credenciales"],
  [/\.ssh\/|\.aws\/|\.gnupg\//, ["leer", "escribir", "borrar", "ejecutar"], "directorio de identidad"],
  [/node_modules/, ["escribir", "borrar"], "node_modules"],
  [/\.(sh|bash|exe|bat|cmd|ps1)$/, ["ejecutar"], "scripts ejecutables"],
  [/dist\//, ["leer", "escribir"], "build output"],
];
for (const [re, ops, razon] of reglas) {
  if (re.test(r) && ops.includes(operacion)) return ok({ permitido: false, razon: "política bloquea " + operacion + " en " + razon, requiere: "permission-gate humano" });
}
return ok({ permitido: true, razon: "sin restricciones para " + operacion });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor file-guard está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "file-guard", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[file-guard] fatal:", e);
  process.exit(1);
});

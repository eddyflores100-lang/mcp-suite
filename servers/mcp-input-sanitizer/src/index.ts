#!/usr/bin/env node
/**
 * MCP Server: Input Sanitizer
 * Sanea entradas antes de que lleguen a tools: control chars, null bytes, tamaño y forma
 *
 * Dolor que resuelve: Las tools reciben inputs hostiles (null bytes, Unicode invisible, payloads gigantes) que rompen downstream.
 * Categoría: Seguridad | Generado por mcp-suite | id: input-sanitizer
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

const server = new McpServer({ name: "input-sanitizer", version: "1.0.0" });

server.tool(
  "sanitize",
  "Sanea un string: elimina null bytes y controles, Unicode invisible (Bidi/zero-width), recorta a máximo y normaliza saltos.",
  {
  texto: z.string().describe("Entrada a sanear"),
  max_caracteres: z.number().describe("Límite de tamaño").default(100000),
  },
  async (args: any) => {
    const { texto, max_caracteres } = args as any;
    let t = String(texto);
const original = t;
const problemas: string[] = [];
if (/[\u0000]/.test(t)) { problemas.push("null bytes eliminados"); t = t.replace(/\u0000/g, ""); }
if (/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/.test(t)) { problemas.push("unicode invisible/bidi eliminado (ataque homoglifo)"); t = t.replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, ""); }
if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(t)) { problemas.push("caracteres de control eliminados"); t = t.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ""); }
t = t.replace(/\r\n?/g, "\n");
const max = max_caracteres ?? 100000;
if (t.length > max) { problemas.push("recortado de " + t.length + " a " + max + " caracteres"); t = t.slice(0, max); }
return ok({ limpio: problemas.length === 0, problemas, longitud_original: original.length, longitud_final: t.length, texto_saneado: t.slice(0, 3000) });
  }
);

server.tool(
  "validate_shape",
  "Valida la forma de un objeto de entrada: campos permitidos, prohibidos detectados, tipos básicos y profundidad máxima.",
  {
  data: z.any().describe("Objeto de entrada"),
  campos_permitidos: z.array(z.any()).describe("Lista blanca de campos de primer nivel").optional(),
  },
  async (args: any) => {
    const { data, campos_permitidos } = args as any;
    function profundidad(o: any): number {
  if (o === null || typeof o !== "object") return 0;
  return 1 + Math.max(0, ...__vals(o).map((v) => profundidad(v)));
}
const d = data;
const prof = profundidad(d);
const problemas: string[] = [];
if (prof > 10) problemas.push("profundidad " + prof + " > 10: posible payload anidado hostil");
const keys = d && typeof d === "object" ? Object.keys(d) : [];
const proto_pollution = keys.filter((k) => k === "__proto__" || k === "constructor" || k === "prototype");
if (proto_pollution.length) problemas.push("prototype pollution detectado: " + proto_pollution.join(", "));
if (Array.isArray(campos_permitidos) && campos_permitidos.length) {
  const no_permitidos = keys.filter((k) => !campos_permitidos.includes(k));
  if (no_permitidos.length) problemas.push("campos fuera de whitelist: " + no_permitidos.join(", "));
}
if (JSON.stringify(d).length > 200000) problemas.push("payload > 200KB");
return ok({ valido: problemas.length === 0, problemas, campos: keys, profundidad: prof });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor input-sanitizer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "input-sanitizer", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[input-sanitizer] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Schema Validator
 * Valida cualquier JSON contra un JSON Schema (subconjunto potente): tipos, requeridos, anidados
 *
 * Dolor que resuelve: La salida estructurada de un LLM se acepta sin validar: los campos faltantes explotan río abajo.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: schema-validator
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

const server = new McpServer({ name: "schema-validator", version: "1.0.0" });

server.tool(
  "validate",
  "Valida un JSON contra un schema {tipo, requeridos:[], propiedades:{campo:tipo}, items, min/max}. Devuelve errores con ruta exacta.",
  {
  data: z.any().describe("JSON a validar"),
  schema: z.any().describe("Schema de validación"),
  },
  async (args: any) => {
    const { data, schema } = args as any;
    function tipoDe(v: any): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
function validar(dato: any, sch: any, ruta: string, errores: string[]) {
  const s = sch || {};
  if (s.tipo || s.type) {
    const esperado = s.tipo || s.type;
    const real = tipoDe(dato);
    if (esperado === "integer" && !(typeof dato === "number" && Number.isInteger(dato))) errores.push(ruta + ": esperaba integer, hay " + real);
    else if (esperado !== "integer" && real !== esperado) { errores.push(ruta + ": esperaba " + esperado + ", hay " + real); return; }
  }
  if (s.requeridos || s.required) {
    const req: string[] = s.requeridos || s.required;
    for (const r of req) if (dato?.[r] === undefined) errores.push(ruta + "." + r + ": requerido y ausente");
  }
  if (s.propiedades || s.properties) {
    const props: any = s.propiedades || s.properties;
    for (const [k, sub] of __ents(props)) {
      if (dato?.[k] !== undefined) validar(dato[k], sub, ruta + "." + k, errores);
    }
  }
  if (s.items && Array.isArray(dato)) dato.forEach((item: any, i: number) => validar(item, s.items, ruta + "[" + i + "]", errores));
  if (s.enum && !s.enum.includes(dato)) errores.push(ruta + ": valor " + JSON.stringify(dato) + " fuera de enum " + JSON.stringify(s.enum));
  if (s.min !== undefined && typeof dato === "number" && dato < s.min) errores.push(ruta + ": " + dato + " < min " + s.min);
  if (s.max !== undefined && typeof dato === "number" && dato > s.max) errores.push(ruta + ": " + dato + " > max " + s.max);
  if (s.min_longitud && typeof dato === "string" && dato.length < s.min_longitud) errores.push(ruta + ": longitud < " + s.min_longitud);
}
const errores: string[] = [];
validar(data, schema, "$", errores);
return ok({ valido: errores.length === 0, errores });
  }
);

server.tool(
  "common_schemas",
  "Devuelve schemas listos para usar: producto, usuario, artículo, respuesta-tool-MCP, evento.",
  {
  cual: z.enum(["producto","usuario","articulo","respuesta-mcp","evento"]).describe("Schema a obtener"),
  },
  async (args: any) => {
    const { cual } = args as any;
    const schemas: any = {
  producto: { tipo: "object", requeridos: ["nombre", "precio"], propiedades: { nombre: { tipo: "string", min_longitud: 1 }, precio: { tipo: "number", min: 0 }, moneda: { tipo: "string" }, stock: { tipo: "integer", min: 0 } } },
  usuario: { tipo: "object", requeridos: ["nombre", "email"], propiedades: { nombre: { tipo: "string" }, email: { tipo: "string" }, rol: { tipo: "string", enum: ["admin", "user", "agente"] } } },
  articulo: { tipo: "object", requeridos: ["titulo", "cuerpo"], propiedades: { titulo: { tipo: "string" }, cuerpo: { tipo: "string", min_longitud: 50 }, fecha: { tipo: "string" }, tags: { tipo: "array", items: { tipo: "string" } } } },
  "respuesta-mcp": { tipo: "object", requeridos: ["content"], propiedades: { content: { tipo: "array", items: { tipo: "object", requeridos: ["type"], propiedades: { type: { tipo: "string", enum: ["text", "image"] }, text: { tipo: "string" } } } }, isError: { tipo: "boolean" } } },
  evento: { tipo: "object", requeridos: ["tipo", "ts"], propiedades: { tipo: { tipo: "string" }, ts: { tipo: "string" }, payload: { tipo: "object" } } },
};
if (!schemas[cual]) return fail("schema desconocido");
return ok({ schema: schemas[cual] });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor schema-validator está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "schema-validator", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[schema-validator] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Unit Convert
 * Conversiones de unidades exactas: longitud, masa, volumen, temperatura, datos
 *
 * Dolor que resuelve: '~2 libras' del LLM no sirve para recetas ni ingeniería: conversiones exactas con factores estándar.
 * Categoría: Utilidades | Generado por mcp-suite | id: unit-convert
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

const server = new McpServer({ name: "unit-convert", version: "1.0.0" });

server.tool(
  "convert",
  "Convierte entre unidades de 7 familias: longitud, masa, volumen, temperatura, área, velocidad y datos (SI e imperiales).",
  {
  valor: z.number().describe("Valor"),
  de: z.string().describe("Unidad origen"),
  a: z.string().describe("Unidad destino"),
  },
  async (args: any) => {
    const { valor, de, a } = args as any;
    const factores: any = {
  longitud: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nmi: 1852 },
  masa: { kg: 1, g: 0.001, mg: 0.000001, t: 1000, lb: 0.45359237, oz: 0.0283495, st: 6.35029 },
  volumen: { l: 1, ml: 0.001, m3: 1000, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588, floz: 0.0295735 },
  area: { "m2": 1, "km2": 1e6, "cm2": 0.0001, ha: 10000, acre: 4046.86, "ft2": 0.092903, "mi2": 2589988 },
  velocidad: { "m/s": 1, "km/h": 0.277778, mph: 0.44704, kn: 0.514444, "ft/s": 0.3048 },
  datos: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1.0995116e12, KiB: 1024, MiB: 1048576, GiB: 1073741824 },
  tiempo: { s: 1, min: 60, h: 3600, d: 86400, sem: 604800, ms: 0.001 },
};
const temp: any = { c: "celsius", f: "fahrenheit", k: "kelvin", celsius: "celsius", fahrenheit: "fahrenheit", kelvin: "kelvin" };
const norm = (u: string) => u.toLowerCase().trim();
const deN = norm(de); const aN = norm(a);
if (temp[deN] && temp[aN]) {
  let celsius: number;
  if (temp[deN] === "celsius") celsius = valor;
  else if (temp[deN] === "fahrenheit") celsius = (valor - 32) * 5 / 9;
  else celsius = valor - 273.15;
  let out: number;
  if (temp[aN] === "celsius") out = celsius;
  else if (temp[aN] === "fahrenheit") out = celsius * 9 / 5 + 32;
  else out = celsius + 273.15;
  return ok({ valor, de, a, resultado: Math.round(out * 100) / 100, familia: "temperatura" });
}
for (const [familia, tabla] of __ents(factores)) {
  if (tabla[deN] !== undefined && tabla[aN] !== undefined) {
    const resultado = valor * tabla[deN] / tabla[aN];
    return ok({ valor, de, a, resultado: Math.round(resultado * 1e8) / 1e8, familia });
  }
}
return fail("unidades no soportadas o de familias distintas. Familias: " + Object.keys(factores).join(", ") + " + temperatura (c/f/k)");
  }
);

server.tool(
  "list_units",
  "Lista todas las unidades soportadas por familia.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const familias: any = {
  longitud: ["m", "km", "cm", "mm", "mi", "yd", "ft", "in", "nmi"],
  masa: ["kg", "g", "mg", "t", "lb", "oz", "st"],
  volumen: ["l", "ml", "m3", "gal", "qt", "pt", "cup", "floz"],
  area: ["m2", "km2", "cm2", "ha", "acre", "ft2", "mi2"],
  velocidad: ["m/s", "km/h", "mph", "kn", "ft/s"],
  datos: ["B", "KB", "MB", "GB", "TB", "KiB", "MiB", "GiB"],
  tiempo: ["s", "min", "h", "d", "sem", "ms"],
  temperatura: ["c", "f", "k"],
};
return ok({ familias });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor unit-convert está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "unit-convert", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[unit-convert] fatal:", e);
  process.exit(1);
});

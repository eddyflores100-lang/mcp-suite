#!/usr/bin/env node
/**
 * MCP Server: Normalize Output
 * Normaliza formatos: fechas ISO, números, unidades y casing consistentes
 *
 * Dolor que resuelve: La salida llega con formatos mezclados: fechas en 3 formatos, números con comas y puntos, unidades inconsistentes.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: normalize-output
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

const server = new McpServer({ name: "normalize-output", version: "1.0.0" });

server.tool(
  "normalize_dates",
  "Detecta fechas en un texto y las normaliza a ISO 8601 (YYYY-MM-DD), reportando cada conversión.",
  {
  texto: z.string().describe("Texto con fechas"),
  },
  async (args: any) => {
    const { texto } = args as any;
    const MES: any = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const hallazgos: any[] = [];
let resultado = texto;
const patrones: Array<[RegExp, (m: string[]) => string]> = [
  [/\b(\d{1,2})[\/](\d{1,2})[\/](\d{4})\b/g, (m) => new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString().slice(0, 10)],
  [/\b(\d{1,2}) de ([a-záéíóúñ]+) de (\d{4})\b/gi, (m) => String(new Date(Date.UTC(+m[3], (MES[m[2].toLowerCase()] || 1) - 1, +m[1])).toISOString().slice(0, 10))],
  [/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => m[0]],
];
for (const [re, fn] of patrones) {
  resultado = resultado.replace(re, (...args: any[]) => {
    const iso = fn(args.slice(0, -2) as string[]);
    hallazgos.push({ original: args[0], iso });
    return iso;
  });
}
return ok({ fechas_normalizadas: hallazgos.length, hallazgos, texto_resultado: resultado });
  }
);

server.tool(
  "normalize_numbers",
  "Normaliza números con separadores de miles/decimales mezclados (1.234,56 / 1,234.56) a formato consistente.",
  {
  numero: z.string().describe("Número a normalizar"),
  formato: z.enum(["punto-decimal","coma-decimal"]).describe("Formato destino").default("punto-decimal"),
  },
  async (args: any) => {
    const { numero, formato } = args as any;
    let s = String(numero).trim().replace(/\s/g, "");
const tiene_ambos = s.includes(".") && s.includes(",");
if (tiene_ambos) {
  if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
} else if (s.includes(",")) {
  const partes = s.split(",");
  s = partes.length === 2 && partes[1].length !== 3 ? s.replace(",", ".") : s.replace(/,/g, "");
}
const valor = Number(s);
if (Number.isNaN(valor)) return fail("no parseable: " + numero);
const destino = formato || "punto-decimal";
const formateado = destino === "punto-decimal" ? valor.toLocaleString("en-US") : valor.toLocaleString("de-DE");
return ok({ original: numero, valor, formateado, formato: destino });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor normalize-output está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "normalize-output", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[normalize-output] fatal:", e);
  process.exit(1);
});

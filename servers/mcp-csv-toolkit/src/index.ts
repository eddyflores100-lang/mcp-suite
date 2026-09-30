#!/usr/bin/env node
/**
 * MCP Server: CSV Toolkit
 * Parse, filtra y resume CSVs sin Excel: separador auto-detectado
 *
 * Dolor que resuelve: Los datasets llegan en CSV con separadores mixtos y comillas rotas: el agente necesita parseo robusto local.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: csv-toolkit
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

const server = new McpServer({ name: "csv-toolkit", version: "1.0.0" });

server.tool(
  "parse",
  "Parsea CSV con detección automática de separador (, ; tab |), comillas correctas y filas de encabezado.",
  {
  csv: z.string().describe("Contenido CSV"),
  tiene_headers: z.boolean().describe("Primera fila son headers").default(true),
  },
  async (args: any) => {
    const { csv, tiene_headers } = args as any;
    const texto = String(csv).trim();
const muestra = texto.split("\n").slice(0, 5).join("\n");
const seps = [",", ";", "\t", "|"];
const conteos = seps.map((s) => muestra.split(s).length - 1);
const sep = seps[conteos.indexOf(Math.max(...conteos))];
function parsearLinea(linea: string): string[] {
  const out: string[] = []; let actual = ""; let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') { if (enComillas && linea[i + 1] === '"') { actual += '"'; i++; } else enComillas = !enComillas; }
    else if (ch === sep && !enComillas) { out.push(actual); actual = ""; }
    else actual += ch;
  }
  out.push(actual);
  return out.map((c) => c.trim());
}
const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length);
const filas = lineas.map(parsearLinea);
const headers = tiene_headers !== false ? filas[0] : filas[0].map((_, i) => "col_" + (i + 1));
return ok({ separador: sep === "\t" ? "TAB" : sep, columnas: headers.length, filas: filas.length - (tiene_headers !== false ? 1 : 0), headers, muestra: filas.slice(1, 6) });
  }
);

server.tool(
  "filter_rows",
  "Filtra filas de un CSV ya parseado {headers, rows} por condición simple (columna operador valor).",
  {
  tabla: z.any().describe("{headers, rows}"),
  columna: z.string().describe("Columna a filtrar"),
  operador: z.enum(["=",">","<","contiene","no_contiene"]).describe("Operador"),
  valor: z.string().describe("Valor de comparación"),
  },
  async (args: any) => {
    const { tabla, columna, operador, valor } = args as any;
    const t = tabla || {};
const idx = (t.headers || []).indexOf(columna);
if (idx === -1) return fail("columna no existe: " + (t.headers || []).join(", "));
const valNum = Number(valor);
const filtradas = (t.rows || []).filter((fila: any[]) => {
  const celda = String(fila[idx] ?? "");
  const cNum = Number(celda);
  switch (operador) {
    case "=": return celda === valor;
    case ">": return Number.isFinite(cNum) && Number.isFinite(valNum) && cNum > valNum;
    case "<": return Number.isFinite(cNum) && Number.isFinite(valNum) && cNum < valNum;
    case "contiene": return celda.toLowerCase().includes(valor.toLowerCase());
    case "no_contiene": return !celda.toLowerCase().includes(valor.toLowerCase());
    default: return false;
  }
});
return ok({ coincidencias: filtradas.length, total: (t.rows || []).length, filas: filtradas.slice(0, 100) });
  }
);

server.tool(
  "summarize_columns",
  "Resume columnas numéricas (min, max, media, suma) y categóricas (valores únicos top) de una tabla.",
  {
  tabla: z.any().describe("{headers, rows}"),
  },
  async (args: any) => {
    const { tabla } = args as any;
    const t = tabla || {};
const headers: string[] = t.headers || [];
const rows: any[][] = t.rows || [];
const resumen: any[] = [];
headers.forEach((h, i) => {
  const valores = rows.map((r) => String(r[i] ?? "")).filter((v) => v !== "");
  const num = valores.map(Number).filter((n) => Number.isFinite(n));
  if (num.length >= valores.length * 0.8 && num.length > 0) {
    resumen.push({ columna: h, tipo: "numerica", min: Math.min(...num), max: Math.max(...num), media: Math.round((num.reduce((a, b) => a + b, 0) / num.length) * 100) / 100, suma: Math.round(num.reduce((a, b) => a + b, 0) * 100) / 100, n: num.length });
  } else {
    const unicos: any = {};
    for (const v of valores) unicos[v] = (unicos[v] || 0) + 1;
    const top = __ents(unicos).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
    resumen.push({ columna: h, tipo: "categorica", valores_unicos: Object.keys(unicos).length, top: top.map(([v, n]) => v + " (" + n + ")") });
  }
});
return ok({ filas: rows.length, resumen });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor csv-toolkit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "csv-toolkit", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[csv-toolkit] fatal:", e);
  process.exit(1);
});

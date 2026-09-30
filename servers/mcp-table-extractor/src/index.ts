#!/usr/bin/env node
/**
 * MCP Server: Table Extractor
 * Tablas HTML → JSON/CSV/Markdown estructurado
 *
 * Dolor que resuelve: Las tablas HTML llegan como sopa de tags: el agente necesita filas/columnas estructuradas.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: table-extractor
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

const server = new McpServer({ name: "table-extractor", version: "1.0.0" });

server.tool(
  "extract_tables",
  "Extrae TODAS las tablas de un HTML: cada una como {headers, rows}. Detecta th/td y colspan simple.",
  {
  html: z.string().describe("HTML con tablas"),
  },
  async (args: any) => {
    const { html } = args as any;
    const h = String(html);
const tablas: any[] = [];
const tablaRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
let tm;
while ((tm = tablaRe.exec(h)) !== null) {
  const filas: string[][] = [];
  const filaRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let fm;
  while ((fm = filaRe.exec(tm[1])) !== null) {
    const celdas: string[] = [];
    const celdaRe = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cm;
    while ((cm = celdaRe.exec(fm[1])) !== null) {
      const txt = cm[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
      celdas.push(txt);
    }
    if (celdas.length) filas.push(celdas);
  }
  if (filas.length) {
    const primera = filas[0];
    const parece_header = primera.every((c) => c.length > 0 && c.length < 40 && !/^\d+([.,]\d+)?$/.test(c));
    tablas.push({ headers: parece_header ? primera : primera.map((_, i) => "col_" + (i + 1)), rows: parece_header ? filas.slice(1) : filas, filas: filas.length });
  }
}
return ok({ total_tablas: tablas.length, tablas });
  }
);

server.tool(
  "to_csv",
  "Convierte una tabla {headers, rows} a CSV bien citado.",
  {
  tabla: z.any().describe("{headers, rows}"),
  },
  async (args: any) => {
    const { tabla } = args as any;
    const t = tabla || {};
const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const lineas = [ (t.headers || []).map(esc).join(",") ];
for (const fila of t.rows || []) lineas.push(fila.map(esc).join(","));
return ok({ csv: lineas.join("\n"), filas: (t.rows || []).length });
  }
);

server.tool(
  "to_markdown",
  "Convierte una tabla {headers, rows} a tabla Markdown.",
  {
  tabla: z.any().describe("{headers, rows}"),
  },
  async (args: any) => {
    const { tabla } = args as any;
    const t = tabla || {};
const headers: string[] = t.headers || [];
const rows: any[][] = t.rows || [];
const ancho = Math.max(headers.length, ...rows.map((r) => r.length), 1);
const norm = (r: any[]) => Array.from({ length: ancho }, (_, i) => String(r[i] ?? "").replace(/\|/g, "\\|"));
const md = ["| " + norm(headers).join(" | ") + " |", "| " + Array.from({ length: ancho }, () => "---").join(" | ") + " |", ...rows.map((r) => "| " + norm(r).join(" | ") + " |")].join("\n");
return ok({ markdown: md });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor table-extractor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "table-extractor", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[table-extractor] fatal:", e);
  process.exit(1);
});

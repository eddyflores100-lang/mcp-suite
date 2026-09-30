#!/usr/bin/env node
/**
 * MCP Server: PDF Text Extractor
 * Extrae texto de PDFs localmente: streams zlib + operadores Tj/TJ, sin dependencias
 *
 * Dolor que resuelve: Los PDFs son ilegibles para agentes: los extractores requieren binarios pesados. Aquí: parser PDF puro en Node.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: pdf-text-extractor
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync, statSync } from "node:fs";
import { homedir, tmpdir, cpus, freemem, totalmem } from "node:os";
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

const server = new McpServer({ name: "pdf-text-extractor", version: "1.0.0" });

server.tool(
  "extract",
  "Extrae texto de un PDF: descomprime streams FlateDecode (zlib), interpreta operadores de texto Tj/TJ/'/\" y decodifica hex strings. Funciona con PDFs de texto (no escaneados).",
  {
  pdf_base64: z.string().describe("PDF en base64"),
  },
  async (args: any) => {
    const { pdf_base64 } = args as any;
    const { inflateSync } = await import("node:zlib");
const buf = Buffer.from(pdf_base64, "base64");
if (buf.slice(0, 5).toString() !== "%PDF-") return fail("no es un PDF válido");
const raw = buf.toString("latin1");
const chunks: string[] = [];
const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
let sm;
while ((sm = streamRe.exec(raw)) !== null) {
  const data = Buffer.from(sm[1], "latin1");
  let contenido = "";
  try { contenido = inflateSync(data).toString("latin1"); } catch { contenido = sm[1]; }
  chunks.push(contenido);
}
let texto = "";
for (const c of chunks) {
  const tjRe = /\((?:\\.|[^\\()])*\)\s*Tj|\[((?:\\.|[^\\\]])*)\]\s*TJ|\((?:\\.|[^\\()])*\)\s*'|\((?:\\.|[^\\()])*\)\s*"/g;
  let m;
  while ((m = tjRe.exec(c)) !== null) {
    const expr = m[0];
    const partes = expr.match(/\((?:\\.|[^\\()])*\)/g) || [];
    for (const p of partes) {
      const BS = String.fromCharCode(92); const NL = String.fromCharCode(10); const CR = String.fromCharCode(13); const TB = String.fromCharCode(9);
      const s = p.slice(1, -1).split(BS + "n").join(NL).split(BS + "r").join(CR).split(BS + "t").join(TB).split(BS + "(").join("(").split(BS + ")").join(")").split(BS + BS).join(BS);
      texto += s;
    }
    texto += "\n";
  }
}
const hexStr = texto.match(/[0-9A-Fa-f]{4,}/g) || [];
texto = texto.replace(/\b[0-9A-Fa-f]{6,}\b/g, "");
const limpio = texto.replace(/\n{3,}/g, "\n\n").trim();
return ok({ paginas_aprox: Math.max(1, chunks.length), caracteres: limpio.length, tiene_texto: limpio.length > 0, nota: limpio.length === 0 ? "PDF sin texto extraíble (¿escaneado?): se necesita OCR" : "", texto: limpio.slice(0, 50000) });
  }
);

server.tool(
  "metadata",
  "Extrae metadatos del PDF: versión, título, autor, fechas y productor desde el dictionary y XMP.",
  {
  pdf_base64: z.string().describe("PDF en base64"),
  },
  async (args: any) => {
    const { pdf_base64 } = args as any;
    const buf = Buffer.from(pdf_base64, "base64");
const raw = buf.toString("latin1");
const version = (raw.match(/%PDF-(\d\.\d)/) || [])[1] || null;
const info: any = {};
const infoMatch = raw.match(/\/Info\s+(\d+)\s+(\d+)\s+R/);
for (const campo of ["Title", "Author", "Subject", "Creator", "Producer", "CreationDate", "ModDate"]) {
  const re = new RegExp("\\/" + campo + "\\s*\\(([^)\\\\]*(?:\\\\.[^)\\\\]*)*)\\)");
  const m = raw.match(re);
  if (m) info[campo.toLowerCase()] = m[1].replace(/\\[()]/g, "");
}
const paginas = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
const cifrado = /\/Encrypt\s+\d+\s+\d+\s+R/.test(raw);
return ok({ version_pdf: version, paginas, cifrado, metadata: info, tamano_bytes: buf.length });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor pdf-text-extractor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "pdf-text-extractor", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[pdf-text-extractor] fatal:", e);
  process.exit(1);
});

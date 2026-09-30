#!/usr/bin/env node
/**
 * MCP Server: XML Toolkit
 * Parse XML/RSS a JSON plano y busca tags con atributos
 *
 * Dolor que resuelve: RSS y sitemaps siguen siendo XML: sin parser, el agente pierde feeds enteros de información.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: xml-toolkit
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

const server = new McpServer({ name: "xml-toolkit", version: "1.0.0" });

server.tool(
  "to_json",
  "Convierte XML a JSON anidado: elementos con atributos (@attr), texto (#text) e hijos repetidos como arrays.",
  {
  xml: z.string().describe("XML a convertir"),
  },
  async (args: any) => {
    const { xml } = args as any;
    function decode(s: string) { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
function parseHasta(xml: string, cierreTag: string, posRef: { i: number }): any {
  const nodo: any = {};
  let texto = "";
  while (posRef.i < xml.length) {
    const lt = xml.indexOf("<", posRef.i);
    if (lt === -1) { texto += xml.slice(posRef.i); posRef.i = xml.length; break; }
    texto += xml.slice(posRef.i, lt);
    posRef.i = lt;
    if (xml.startsWith("</" + cierreTag, posRef.i)) { posRef.i = xml.indexOf(">", posRef.i) + 1; break; }
    const gt = xml.indexOf(">", posRef.i);
    if (gt === -1) { posRef.i = xml.length; break; }
    const tagStr = xml.slice(posRef.i, gt + 1);
    const m = tagStr.match(/^<([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>$/);
    if (!m) { posRef.i = gt + 1; continue; }
    const nombre = m[1];
    const selfClose = m[3] === "/";
    const attrs: any = {};
    for (const a of (m[2] || "").match(/[\w:.-]+="[^"]*"/g) || []) { const [k, v] = a.split("="); attrs["@" + k] = v.slice(1, -1); }
    posRef.i = gt + 1;
    const hijo: any = selfClose ? attrs : parseHasta(xml, nombre, posRef);
    if (!selfClose) for (const [k, v] of __ents(attrs)) hijo[k] = v;
    if (nodo[nombre] !== undefined) { if (!Array.isArray(nodo[nombre])) nodo[nombre] = [nodo[nombre]]; nodo[nombre].push(hijo); }
    else nodo[nombre] = hijo;
  }
  const t = texto.trim();
  if (t && Object.keys(nodo).length === 0) return { "#text": decode(t) };
  if (t) nodo["#text"] = decode(t);
  return nodo;
}
try {
  const limpio = String(xml).replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").trim();
  const posRef = { i: 0 };
  const raiz: any = {};
  while (posRef.i < limpio.length) {
    const lt = limpio.indexOf("<", posRef.i);
    if (lt === -1) break;
    const gt = limpio.indexOf(">", lt);
    if (gt === -1) break;
    const m = limpio.slice(lt, gt + 1).match(/^<([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>$/);
    posRef.i = gt + 1;
    if (!m) continue;
    const nombre = m[1];
    const selfClose = m[3] === "/";
    const attrs: any = {};
    for (const a of (m[2] || "").match(/[\w:.-]+="[^"]*"/g) || []) { const [k, v] = a.split("="); attrs["@" + k] = v.slice(1, -1); }
    const hijo: any = selfClose ? attrs : parseHasta(limpio, nombre, posRef);
    if (!selfClose) for (const [k, v] of __ents(attrs)) hijo[k] = v;
    if (raiz[nombre] !== undefined) { if (!Array.isArray(raiz[nombre])) raiz[nombre] = [raiz[nombre]]; raiz[nombre].push(hijo); }
    else raiz[nombre] = hijo;
  }
  return ok({ json: raiz, raiz: Object.keys(raiz)[0] || null });
} catch (e: any) { return fail("XML no parseable: " + e.message); }
  }
);

server.tool(
  "find_tags",
  "Encuentra todas las ocurrencias de un tag (ej: item, loc, entry) con sus atributos y texto interno.",
  {
  xml: z.string().describe("XML"),
  tag: z.string().describe("Tag a buscar (ej: item)"),
  },
  async (args: any) => {
    const { xml, tag } = args as any;
    const re = new RegExp("<" + tag + "((?:\\s+[^>]*?)?)>([\\s\\S]*?)<\/" + tag + ">|<" + tag + "([^>]*?)/>", "gi");
const encontrados: any[] = [];
let m;
while ((m = re.exec(String(xml))) !== null) {
  const attrs: any = {};
  const attrStr = m[1] || m[3] || "";
  const pares = attrStr.match(/[\w:.-]+="[^"]*"/g) || [];
  for (const p of pares) { const [k, v] = p.split("="); attrs[k] = v.slice(1, -1); }
  const inner = (m[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  encontrados.push({ attrs, texto: inner.slice(0, 300) });
}
return ok({ tag, total: encontrados.length, encontrados: encontrados.slice(0, 100) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor xml-toolkit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "xml-toolkit", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[xml-toolkit] fatal:", e);
  process.exit(1);
});

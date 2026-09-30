#!/usr/bin/env node
/**
 * MCP Server: YAML Toolkit
 * Parse y genera YAML (subconjunto práctico): configs y front-matter
 *
 * Dolor que resuelve: Las configs llegan en YAML (front-matter, CI, docker-compose) y sin parser el agente las toca a ciegas.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: yaml-toolkit
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

const server = new McpServer({ name: "yaml-toolkit", version: "1.0.0" });

server.tool(
  "parse",
  "Parsea YAML de subconjunto práctico: escalares, strings, listas (- item), maps anidados por indentación y flags. Suficiente para configs típicas.",
  {
  yaml: z.string().describe("YAML a parsear"),
  },
  async (args: any) => {
    const { yaml } = args as any;
    function parseValor(v: string): any {
  const s = v.trim();
  if (s === "" || s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  if (/^\[.*\]$/.test(s)) { try { return JSON.parse(s.replace(/'/g, '"')); } catch { return s.slice(1, -1).split(",").map((x) => parseValor(x)); } }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}
const lineas = String(yaml).split(/\r?\n/).filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
function parseBloque(idx: number, indent: number): [any, number] {
  const resultado: any = {}; let esLista = false; const lista: any[] = [];
  let i = idx;
  while (i < lineas.length) {
    const linea = lineas[i];
    const indentActual = linea.length - linea.trimStart().length;
    if (indentActual < indent) break;
    const trimmed = linea.trim();
    if (trimmed.startsWith("- ")) {
      esLista = true;
      const resto = trimmed.slice(2);
      if (resto.includes(": ")) {
        const item: any = {};
        const [k, ...restoV] = resto.split(": ");
        item[k.trim()] = parseValor(restoV.join(": "));
        lista.push(item);
      } else lista.push(parseValor(resto));
      i++;
    } else if (/^[\w.-]+:/.test(trimmed)) {
      const m = trimmed.match(/^([\w.-]+):\s*(.*)$/);
      if (!m) { i++; continue; }
      const clave = m[1]; const valorStr = m[2];
      if (valorStr === "") {
        const [sub, nuevoIdx] = parseBloque(i + 1, indentActual + 1);
        if (esLista) { lista.push({ [clave]: sub }); resultado[clave] = sub; }
        else resultado[clave] = sub;
        i = nuevoIdx;
      } else {
        if (esLista) lista.push({ [clave]: parseValor(valorStr) });
        resultado[clave] = parseValor(valorStr);
        i++;
      }
    } else { i++; }
  }
  return [esLista && Object.keys(resultado).length === 0 ? lista : (esLista ? lista : resultado), i];
}
try {
  const [data, final] = parseBloque(0, 0);
  return ok({ data, lineas_parseadas: final });
} catch (e: any) { return fail("YAML no parseable (subconjunto): " + e.message); }
  }
);

server.tool(
  "stringify",
  "Serializa un JSON a YAML (indentación 2, strings citadas solo si necesario).",
  {
  data: z.any().describe("JSON a serializar"),
  },
  async (args: any) => {
    const { data } = args as any;
    function esc(s: string): string {
  if (new RegExp("[:#\-\[\]{},&*?|>!%@" + '"' + String.fromCharCode(96) + "\n]").test(s) || s.trim() !== s || /^(true|false|null|~|-?\d)/.test(s)) return JSON.stringify(s);
  return s;
}
function serializar(o: any, indent: number): string {
  const pad = "  ".repeat(indent);
  if (o === null || o === undefined) return "null";
  if (typeof o === "boolean" || typeof o === "number") return String(o);
  if (typeof o === "string") return esc(o);
  if (Array.isArray(o)) { return o.length === 0 ? "[]" : "\n" + o.map((item) => pad + "- " + serializar(item, indent + 1).trimStart()).join("\n"); }
  const entries = __ents(o);
  if (!entries.length) return "{}";
  return "\n" + entries.map(([k, v]) => {
    const valor = serializar(v, indent + 1);
    return pad + esc(k) + ":" + (valor.startsWith("\n") ? valor : " " + valor);
  }).join("\n");
}
const out = serializar(data, 0).replace(/^\n/, "");
return ok({ yaml: out });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor yaml-toolkit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "yaml-toolkit", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[yaml-toolkit] fatal:", e);
  process.exit(1);
});

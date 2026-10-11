#!/usr/bin/env node
/**
 * MCP Server: Safe Math
 * Aritmética exacta del agente: evaluación, porcentajes y reglas de tres
 *
 * Dolor que resuelve: Los LLM cometen errores aritméticos notorios: cualquier cifra importante debe calcularse con tool, no 'de cabeza'.
 * Categoría: Utilidades | Generado por mcp-suite | id: safe-math
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

const server = new McpServer({ name: "safe-math", version: "1.0.0" });

server.tool(
  "evaluate",
  "Evalúa una expresión aritmética de forma segura con parser propio (sin eval): + - * / % ** y paréntesis.",
  {
  expresion: z.string().describe("Expresión (ej: (1250 - 320) * 0.15)"),
  },
  async (args: any) => {
    const { expresion } = args as any;
    const expr = String(expresion).replace(/\s+/g, "").replace(/,/g, ".").replace(/\^/g, "**");
if (!expr || expr.length > 1000) return fail("expresión vacía o demasiado larga");
const tokens = expr.match(/(?:\d+(?:\.\d*)?|\.\d+)|\*\*|[+\-*/%()]/g) || [];
if (tokens.join("") !== expr) return fail("caracteres no permitidos");
let pos = 0;
function atom(): number {
  const t = tokens[pos++];
  if (t === "(") { const value = sum(); if (tokens[pos++] !== ")") throw Error("paréntesis desbalanceados"); return value; }
  if (!t || !/^(?:\d|\.)/.test(t)) throw Error("expresión malformada");
  return Number(t);
}
function power(): number { const value = atom(); if (tokens[pos] === "**") { pos++; return value ** unary(); } return value; }
function unary(): number { if (tokens[pos] === "+") { pos++; return unary(); } if (tokens[pos] === "-") { pos++; return -unary(); } return power(); }
function product(): number {
  let value = unary();
  while (["*", "/", "%"].includes(tokens[pos])) { const op = tokens[pos++]; const next = unary(); if (op !== "*" && next === 0) throw Error("división por cero"); value = op === "*" ? value * next : op === "/" ? value / next : value % next; }
  return value;
}
function sum(): number { let value = product(); while (["+", "-"].includes(tokens[pos])) { const op = tokens[pos++]; const next = product(); value = op === "+" ? value + next : value - next; } return value; }
try { const resultado = sum(); if (pos !== tokens.length || !Number.isFinite(resultado)) return fail("expresión malformada o resultado no finito"); return ok({ expresion, resultado }); }
catch { return fail("expresión malformada, división por cero o límites excedidos"); }
  }
);

server.tool(
  "percent_change",
  "Calcula variación porcentual exacta entre dos valores (con dirección y magnitud).",
  {
  valor_inicial: z.number().describe("Valor inicial"),
  valor_final: z.number().describe("Valor final"),
  },
  async (args: any) => {
    const { valor_inicial, valor_final } = args as any;
    if (valor_inicial === 0) return fail("valor inicial 0: variación indefinida");
const cambio = (valor_final - valor_inicial) / Math.abs(valor_inicial) * 100;
return ok({ valor_inicial, valor_final, delta: valor_final - valor_inicial, cambio_porcentual: Math.round(cambio * 100) / 100 + "%", direccion: cambio > 0 ? "aumento" : cambio < 0 ? "disminución" : "sin cambio" });
  }
);

server.tool(
  "rule_of_three",
  "Regla de tres directa/inversa: dado A→B, ¿qué corresponde a C?",
  {
  a: z.number().describe("Valor A"),
  b: z.number().describe("Valor correspondiente a A"),
  c: z.number().describe("Nuevo valor de A"),
  inversa: z.boolean().describe("Proporcionalidad inversa").default(false),
  },
  async (args: any) => {
    const { a, b, c, inversa } = args as any;
    if (a === 0 || c === 0) return fail("valores no pueden ser 0");
const x = inversa ? (b * a) / c : (b * c) / a;
return ok({ planteo: a + " → " + b + " ; " + c + " → ?", resultado: Math.round(x * 1e6) / 1e6, tipo: inversa ? "inversa" : "directa" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor safe-math está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "safe-math", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[safe-math] fatal:", e);
  process.exit(1);
});

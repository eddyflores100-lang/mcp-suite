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
function ok(data) {
    return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg) {
    return { content: [{ type: "text", text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o) { return Object.values(o); }
function __ents(o) { return Object.entries(o); }
const server = new McpServer({ name: "safe-math", version: "1.0.0" });
server.tool("evaluate", "Evalúa una expresión aritmética de forma segura con parser propio (sin eval): + - * / % ** y paréntesis.", {
    expresion: z.string().describe("Expresión (ej: (1250 - 320) * 0.15)"),
}, async (args) => {
    const { expresion } = args;
    const expr = String(expresion).replace(/\s+/g, "").replace(/,/g, ".").replace(/\^/g, "**");
    if (!/^[\d+\-*/%().]+$/.test(expr.replace(/\*\*/g, "*")))
        return fail("caracteres no permitidos");
    const tokens = expr.match(/\d+\.?\d*|\*\*|[+\-*/%()]/g);
    if (!tokens)
        return fail("no parseable");
    const salida = [];
    const ops = [];
    const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "**": 3 };
    let prev = "";
    for (const tok of tokens) {
        if (/^\d/.test(tok)) {
            salida.push(parseFloat(tok));
        }
        else if (tok === "(")
            ops.push(tok);
        else if (tok === ")") {
            while (ops.length && ops[ops.length - 1] !== "(")
                salida.push(ops.pop());
            ops.pop();
        }
        else {
            if ((tok === "-" || tok === "+") && (prev === "" || prev === "(" || prec[prev]))
                salida.push(0);
            while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]] >= prec[tok])
                salida.push(ops.pop());
            ops.push(tok);
        }
        prev = tok;
    }
    while (ops.length) {
        const op = ops.pop();
        if (op !== "(")
            salida.push(op);
    }
    const pila = [];
    for (const t of salida) {
        if (typeof t === "number") {
            pila.push(t);
            continue;
        }
        const b = pila.pop();
        const a = pila.pop();
        if (a === undefined)
            return fail("expresión malformada");
        if (t === "+")
            pila.push(a + b);
        else if (t === "-")
            pila.push(a - b);
        else if (t === "*")
            pila.push(a * b);
        else if (t === "%")
            pila.push(a % b);
        else if (t === "**")
            pila.push(Math.pow(a, b));
        else if (t === "/") {
            if (b === 0)
                return fail("división por cero");
            pila.push(a / b);
        }
    }
    if (pila.length !== 1 || !Number.isFinite(pila[0]))
        return fail("expresión malformada");
    return ok({ expresion, resultado: Math.round(pila[0] * 1e10) / 1e10 });
});
server.tool("percent_change", "Calcula variación porcentual exacta entre dos valores (con dirección y magnitud).", {
    valor_inicial: z.number().describe("Valor inicial"),
    valor_final: z.number().describe("Valor final"),
}, async (args) => {
    const { valor_inicial, valor_final } = args;
    if (valor_inicial === 0)
        return fail("valor inicial 0: variación indefinida");
    const cambio = (valor_final - valor_inicial) / Math.abs(valor_inicial) * 100;
    return ok({ valor_inicial, valor_final, delta: valor_final - valor_inicial, cambio_porcentual: Math.round(cambio * 100) / 100 + "%", direccion: cambio > 0 ? "aumento" : cambio < 0 ? "disminución" : "sin cambio" });
});
server.tool("rule_of_three", "Regla de tres directa/inversa: dado A→B, ¿qué corresponde a C?", {
    a: z.number().describe("Valor A"),
    b: z.number().describe("Valor correspondiente a A"),
    c: z.number().describe("Nuevo valor de A"),
    inversa: z.boolean().describe("Proporcionalidad inversa").default(false),
}, async (args) => {
    const { a, b, c, inversa } = args;
    if (a === 0 || c === 0)
        return fail("valores no pueden ser 0");
    const x = inversa ? (b * a) / c : (b * c) / a;
    return ok({ planteo: a + " → " + b + " ; " + c + " → ?", resultado: Math.round(x * 1e6) / 1e6, tipo: inversa ? "inversa" : "directa" });
});
server.tool("health_check", "Verifica que el servidor safe-math está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "safe-math", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[safe-math] fatal:", e);
    process.exit(1);
});

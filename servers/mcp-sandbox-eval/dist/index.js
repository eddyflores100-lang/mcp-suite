#!/usr/bin/env node
/**
 * MCP Server: Sandbox Eval
 * Evaluación matemática/lógica segura: nunca eval() sobre input del usuario
 *
 * Dolor que resuelve: Para calcular algo el agente recurre a eval() con input no confiable: RCE garantizado. Hace falta un parser seguro.
 * Categoría: Seguridad | Generado por mcp-suite | id: sandbox-eval
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
const server = new McpServer({ name: "sandbox-eval", version: "1.0.0" });
server.tool("safe_math", "Evalúa una expresión aritmética de forma segura (parser shunting-yard, sin eval): + - * / % ** paréntesis y funciones matemáticas.", {
    expresion: z.string().describe("Expresión (ej: (2+3)*4^2 o round(3.7))"),
}, async (args) => {
    const { expresion } = args;
    const expr = String(expresion).toLowerCase().replace(/\^/g, "**").replace(/,/g, ".").replace(/\s+/g, "");
    if (!/^[\d+\-*/%(). ]+$|^[$\d+\-*/%().a-z]+$/.test(expr))
        return fail("caracteres no permitidos");
    const funcs = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, log: Math.log, min: Math.min, max: Math.max, pow: Math.pow, exp: Math.exp };
    const tokens = expr.match(/\d+\.?\d*|[a-z]+|[+\-*/%()]|\*\*/g);
    if (!tokens)
        return fail("no parseable");
    const salida = [];
    const operadores = [];
    const precedencia = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "**": 3 };
    let prev = "";
    for (const tok of tokens) {
        if (/^\d/.test(tok))
            salida.push(parseFloat(tok));
        else if (funcs[tok]) {
            operadores.push(tok);
        }
        else if (tok === "(")
            operadores.push(tok);
        else if (tok === ")") {
            while (operadores.length && operadores[operadores.length - 1] !== "(")
                salida.push(operadores.pop());
            operadores.pop();
            if (operadores.length && funcs[operadores[operadores.length - 1]])
                salida.push(operadores.pop());
        }
        else {
            if ((tok === "-" || tok === "+") && (prev === "" || prev === "(" || precedencia[prev])) {
                salida.push(0);
            }
            while (operadores.length && operadores[operadores.length - 1] !== "(" && precedencia[operadores[operadores.length - 1]] >= precedencia[tok])
                salida.push(operadores.pop());
            operadores.push(tok);
        }
        prev = tok;
    }
    while (operadores.length) {
        const op = operadores.pop();
        if (op !== "(")
            salida.push(op);
    }
    const pila = [];
    for (const t of salida) {
        if (typeof t === "number")
            pila.push(t);
        else if (funcs[t]) {
            const args = [pila.pop()];
            pila.push(funcs[t](...args));
        }
        else {
            const b = pila.pop();
            const a = pila.pop();
            if (a === undefined || b === undefined)
                return fail("expresión malformada");
            switch (t) {
                case "+":
                    pila.push(a + b);
                    break;
                case "-":
                    pila.push(a - b);
                    break;
                case "*":
                    pila.push(a * b);
                    break;
                case "/":
                    if (b === 0)
                        return fail("división por cero");
                    pila.push(a / b);
                    break;
                case "%":
                    pila.push(a % b);
                    break;
                case "**":
                    pila.push(Math.pow(a, b));
                    break;
                default: return fail("operador desconocido " + t);
            }
        }
    }
    if (pila.length !== 1 || !Number.isFinite(pila[0]))
        return fail("expresión malformada");
    return ok({ expresion: expresion, resultado: Math.round(pila[0] * 1e10) / 1e10 });
});
server.tool("compare_expressions", "Compara dos expresiones matemáticas: ¿son iguales? (útil para verificar cálculos del LLM).", {
    a: z.string().describe("Expresión A"),
    b: z.string().describe("Expresión B"),
}, async (args) => {
    const { a, b } = args;
    const evalSeguro = (src) => {
        try {
            const expr = src.toLowerCase().replace(/\s+/g, "");
            if (!/^[\d+\-*/%().]+$/.test(expr))
                return null;
            const tokens = expr.match(/\d+\.?\d*|[+\-*/%()]/g) || [];
            const pos = [];
            const ops = [];
            const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
            for (const tok of tokens) {
                if (/^\d/.test(tok))
                    pos.push(parseFloat(tok));
                else if (tok === "(")
                    ops.push(tok);
                else if (tok === ")") {
                    while (ops.length && ops[ops.length - 1] !== "(")
                        pos.push(ops.pop());
                    ops.pop();
                }
                else {
                    while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]] >= prec[tok])
                        pos.push(ops.pop());
                    ops.push(tok);
                }
            }
            while (ops.length)
                pos.push(ops.pop());
            const pila = [];
            for (const t of pos) {
                if (typeof t === "number")
                    pila.push(t);
                else {
                    const y = pila.pop();
                    const x = pila.pop();
                    if (x === undefined)
                        return null;
                    pila.push(t === "+" ? x + y : t === "-" ? x - y : t === "*" ? x * y : t === "%" ? x % y : y === 0 ? NaN : x / y);
                }
            }
            return pila.length === 1 && Number.isFinite(pila[0]) ? pila[0] : null;
        }
        catch {
            return null;
        }
    };
    const ra = evalSeguro(a);
    const rb = evalSeguro(b);
    if (ra === null || rb === null)
        return fail("alguna expresión no es evaluable de forma segura");
    return ok({ valor_a: ra, valor_b: rb, equivalentes: Math.abs(ra - rb) < 1e-9 });
});
server.tool("health_check", "Verifica que el servidor sandbox-eval está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "sandbox-eval", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[sandbox-eval] fatal:", e);
    process.exit(1);
});

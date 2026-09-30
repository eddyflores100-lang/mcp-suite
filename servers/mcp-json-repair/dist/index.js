#!/usr/bin/env node
/**
 * MCP Server: JSON Repair
 * Repara JSON roto de LLMs: comillas, comas, truncados y fences
 *
 * Dolor que resuelve: El JSON que devuelve un LLM viene con markdown fences, comas colgantes y strings sin cerrar: cada parse falla.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: json-repair
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
const server = new McpServer({ name: "json-repair", version: "1.0.0" });
server.tool("repair", "Repara JSON roto: quita fences de código, elimina comas colgantes, cierra llaves/corchetes/quotes truncados (algoritmo de stack de brackets) y corrige comillas tipográficas.", {
    texto: z.string().describe("JSON (posiblemente roto) a reparar"),
}, async (args) => {
    const { texto } = args;
    function repararEstructura(src) {
        let out = "";
        const stack = [];
        let enStr = false, esc = false;
        const cerrar = (ch) => {
            out = out.replace(/[,\s]+$/, "");
            const esperado = ch === "}" ? "{" : "[";
            if (stack.length && stack[stack.length - 1] === esperado) {
                stack.pop();
                out += ch;
            }
            else {
                let cierre = "";
                while (stack.length && stack[stack.length - 1] !== esperado) {
                    const top = stack.pop();
                    cierre += top === "{" ? "}" : "]";
                }
                if (stack.length)
                    stack.pop();
                out += cierre + ch;
            }
        };
        for (const ch of src) {
            if (enStr) {
                out += ch;
                if (esc)
                    esc = false;
                else if (ch === "\\")
                    esc = true;
                else if (ch === '"')
                    enStr = false;
                continue;
            }
            if (ch === '"') {
                enStr = true;
                out += ch;
                continue;
            }
            if (ch === "{" || ch === "[") {
                stack.push(ch);
                out += ch;
                continue;
            }
            if (ch === "}" || ch === "]") {
                cerrar(ch);
                continue;
            }
            out += ch;
        }
        let cola = "";
        while (stack.length) {
            const top = stack.pop();
            cola += top === "{" ? "}" : "]";
        }
        if (enStr)
            cola = '"' + cola;
        return out + cola;
    }
    let s = String(texto).trim();
    const bt3 = String.fromCharCode(96, 96, 96);
    s = s.replace(new RegExp("^" + bt3 + "(json)?\s*", "i"), "").replace(new RegExp("\s*" + bt3 + "$"), "");
    s = s.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
    const intentos = [];
    try {
        return ok({ reparado: false, json: JSON.parse(s), metodo: "directo" });
    }
    catch (e) {
        intentos.push("directo: " + e.message);
    }
    try {
        return ok({ reparado: true, json: JSON.parse(repararEstructura(s)), metodo: "stack-de-brackets" });
    }
    catch (e) {
        intentos.push("stack: " + e.message);
    }
    const t = s.replace(/,\s*([}\]])/g, "$1").replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
    try {
        return ok({ reparado: true, json: JSON.parse(t), metodo: "comas+comillas" });
    }
    catch (e) {
        intentos.push("comas: " + e.message);
    }
    try {
        return ok({ reparado: true, json: JSON.parse(repararEstructura(t)), metodo: "stack+comas" });
    }
    catch (e) {
        intentos.push("stack2: " + e.message);
    }
    return fail("no reparable. Intentos: " + intentos.join(" | "));
});
server.tool("extract_json", "Extrae el primer JSON válido de un texto ruidoso (dentro de fences, prosa o logs).", {
    texto: z.string().describe("Texto que contiene JSON en alguna parte"),
}, async (args) => {
    const { texto } = args;
    const s = String(texto);
    const candidatos = [];
    const bt3 = String.fromCharCode(96, 96, 96);
    const fence = s.match(new RegExp(bt3 + "(?:json)?\\s*([\\s\\S]*?)" + bt3));
    if (fence)
        candidatos.push(fence[1]);
    for (let i = 0; i < s.length; i++) {
        if (s[i] === "{" || s[i] === "[") {
            let prof = 0;
            let enStr = false;
            let escp = false;
            for (let j = i; j < s.length; j++) {
                const ch = s[j];
                if (escp) {
                    escp = false;
                    continue;
                }
                if (ch === "\\") {
                    escp = true;
                    continue;
                }
                if (ch === '"')
                    enStr = !enStr;
                if (enStr)
                    continue;
                if (ch === "{" || ch === "[")
                    prof++;
                if (ch === "}" || ch === "]") {
                    prof--;
                    if (prof === 0) {
                        candidatos.push(s.slice(i, j + 1));
                        i = j;
                        break;
                    }
                }
            }
        }
    }
    for (const c of candidatos) {
        try {
            return ok({ json: JSON.parse(c), fuente: c.slice(0, 80) });
        }
        catch { }
    }
    return fail("sin JSON válido en el texto");
});
server.tool("health_check", "Verifica que el servidor json-repair está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "json-repair", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[json-repair] fatal:", e);
    process.exit(1);
});

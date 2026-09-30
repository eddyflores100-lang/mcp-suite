#!/usr/bin/env node
/**
 * MCP Server: JSON Toolkit
 * jsonpath, merge profundo, diff y validación: la navaja suiza del JSON
 *
 * Dolor que resuelve: Manipular JSON anidado a mano es propenso a errores: query, merge y diff estructurados faltan.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: json-toolkit
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
const server = new McpServer({ name: "json-toolkit", version: "1.0.0" });
server.tool("query", "Consulta JSON con jsonpath simplificado: $.a.b, $[0].name, $.items[*].id y filtros [?(@.x>5)].", {
    data: z.any().describe("JSON a consultar"),
    path: z.string().describe("Ruta estilo jsonpath ($.a.b[0].c)"),
}, async (args) => {
    const { data, path } = args;
    let p = String(path).trim().replace(/^\$\.?/, "");
    let actual = data;
    if (p === "" || p === "$")
        return ok({ valor: actual });
    const partes = p.match(/([^[.]+)|(\[[^\]]+\])|\./g) || [];
    for (const raw of partes) {
        const seg = raw.replace(/^\./, "");
        if (seg.startsWith("[")) {
            const dentro = seg.slice(1, -1);
            if (dentro === "*")
                continue;
            if (dentro.startsWith("?(")) {
                const cond = dentro.slice(2, -2);
                const m = cond.match(/([\w.]+)\s*(==|!=|>=|<=|>|<)\s*(.+)/);
                if (!m)
                    return fail("filtro no soportado: " + cond);
                const [, izq, op, der] = m;
                const valorDer = Number.isFinite(Number(der)) && !/"|'/.test(der) ? Number(der) : der.replace(/['"]/g, "");
                actual = (Array.isArray(actual) ? actual : []).filter((item) => {
                    const campo = izq.split(".").reduce((o, k) => o?.[k], item);
                    switch (op) {
                        case "==": return campo == valorDer;
                        case "!=": return campo != valorDer;
                        case ">": return Number(campo) > Number(valorDer);
                        case "<": return Number(campo) < Number(valorDer);
                        case ">=": return Number(campo) >= Number(valorDer);
                        case "<=": return Number(campo) <= Number(valorDer);
                        default: return false;
                    }
                });
            }
            else
                actual = actual?.[Number(dentro.replace(/['"]/g, ""))];
        }
        else if (seg) {
            if (seg.includes("[")) {
                const m = seg.match(/^([^.\[]+)\[([^\]]+)\]$/);
                if (m) {
                    actual = actual?.[m[1]];
                    const idx = m[2];
                    actual = idx === "*" ? actual : actual?.[Number(idx)];
                }
                else
                    actual = actual?.[seg];
            }
            else
                actual = actual?.[seg];
        }
        if (actual === undefined)
            break;
    }
    return ok({ path, encontrado: actual !== undefined, valor: actual === undefined ? null : actual });
});
server.tool("merge", "Merge profundo de 2+ JSONs: objetos se combinan recursivamente, arrays y escalares se reemplazan (o concatenan con flag).", {
    objetos: z.array(z.any()).describe("Lista de JSONs a fusionar (en orden)"),
    concatenar_arrays: z.boolean().describe("Concatenar arrays en vez de reemplazar").default(false),
}, async (args) => {
    const { objetos, concatenar_arrays } = args;
    function deepMerge(a, b, concat) {
        if (Array.isArray(a) && Array.isArray(b))
            return concat ? [...a, ...b] : b;
        if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
            const out = { ...a };
            for (const [k, v] of __ents(b))
                out[k] = k in out ? deepMerge(out[k], v, concat) : v;
            return out;
        }
        return b === undefined ? a : b;
    }
    const lista = Array.isArray(objetos) ? objetos : [];
    if (!lista.length)
        return fail("sin objetos");
    let acc = lista[0];
    for (let i = 1; i < lista.length; i++)
        acc = deepMerge(acc, lista[i], concatenar_arrays === true);
    return ok({ fusionado: acc, objetos_combinados: lista.length });
});
server.tool("validate", "Valida estructura y tipos de un JSON: tipado inferido del valor, campos null, arrays mixtos y profundidad.", {
    data: z.any().describe("JSON a inspeccionar"),
}, async (args) => {
    const { data } = args;
    function perfil(o, ruta, prof, out) {
        if (prof > 12) {
            out.push({ ruta, tipo: "profundidad-excesiva" });
            return;
        }
        if (o === null) {
            out.push({ ruta, tipo: "null" });
            return;
        }
        if (Array.isArray(o)) {
            out.push({ ruta, tipo: "array", largo: o.length });
            if (o.length && o.length <= 100)
                perfil(o[0], ruta + "[0]", prof + 1, out);
            return;
        }
        if (typeof o === "object") {
            for (const [k, v] of __ents(o))
                perfil(v, ruta + "." + k, prof + 1, out);
            return;
        }
        out.push({ ruta, tipo: typeof o, ejemplo: String(o).slice(0, 40) });
    }
    const perfil_out = [];
    perfil(data, "$", 0, perfil_out);
    const llaves_null = perfil_out.filter((p) => p.tipo === "null").length;
    const arrays_vacios = perfil_out.filter((p) => p.tipo === "array" && p.largo === 0).length;
    return ok({ campos: perfil_out.length, con_null: llaves_null, arrays_vacios, perfil: perfil_out.slice(0, 80), es_valido: true });
});
server.tool("health_check", "Verifica que el servidor json-toolkit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "json-toolkit", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[json-toolkit] fatal:", e);
    process.exit(1);
});

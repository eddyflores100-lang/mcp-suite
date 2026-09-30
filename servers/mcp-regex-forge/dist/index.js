#!/usr/bin/env node
/**
 * MCP Server: Regex Forge
 * Construye, prueba y explica regex: patrones comunes + riesgo ReDoS
 *
 * Dolor que resuelve: El LLM escribe regex sin testear y a veces catastróficas (ReDoS): forja con validación previa.
 * Categoría: Utilidades | Generado por mcp-suite | id: regex-forge
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
const server = new McpServer({ name: "regex-forge", version: "1.0.0" });
server.tool("build", "Genera regex probadas para casos comunes: email, teléfono EC, slug, fecha ISO, hex color, URL, número, cédula.", {
    patron: z.enum(["email", "telefono_ec", "slug", "fecha_iso", "hex_color", "url", "numero_decimal", "cedula_ec", "dni_generico", "version_semver"]).describe("Tipo de patrón"),
}, async (args) => {
    const { patron } = args;
    const patrones = {
        email: { regex: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", flags: "", ejemplo_valido: "user@example.com", ejemplo_invalido: "user@@" },
        telefono_ec: { regex: "(\\+593)?\\s?\\d{2}\\d{7,8}", flags: "", ejemplo_valido: "0991234567", ejemplo_invalido: "12345" },
        slug: { regex: "^[a-z0-9]+(-[a-z0-9]+)*$", flags: "", ejemplo_valido: "mi-slug-2", ejemplo_invalido: "Mi Slug" },
        fecha_iso: { regex: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$", flags: "", ejemplo_valido: "2026-09-10", ejemplo_invalido: "2026-13-45" },
        hex_color: { regex: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", flags: "", ejemplo_valido: "#ff00aa", ejemplo_invalido: "#ff00a" },
        url: { regex: "^https?:\\/\\/[\\w.-]+\\.[a-z]{2,}(\\/\\S*)?$", flags: "i", ejemplo_valido: "https://marketnow.site/api", ejemplo_invalido: "ftp://x" },
        numero_decimal: { regex: "^-?\\d{1,3}(\\.\\d+)?([.,]\\d{3})*(,\\d+)?$", flags: "", ejemplo_valido: "1.234,56", ejemplo_invalido: "1.2.3" },
        cedula_ec: { regex: "^\\d{10}$", flags: "", ejemplo_valido: "1712345678", ejemplo_invalido: "12345" },
        dni_generico: { regex: "^[A-Z0-9]{6,12}$", flags: "", ejemplo_valido: "X1234567L", ejemplo_invalido: "abc" },
        version_semver: { regex: "^\\d+\\.\\d+\\.\\d+(-[\\w.]+)?(\\+[\\w.]+)?$", flags: "", ejemplo_valido: "1.30.0-beta.1", ejemplo_invalido: "1.30" },
    };
    const p = patrones[patron];
    if (!p)
        return fail("patrón no existe");
    return ok({ tipo: patron, regex: "/" + p.regex + "/" + p.flags, raw: p.regex, flags: p.flags, ejemplos: { valido: p.ejemplo_valido, invalido: p.ejemplo_invalido } });
});
server.tool("test", "Prueba una regex contra un texto: coincidencias, grupos y posiciones.", {
    regex: z.string().describe("La regex (sin delimitadores)"),
    flags: z.string().describe("Flags (g, i, m...)").default("g"),
    texto: z.string().describe("Texto de prueba"),
}, async (args) => {
    const { regex, flags, texto } = args;
    let re;
    try {
        re = new RegExp(regex, flags || "g");
    }
    catch (e) {
        return fail("regex inválida: " + e.message);
    }
    const matches = [...String(texto).matchAll(new RegExp(regex, (flags || "g") + (flags?.includes("g") ? "" : "g")))];
    if (!matches.length)
        return ok({ coincidencias: 0, mensaje: "sin matches" });
    return ok({ coincidencias: matches.length, matches: matches.slice(0, 20).map((m) => ({ texto: m[0], posicion: m.index, grupos: m.slice(1) })) });
});
server.tool("redos_check", "Heurística de riesgo ReDoS: detecta cuantificadores anidados y alternancias superpuestas catastróficas.", {
    regex: z.string().describe("Regex a auditar"),
}, async (args) => {
    const { regex } = args;
    let re;
    try {
        re = new RegExp(regex);
    }
    catch (e) {
        return fail("regex inválida: " + e.message);
    }
    const riesgos = [];
    if (/(\+|\*|{\d+,})[^+]*?(\+|\*|{\d+,})/.test(regex.replace(/\[[^\]]*\]/g, "[]")))
        riesgos.push("cuantificadores encadenados: posible backtracking exponencial");
    if (/\(([^)]*[+*])\)[+*]/.test(regex))
        riesgos.push("grupo cuantificado con cuantificador interno: clásico ReDoS");
    if (/\(.*\|.*\)/.test(regex))
        riesgos.push("alternancia anidada en grupo: revisa backtracking");
    const inicio = Date.now();
    const sjon = "a".repeat(30) + "x";
    try {
        re.test(sjon);
    }
    catch { }
    const ms = Date.now() - inicio;
    return ok({ riesgos, tiempo_test_30chars_ms: ms, veredicto: riesgos.length === 0 && ms < 100 ? "segura" : "revisar: potencialmente costosa", recomendacion: riesgos.length ? "reescribe con posesivos/atomic o limita la entrada" : "ok" });
});
server.tool("health_check", "Verifica que el servidor regex-forge está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "regex-forge", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[regex-forge] fatal:", e);
    process.exit(1);
});

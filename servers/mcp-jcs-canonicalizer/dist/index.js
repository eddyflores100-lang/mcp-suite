#!/usr/bin/env node
/**
 * MCP Server: JCS Canonicalizer
 * JSON canónico RFC 8785 (JCS): misma firma para el mismo JSON, siempre
 *
 * Dolor que resuelve: Firmar JSON es frágil: espacios u orden de claves distintos rompen la firma. RFC 8785 lo resuelve con serialización canónica.
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: jcs-canonicalizer
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createHash } from "node:crypto";
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
const server = new McpServer({ name: "jcs-canonicalizer", version: "1.0.0" });
server.tool("canonicalize", "Convierte un objeto JSON arbitrario a su forma canónica RFC 8785 (JCS) — string determinista listo para firmar.", {
    data: z.any().describe("Objeto JSON a canonizar"),
}, async (args) => {
    const { data } = args;
    function canon(v) {
        if (v === null || v === undefined)
            return "null";
        if (typeof v === "boolean")
            return v ? "true" : "false";
        if (typeof v === "number") {
            if (!isFinite(v))
                throw new Error("RFC 8785: NaN/Infinity prohibidos");
            if (v === 0)
                return "0";
            if (Number.isInteger(v) && Math.abs(v) < 1e21)
                return String(v);
            return String(v);
        }
        if (typeof v === "string")
            return JSON.stringify(v);
        if (Array.isArray(v))
            return "[" + v.map((x) => canon(x === undefined ? null : x)).join(",") + "]";
        const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
        return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    }
    try {
        return ok({ canonical: canon(data) });
    }
    catch (e) {
        return fail(e.message);
    }
});
server.tool("fingerprint", "Hash SHA-256 de la forma canónica JCS: identificador determinista del contenido (útil para deduplicar y comparar credenciales).", {
    data: z.any().describe("Objeto JSON"),
}, async (args) => {
    const { data } = args;
    function canon(v) {
        if (v === null || v === undefined)
            return "null";
        if (typeof v === "boolean")
            return v ? "true" : "false";
        if (typeof v === "number") {
            if (!isFinite(v))
                throw new Error("NaN/Infinity");
            if (v === 0)
                return "0";
            return String(v);
        }
        if (typeof v === "string")
            return JSON.stringify(v);
        if (Array.isArray(v))
            return "[" + v.map((x) => canon(x === undefined ? null : x)).join(",") + "]";
        const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
        return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    }
    const c = canon(data);
    return ok({ jcs: c, sha256: createHash("sha256").update(c).digest("hex") });
});
server.tool("compare", "Compara dos JSON semánticamente: si sus formas canónicas JCS son idénticas, son equivalentes byte a byte para firmas.", {
    a: z.any().describe("Primer JSON"),
    b: z.any().describe("Segundo JSON"),
}, async (args) => {
    const { a, b } = args;
    function canon(v) {
        if (v === null || v === undefined)
            return "null";
        if (typeof v === "boolean")
            return v ? "true" : "false";
        if (typeof v === "number") {
            if (!isFinite(v))
                throw new Error("NaN/Infinity");
            if (v === 0)
                return "0";
            return String(v);
        }
        if (typeof v === "string")
            return JSON.stringify(v);
        if (Array.isArray(v))
            return "[" + v.map((x) => canon(x === undefined ? null : x)).join(",") + "]";
        const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
        return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    }
    const ca = canon(a), cb = canon(b);
    return ok({ semanticamente_iguales: ca === cb, canonical_a: ca, canonical_b: cb });
});
server.tool("health_check", "Verifica que el servidor jcs-canonicalizer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "jcs-canonicalizer", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[jcs-canonicalizer] fatal:", e);
    process.exit(1);
});

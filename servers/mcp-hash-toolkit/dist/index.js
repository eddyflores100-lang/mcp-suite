#!/usr/bin/env node
/**
 * MCP Server: Hash Toolkit
 * Hashing y encoding exacto: sha256, hmac, base64, hex y checksums
 *
 * Dolor que resuelve: Verificar integridad o firmar un payload exige hashing exacto: 'calcular' un sha256 de cabeza es imposible.
 * Categoría: Utilidades | Generado por mcp-suite | id: hash-toolkit
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createHash, createHmac } from "node:crypto";
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
const server = new McpServer({ name: "hash-toolkit", version: "1.0.0" });
server.tool("hash", "Calcula el hash de un texto en md5/sha1/sha256/sha512 (hex o base64).", {
    texto: z.string().describe("Texto a hashear"),
    algoritmo: z.enum(["md5", "sha1", "sha256", "sha512"]).describe("Algoritmo").default("sha256"),
    encoding: z.enum(["hex", "base64"]).describe("Salida").default("hex"),
}, async (args) => {
    const { texto, algoritmo, encoding } = args;
    const h = createHash(algoritmo || "sha256").update(String(texto), "utf8").digest(encoding === "base64" ? "base64" : "hex");
    return ok({ algoritmo, encoding: encoding || "hex", hash: h, longitud: h.length });
});
server.tool("hmac", "Calcula HMAC (sha256 por defecto) de un mensaje con un secreto — para firmar webhooks y payloads.", {
    mensaje: z.string().describe("Mensaje"),
    secreto: z.string().describe("Secreto compartido"),
    algoritmo: z.enum(["sha256", "sha1", "sha512"]).describe("Algoritmo").default("sha256"),
}, async (args) => {
    const { mensaje, secreto, algoritmo } = args;
    const mac = createHmac(algoritmo || "sha256", String(secreto)).update(String(mensaje), "utf8").digest("hex");
    return ok({ algoritmo: algoritmo || "sha256", hmac: mac, nota: "compara siempre en tiempo constante (timingSafeEqual) en producción" });
});
server.tool("encode_decode", "Codifica/decodifica base64, base64url y hex con detección automática de la operación.", {
    operacion: z.enum(["encode", "decode"]).describe("Operación"),
    formato: z.enum(["base64", "base64url", "hex"]).describe("Formato").default("base64"),
    dato: z.string().describe("Dato a transformar"),
}, async (args) => {
    const { operacion, formato, dato } = args;
    try {
        if (operacion === "encode") {
            if (formato === "hex")
                return ok({ resultado: Buffer.from(dato, "utf8").toString("hex") });
            if (formato === "base64url")
                return ok({ resultado: Buffer.from(dato, "utf8").toString("base64url") });
            return ok({ resultado: Buffer.from(dato, "utf8").toString("base64") });
        }
        if (formato === "hex")
            return ok({ resultado: Buffer.from(dato, "hex").toString("utf8") });
        if (formato === "base64url")
            return ok({ resultado: Buffer.from(dato, "base64url").toString("utf8") });
        return ok({ resultado: Buffer.from(dato, "base64").toString("utf8") });
    }
    catch (e) {
        return fail("dato inválido para el formato: " + e.message);
    }
});
server.tool("health_check", "Verifica que el servidor hash-toolkit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "hash-toolkit", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[hash-toolkit] fatal:", e);
    process.exit(1);
});

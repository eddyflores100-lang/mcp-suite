#!/usr/bin/env node
/**
 * MCP Server: PII Redactor
 * Enmascara datos personales (PII) antes de enviar texto a APIs externas
 *
 * Dolor que resuelve: El agente manda nombres, teléfonos, cédulas y tarjetas a APIs de terceros: fuga de PII por defecto.
 * Categoría: Seguridad | Generado por mcp-suite | id: pii-redactor
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
const server = new McpServer({ name: "pii-redactor", version: "1.0.0" });
server.tool("redact", "Detecta y enmascara PII: emails, teléfonos, cédulas/DNI/RUC ecuatorianos, SSN, tarjetas, IBAN, direcciones IP. Devuelve texto limpio + resumen.", {
    texto: z.string().describe("Texto con posible PII"),
    modo: z.enum(["mask", "hash", "remover"]).describe("Modo de redacción").default("mask"),
}, async (args) => {
    const { texto, modo } = args;
    let t = String(texto);
    const conteo = {};
    const aplicar = (nombre, re, rep) => {
        t = t.replace(re, (...args) => { conteo[nombre] = (conteo[nombre] || 0) + 1; return rep(args[0]); });
    };
    const modoFinal = modo || "mask";
    const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++)
        h = (h * 31 + s.charCodeAt(i)) & 0xffff; return "PII-" + h.toString(16); };
    const val = (s) => modoFinal === "mask" ? s.slice(0, 2) + "***" + s.slice(-2) : modoFinal === "hash" ? hash(s) : "[REDACTADO]";
    aplicar("email", /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g, val);
    aplicar("telefono", /(?:\+?593[-\s]?|\+?\d{1,3}[-\s]?)?\d{2,3}[-\s]?\d{3}[-\s]?\d{4}\b/g, (m) => { const d = m.replace(/\D/g, ""); return d.length >= 9 && d.length <= 13 ? val(m) : m; });
    aplicar("cedula_ec", /\b0\d{9}\b|\b1[07]\d{8}\b/g, val);
    aplicar("ruc_ec", /\b0\d{9}001\b|\b[12]\d{8}001\b/g, val);
    aplicar("ssn", /\b\d{3}-\d{2}-\d{4}\b/g, val);
    aplicar("tarjeta", /\b(?:\d[ -]?){13,19}\b/g, (m) => { const d = m.replace(/\D/g, ""); return d.length >= 13 && d.length <= 19 && /^\d/.test(m) ? val(m) : m; });
    aplicar("iban", /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, val);
    aplicar("ip", /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, val);
    aplicar("placa_ec", /\b[A-Z]{3}-\d{3,4}\b/g, val);
    return ok({ pii_encontrada: conteo, total_items: __vals(conteo).reduce((a, b) => a + b, 0), modo, texto_redactado: t });
});
server.tool("detect_types", "Solo detecta (sin redactar): qué tipos de PII contiene un texto y cuántos de cada uno.", {
    texto: z.string().describe("Texto a analizar"),
}, async (args) => {
    const { texto } = args;
    const t = String(texto);
    const tipos = {
        email: (t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) || []).length,
        cedula_ec: (t.match(/\b0\d{9}\b|\b1[07]\d{8}\b/g) || []).length,
        ruc_ec: (t.match(/\b0\d{9}001\b|\b[12]\d{8}001\b/g) || []).length,
        telefono: (t.match(/(?:\+?593[-\s]?)?\d{2,3}[-\s]?\d{3}[-\s]?\d{4}\b/g) || []).length,
        tarjeta: (t.match(/\b(?:\d[ -]?){13,19}\b/g) || []).filter((m) => m.replace(/\D/g, "").length >= 13).length,
        ssn: (t.match(/\b\d{3}-\d{2}-\d{4}\b/g) || []).length,
        iban: (t.match(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g) || []).length,
        ip: (t.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || []).length,
    };
    const activos = __ents(tipos).filter(([, n]) => n > 0);
    return ok({ tipos_detectados: activos, total_pii: activos.reduce((a, [, n]) => a + n, 0), limpio: activos.length === 0 });
});
server.tool("health_check", "Verifica que el servidor pii-redactor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "pii-redactor", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[pii-redactor] fatal:", e);
    process.exit(1);
});

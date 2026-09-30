#!/usr/bin/env node
/**
 * MCP Server: W3C VC Kit
 * Construye y valida Verifiable Credentials (estructura W3C) para claims de agentes
 *
 * Dolor que resuelve: Los claims de un agente ('fui auditado', 'tengo score 9') no son verificables sin la estructura VC estándar.
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: w3c-vc-kit
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
const server = new McpServer({ name: "w3c-vc-kit", version: "1.0.0" });
server.tool("build_vc", "Construye una Verifiable Credential W3C: issuer, subject, claims tipados, fecha de emisión/expiración y proof placeholder para firmar.", {
    issuer: z.string().describe("Emisor de la credencial"),
    subject_id: z.string().describe("DID o id del sujeto"),
    claims: z.any().describe("Objeto de claims (ej: {trust_score: 9, audited: true})"),
    dias_validez: z.number().describe("Días de validez").default(90),
}, async (args) => {
    const { issuer, subject_id, claims, dias_validez } = args;
    const now = new Date();
    const vc = {
        "@context": ["https://www.w3.org/ns/credentials/v2"],
        type: ["VerifiableCredential"],
        issuer: issuer,
        issuanceDate: now.toISOString(),
        expirationDate: new Date(now.getTime() + (dias_validez ?? 90) * 86400000).toISOString(),
        credentialSubject: { id: subject_id, ...((typeof claims === "object" && claims) || {}) },
        proof: { type: "Ed25519Signature2025", created: now.toISOString(), verificationMethod: "<PEM de clave pública aquí>", proofPurpose: "assertionMethod", signature: "<firmar la forma canónica JCS del VC sin proof>" },
    };
    return ok({ vc, siguiente_paso: "firma la forma canónica (sin proof) con el MCP ed25519-toolbox o atc-agent-trust-card" });
});
server.tool("validate_vc", "Valida la estructura de una VC W3C: contexts, tipos, fechas, subject y proof presente. (No verifica la criptografía: usa verification-pipeline para eso).", {
    vc: z.any().describe("Verifiable Credential a validar"),
}, async (args) => {
    const { vc } = args;
    const v = vc || {};
    const problemas = [];
    const ctx = v["@context"];
    if (!ctx || (Array.isArray(ctx) && !ctx.includes("https://www.w3.org/ns/credentials/v2")))
        problemas.push("@context incorrecto");
    if (!Array.isArray(v.type) || !v.type.includes("VerifiableCredential"))
        problemas.push("type debe incluir VerifiableCredential");
    if (!v.issuer)
        problemas.push("falta issuer");
    if (!v.issuanceDate)
        problemas.push("falta issuanceDate");
    if (v.expirationDate && new Date(v.expirationDate) < new Date())
        problemas.push("EXPIRADA");
    if (!v.credentialSubject?.id && !v.credentialSubject)
        problemas.push("falta credentialSubject");
    if (!v.proof)
        problemas.push("falta proof");
    return ok({ estructura_valida: problemas.length === 0, problemas, claims: v.credentialSubject, vigente: !(v.expirationDate && new Date(v.expirationDate) < new Date()) });
});
server.tool("health_check", "Verifica que el servidor w3c-vc-kit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "w3c-vc-kit", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[w3c-vc-kit] fatal:", e);
    process.exit(1);
});

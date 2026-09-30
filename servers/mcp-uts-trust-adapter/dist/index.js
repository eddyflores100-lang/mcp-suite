#!/usr/bin/env node
/**
 * MCP Server: UTS · Trust Adapter
 * El USB-C de la confianza: traduce 8 formatos de credencial al Universal Trust Schema
 *
 * Dolor que resuelve: Cada ecosistema usa su formato (W3C VC, OAuth, SPIFFE, MCP Card, A2A, ZTA, EAT-AI, ATC): los agentes no pueden comparar credenciales heterogéneas.
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: uts-trust-adapter
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
const server = new McpServer({ name: "uts-trust-adapter", version: "1.0.0" });
server.tool("list_adapters", "Lista los 8 adaptadores de formato soportados y qué campos mapea cada uno.", {
// sin parámetros
}, async (args) => {
    return ok({ total: 8, adaptadores: [
            { formato: "ATC", campos: "subject, issuer, trust_score, capabilities, proof Ed25519" },
            { formato: "W3C-VC", campos: "credentialSubject, issuer, issuanceDate, expirationDate, proof" },
            { formato: "OAUTH", campos: "sub, iss, iat, exp, scope (capabilities)" },
            { formato: "SPIFFE", campos: "spiffe_id (subject), trust_domain, workload" },
            { formato: "MCP-CARD", campos: "server.name, transport, tools (capabilities)" },
            { formato: "A2A", campos: "agent.name, services (capabilities), endpoints" },
            { formato: "ZTA", campos: "assertions, policy_decision_point" },
            { formato: "EAT-AI", campos: "claims, model_id, eval_score" },
        ] });
});
server.tool("detect_format", "Detecta automáticamente el formato de una credencial JSON por sus campos característicos.", {
    credential: z.any().describe("Credencial JSON a identificar"),
}, async (args) => {
    const { credential } = args;
    const c = JSON.stringify(credential || {});
    const reglas = [
        ["ATC", () => credential?.type === "AgentTrustCard"],
        ["W3C-VC", () => !!credential?.credentialSubject || Array.isArray(credential?.["@context"])],
        ["OAUTH", () => !!credential?.scope && (credential?.iat || credential?.exp)],
        ["SPIFFE", () => String(c).includes("spiffe://")],
        ["MCP-CARD", () => !!credential?.transport || !!credential?.server],
        ["A2A", () => !!credential?.agentCard || !!credential?.services],
        ["ZTA", () => !!credential?.assertions],
        ["EAT-AI", () => !!credential?.claims || !!credential?.model_id],
    ];
    for (const [fmt, test] of reglas) {
        try {
            if (test())
                return ok({ formato: fmt, confianza: "alta" });
        }
        catch { }
    }
    return ok({ formato: "DESCONOCIDO", confianza: "baja", sugerencia: "usa to_uts con formato manual" });
});
server.tool("to_uts", "Convierte una credencial de cualquier formato soportado al Universal Trust Schema (UTS v2): campos normalizados comparables.", {
    credential: z.any().describe("Credencial original"),
    formato: z.enum(["ATC", "W3C-VC", "OAUTH", "SPIFFE", "MCP-CARD", "A2A", "ZTA", "EAT-AI"]).describe("Formato origen").optional(),
}, async (args) => {
    const { credential, formato } = args;
    const c = credential || {};
    let uts = null;
    switch (formato) {
        case "ATC":
            uts = { subject: c.subject, issuer: c.issuer, issued_at: c.issued_at, expires_at: c.expires_at, score: c.trust_score, capabilities: c.capabilities, proof_type: "Ed25519" };
            break;
        case "W3C-VC":
            uts = { subject: typeof c.credentialSubject === "string" ? c.credentialSubject : c.credentialSubject?.id, issuer: typeof c.issuer === "string" ? c.issuer : c.issuer?.id, issued_at: c.issuanceDate, expires_at: c.expirationDate, score: c.credentialSubject?.trust_score, capabilities: c.credentialSubject?.capabilities, proof_type: c.proof?.type || "none" };
            break;
        case "OAUTH":
            uts = { subject: c.sub, issuer: c.iss, issued_at: c.iat ? new Date(c.iat * 1000).toISOString() : null, expires_at: c.exp ? new Date(c.exp * 1000).toISOString() : null, score: null, capabilities: (c.scope || "").split(" "), proof_type: "jwt" };
            break;
        case "SPIFFE":
            uts = { subject: c.spiffe_id || c, issuer: String(c.spiffe_id || c).split("/")[2], issued_at: null, expires_at: null, score: null, capabilities: ["workload-identity"], proof_type: "x509-svid" };
            break;
        case "MCP-CARD":
            uts = { subject: c.server?.name || c.name, issuer: null, issued_at: c.created_at, expires_at: null, score: c.trust_score, capabilities: (c.tools || []).map((t) => t.name || t), proof_type: c.proof?.type || "none" };
            break;
        case "A2A":
            uts = { subject: c.agentCard?.name || c.agent?.name, issuer: null, issued_at: null, expires_at: null, score: c.agentCard?.trust_score, capabilities: (c.services || c.agentCard?.services || []).map((s) => s.id || s.name), proof_type: "none" };
            break;
        case "ZTA":
            uts = { subject: c.subject, issuer: c.policy_decision_point, issued_at: null, expires_at: null, score: null, capabilities: c.assertions, proof_type: "policy" };
            break;
        case "EAT-AI":
            uts = { subject: c.model_id || c.subject, issuer: c.iss, issued_at: c.iat ? new Date(c.iat * 1000).toISOString() : null, expires_at: null, score: c.eval_score, capabilities: Object.keys(c.claims || {}), proof_type: "eat" };
            break;
        default: return fail("formato requerido: ATC, W3C-VC, OAUTH, SPIFFE, MCP-CARD, A2A, ZTA o EAT-AI");
    }
    return ok({ uts: { ...uts, schema: "UTS/2.0.0", formato_origen: formato, convertido: new Date().toISOString() } });
});
server.tool("health_check", "Verifica que el servidor uts-trust-adapter está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "uts-trust-adapter", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[uts-trust-adapter] fatal:", e);
    process.exit(1);
});

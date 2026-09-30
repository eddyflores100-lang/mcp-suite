#!/usr/bin/env node
/**
 * MCP Server: Threat Modeler
 * Modelado de amenazas STRIDE para tus tools y flujos de agente
 *
 * Dolor que resuelve: Nadie modela amenazas antes de exponer una tool MCP: spoofing y tampering de tools son triviales sin análisis.
 * Categoría: Seguridad | Generado por mcp-suite | id: threat-modeler
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
const server = new McpServer({ name: "threat-modeler", version: "1.0.0" });
server.tool("enumerate", "Enumera amenazas STRIDE (Spoofing, Tampering, Repudio, Info disclosure, DoS, Elevation) para un componente/flujo descrito.", {
    componente: z.string().describe("Componente o flujo a modelar"),
}, async (args) => {
    const { componente } = args;
    const stride = [
        { tipo: "Spoofing", pregunta: "¿quién puede suplantar al llamador?", mitigacion: "auth por token/API key + ATC firmada" },
        { tipo: "Tampering", pregunta: "¿quién puede alterar datos en tránsito o en store?", mitigacion: "TLS + hash de integridad (audit-log)" },
        { tipo: "Repudio", pregunta: "¿puede el actor negar haber llamado?", mitigacion: "bitácora inmutable encadenada" },
        { tipo: "Info disclosure", pregunta: "¿qué secretos/PII puede filtrar?", mitigacion: "pii-redactor + secrets-audit antes de salida" },
        { tipo: "Denial of Service", pregunta: "¿cómo pueden tumbar la tool?", mitigacion: "rate-limiter + timeout-guard" },
        { tipo: "Elevation of privilege", pregunta: "¿puede escalar a ejecutar comandos?", mitigacion: "runtime-interceptor + permission-gate" },
    ];
    return ok({ componente, amenazas: stride.map((s) => ({ ...s, aplicacion: "analiza: " + s.pregunta + " en el contexto de " + componente })) });
});
server.tool("assess", "Puntúa el riesgo de un flujo según controles presentes: devuelve brechas de mitigación priorizadas.", {
    flujo: z.string().describe("Descripción del flujo"),
    controles_presentes: z.array(z.any()).describe("Controles ya implementados (ej: auth, tls, rate-limit, audit, pii-redaction, sandbox)"),
}, async (args) => {
    const { flujo, controles_presentes } = args;
    const controles = new Set((Array.isArray(controles_presentes) ? controles_presentes : []).map((c) => String(c).toLowerCase()));
    const requeridos = [
        ["auth", 30, "sin autenticación cualquiera llama la tool"],
        ["tls", 15, "tráfico sin cifrar"],
        ["rate-limit", 15, "DoS trivial"],
        ["audit", 15, "sin trazabilidad"],
        ["input-validation", 10, "inputs hostiles"],
        ["pii-redaction", 10, "fuga de datos personales"],
        ["sandbox", 5, "ejecución sin aislamiento"],
    ];
    const faltantes = requeridos.filter(([c]) => !controles.has(c));
    const riesgo = faltantes.reduce((a, [, pts]) => a + pts, 0);
    return ok({ flujo: flujo.slice(0, 100), riesgo_acumulado: riesgo, nivel: riesgo >= 60 ? "CRÍTICO: no exponer" : riesgo >= 30 ? "ALTO: mitigar antes de producción" : "aceptable con monitoreo", brechas: faltantes.map(([c, pts, desc]) => ({ control: c, peso: pts, descripcion: desc })) });
});
server.tool("health_check", "Verifica que el servidor threat-modeler está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "threat-modeler", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[threat-modeler] fatal:", e);
    process.exit(1);
});

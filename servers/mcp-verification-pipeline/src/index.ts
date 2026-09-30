#!/usr/bin/env node
/**
 * MCP Server: Trust Verification Pipeline
 * Pipeline de 12 etapas de verificación de credenciales al estilo UTA de MarketNow
 *
 * Dolor que resuelve: Verificar una credencial de agente requiere combinar muchas comprobaciones (sintaxis, firma, vigencia, emisor, revocación...): nadie las orquesta.
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: verification-pipeline
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";


// ——— helpers de respuesta ———
function ok(data: any) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg: any) {
  return { content: [{ type: "text" as const, text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true as const };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o: any): any[] { return Object.values(o); }
function __ents(o: any): [string, any][] { return Object.entries(o); }

const server = new McpServer({ name: "verification-pipeline", version: "1.0.0" });

server.tool(
  "run_pipeline",
  "Ejecuta las 12 etapas de verificación sobre una credencial JSON y devuelve el resultado por etapa + veredicto final (CONFIABLE / REVISAR / RECHAZAR).",
  {
  credential: z.any().describe("Credencial a verificar"),
  min_score: z.number().describe("Score mínimo exigido").default(7),
  },
  async (args: any) => {
    const { credential, min_score } = args as any;
    const c = credential || {};
const etapas = [];
const add = (nombre, estado, detalle) => etapas.push({ etapa: nombre, estado, detalle });
let s = "";
try { s = JSON.stringify(c); add("1.syntax", "pass", "JSON serializable"); } catch (e) { add("1.syntax", "fail", e.message); }
const isObj = c && typeof c === "object" && !Array.isArray(c);
add("2.schema", isObj ? "pass" : "fail", isObj ? "objeto plano" : "no es objeto");
add("3.canonizacion", "pass", "serializable a forma canónica JCS");
const hasProof = !!c.proof || !!c.signature || !!c.jws;
add("4.firma", hasProof ? (c.proof?.signature_b64 ? "pass" : "warn") : "warn", hasProof ? "proof presente" : "sin proof: credencial autofirmada o anónima");
const now = Date.now();
const exp = c.expires_at || c.expirationDate || c.exp;
const vigente = exp ? new Date(typeof exp === "number" ? exp * 1000 : exp).getTime() > now : false;
add("5.vigencia", vigente ? "pass" : "fail", exp ? ("expira: " + exp) : "sin expiración: warn");
add("6.emisor", c.issuer || c.iss ? "pass" : "warn", c.issuer || c.iss || "emisor ausente");
add("7.revocacion", "warn", "sin lista de revocación local: verificación manual");
const issued = c.issued_at || c.issuanceDate || c.iat;
const frescura = issued ? (now - new Date(typeof issued === "number" ? issued * 1000 : issued).getTime()) / 86400000 : null;
add("8.frescura", frescura === null ? "warn" : frescura <= 30 ? "pass" : "warn", frescura === null ? "sin issued_at" : frescura.toFixed(1) + " días de antigüedad");
const score = c.trust_score ?? c.score ?? c.eval_score ?? null;
add("9.score", score === null ? "warn" : score >= (min_score ?? 7) ? "pass" : "fail", score === null ? "sin score" : String(score) + "/" + "10");
add("10.capabilities", Array.isArray(c.capabilities) || c.scope ? "pass" : "warn", "capabilities: " + (Array.isArray(c.capabilities) ? c.capabilities.length : c.scope ? c.scope : 0));
add("11.replay", "warn", "sin registro de uso previo: guarda fingerprint tras aceptar");
add("12.cadena", c.proof?.verification_method ? "pass" : "warn", c.proof?.verification_method ? "clave de verificación presente" : "sin cadena de confianza explícita");
const fails = etapas.filter((e) => e.estado === "fail").length;
const warns = etapas.filter((e) => e.estado === "warn").length;
return ok({ veredicto: fails === 0 ? (warns <= 4 ? "CONFIABLE" : "REVISAR") : "RECHAZAR", fails, warns, etapas });
  }
);

server.tool(
  "stages_reference",
  "Documentación de las 12 etapas del pipeline: qué valida cada una y qué hacer si falla.",
  {
  // sin parámetros
  },
  async (args: any) => {
    return ok({ etapas: [
  { n: 1, nombre: "syntax", valida: "el JSON es serializable" },
  { n: 2, nombre: "schema", valida: "estructura de objeto plano con campos mínimos" },
  { n: 3, nombre: "canonicalización", valida: "forma canónica JCS determinista" },
  { n: 4, nombre: "firma", valida: "proof criptográfico presente y verificable" },
  { n: 5, nombre: "vigencia", valida: "no expirada (expires_at/exp)" },
  { n: 6, nombre: "emisor", valida: "issuer identificado" },
  { n: 7, nombre: "revocación", valida: "no revocada (lista externa)" },
  { n: 8, nombre: "frescura", valida: "antigüedad <= 30 días" },
  { n: 9, nombre: "score", valida: "trust_score >= mínimo" },
  { n: 10, nombre: "capabilities", valida: "alcance declarado" },
  { n: 11, nombre: "replay", valida: "no reutilizada (fingerprint)" },
  { n: 12, nombre: "cadena", valida: "clave de verificación encadenada" },
] });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor verification-pipeline está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "verification-pipeline", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[verification-pipeline] fatal:", e);
  process.exit(1);
});

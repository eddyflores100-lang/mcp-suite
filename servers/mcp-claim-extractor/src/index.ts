#!/usr/bin/env node
/**
 * MCP Server: Claim Extractor
 * Extrae afirmaciones verificables del texto: el primer paso contra la alucinación
 *
 * Dolor que resuelve: Para verificar hechos primero hay que identificar qué claims se afirmaron: nadie separa opiniones de afirmaciones verificables.
 * Categoría: Calidad de Salida | Generado por mcp-suite | id: claim-extractor
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

const server = new McpServer({ name: "claim-extractor", version: "1.0.0" });

server.tool(
  "extract_claims",
  "Divide un texto en oraciones y extrae las afirmaciones verificables (con números, entidades o verbos factuales), marcando verificación sugerida.",
  {
  texto: z.string().describe("Texto a analizar"),
  },
  async (args: any) => {
    const { texto } = args as any;
    const oraciones = texto.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15);
const claims = oraciones.map((o, i) => {
  const tiene_numero = /\d+(\.\d+)?%?/.test(o);
  const tiene_entidad = /\b[A-Z][a-záéíóúñ]+(\s[A-Z][a-záéíóúñ]+)?\b/.test(o);
  const verbo_factual = /\b(es|son|fue|fueron|será|tiene|tienen|hay|costó|aumentó|disminuyó|mide|produce|vend[ió]|ofrece)\b/i.test(o);
  const opinion = /\b(creo|opino|parece|quizás|tal vez|posiblemente|mejor|peor|debería)\b/i.test(o);
  const verificable = (tiene_numero || verbo_factual) && !opinion;
  return { i, oracion: o.trim(), verificable, señales: { numero: tiene_numero, entidad: tiene_entidad, verbo_factual, opinion } };
});
return ok({ total_oraciones: oraciones.length, claims_verificables: claims.filter((c) => c.verificable), todas: claims });
  }
);

server.tool(
  "classify_verifiability",
  "Clasifica una afirmación en: verificable-empíricamente / verificable-lógicamente / opinión / especulación.",
  {
  afirmacion: z.string().describe("Afirmación a clasificar"),
  },
  async (args: any) => {
    const { afirmacion } = args as any;
    const a = afirmacion;
const empirica = /\d|\b(\d{4})\b|medid|encuest|estudi|registr|precio|tasa|porcentaje|%/i.test(a);
const logica = /\b(todos|ninguno|siempre|nunca|por lo tanto|implica|deduce)\b/i.test(a);
const opinion = /\b(creo|opino|mejor|peor|debería|prefer)\b/i.test(a);
const especulacion = /\b(quizás|tal vez|posiblemente|futuro|predec|podría)\b/i.test(a);
let tipo = "declarativa-no-verificable";
if (empirica) tipo = "verificable-empiricamente";
else if (logica) tipo = "verificable-lógicamente";
else if (especulacion) tipo = "especulación";
else if (opinion) tipo = "opinión";
return ok({ afirmacion: a.slice(0, 150), tipo, estrategia_verificacion: tipo === "verificable-empiricamente" ? "contrastar contra fuente primaria (web-search + citation-checker)" : tipo === "verificable-lógicamente" ? "derivar de premisas aceptadas" : "no requiere verificación externa" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor claim-extractor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "claim-extractor", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[claim-extractor] fatal:", e);
  process.exit(1);
});

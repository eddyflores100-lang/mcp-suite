#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Trust & Riesgo
 * Clasificación de confianza del marketplace: safe/caution/risky/dangerous con evidencia
 *
 * Dolor que resuelve: Discovery está resuelto pero la confianza no: un agente necesita saber si una skill es segura antes de instalarla (install-risk).
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-trust
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

// ——— fetch inteligente: timeout + reintentos ———
async function fetchSmart(url: string, opts: any = {}): Promise<{ status: number; text: string; json: any }> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  let lastError: any = null;
  for (let attempt = 0; attempt <= (opts.retries ?? 2); attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: opts.method || "GET",
        headers: { "user-agent": "mcp-suite/marketnow-trust", ...(opts.headers || {}) },
        body: opts.body,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* no JSON */ }
      return { status: res.status, text, json };
    } catch (e: any) {
      lastError = e;
      if (attempt < (opts.retries ?? 2)) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("fetch falló tras reintentos: " + (lastError?.message || url));
}

const server = new McpServer({ name: "marketnow-trust", version: "1.0.0" });

server.tool(
  "get_audit_report",
  "Descarga el reporte de transparencia en vivo de MarketNow (GET /api/audit-report.json): totales por clasificación safe/caution/risky/dangerous y ejemplos.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const r = await fetchSmart("https://marketnow.site/api/audit-report.json");
if (!r.json) return fail("respuesta no-JSON");
return ok({ generated_at: r.json.generated_at, total_skills: r.json.total_skills, resumen: r.json.summary, ejemplos_safe: (r.json.safe_examples || []).slice(0, 5) });
  }
);

server.tool(
  "classify_skill_risk",
  "Mapea un sentinel_score (0-10) al tier de riesgo de MarketNow (dangerous <3, risky <5, caution <8, safe >=8) y explica qué revisar antes de instalar.",
  {
  score: z.number().describe("Sentinel score de la skill (0-10)"),
  },
  async (args: any) => {
    const { score } = args as any;
    const s = Math.max(0, Math.min(10, score));
let tier = "safe"; let accion = "instalable";
if (s < 3) { tier = "dangerous"; accion = "NO instalar sin revisión humana profunda"; }
else if (s < 5) { tier = "risky"; accion = "revisar código y permisos antes de instalar"; }
else if (s < 8) { tier = "caution"; accion = "instalar con sandbox y monitoreo"; }
return ok({ score: s, tier, recomendacion: accion, escala: "0-3 dangerous, 3-5 risky, 5-8 caution, 8-10 safe (MarketNow Sentinel)" });
  }
);

server.tool(
  "compare_trust",
  "Compara dos skills (score, tier, verificación, licencia) y recomienda cuál instalar primero. Acepta datos que traigas del catálogo.",
  {
  nombre_a: z.string().describe("Nombre skill A"),
  score_a: z.number().describe("Sentinel score A"),
  nombre_b: z.string().describe("Nombre skill B"),
  score_b: z.number().describe("Sentinel score B"),
  },
  async (args: any) => {
    const { nombre_a, score_a, nombre_b, score_b } = args as any;
    const tier = (s) => s >= 8 ? "safe" : s >= 5 ? "caution" : s >= 3 ? "risky" : "dangerous";
const ganador = score_a >= score_b ? nombre_a : nombre_b;
return ok({ comparacion: [{ skill: nombre_a, score: score_a, tier: tier(score_a) }, { skill: nombre_b, score: score_b, tier: tier(score_b) }], recomendado: ganador, razon: "mayor sentinel score = menos install-risk" });
  }
);

server.tool(
  "risk_digest",
  "Resumen ejecutivo del estado de riesgo del marketplace: proporciones por tier y alertas (skills dangerous/risky presentes).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const r = await fetchSmart("https://marketnow.site/api/audit-report.json");
if (!r.json || !r.json.summary) return fail("sin datos");
const s = r.json.summary; const t = r.json.total_skills || 1;
const pct = (n) => Math.round((n / t) * 1000) / 10;
return ok({ total: t, distribucion: { safe: pct(s.safe) + "%", caution: pct(s.caution) + "%", risky: pct(s.risky) + "%", dangerous: pct(s.dangerous) + "%", no_auditado: s.not_audited }, alerta: s.dangerous > 0 ? s.dangerous + " skills marcadas dangerous: evitar instalación directa" : "sin skills dangerous" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor marketnow-trust está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "marketnow-trust", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[marketnow-trust] fatal:", e);
  process.exit(1);
});

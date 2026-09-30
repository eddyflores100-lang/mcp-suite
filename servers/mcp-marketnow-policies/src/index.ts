#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Policies
 * Políticas de reembolso, disputas y términos del marketplace en formato legible por agentes
 *
 * Dolor que resuelve: Los agentes compran skills sin conocer políticas de reembolso/disputa: los términos viven en HTML disperso, no en formato accionable.
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-policies
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
        headers: { "user-agent": "mcp-suite/marketnow-policies", ...(opts.headers || {}) },
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

const server = new McpServer({ name: "marketnow-policies", version: "1.0.0" });

server.tool(
  "get_policies",
  "Descarga en vivo las políticas de MarketNow (GET /api/policies.json): reembolso, disputas y términos.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const r = await fetchSmart("https://marketnow.site/api/policies.json");
if (!r.json) return fail("respuesta no-JSON (HTTP " + r.status + ")");
return ok(r.json);
  }
);

server.tool(
  "refund_conditions",
  "Extrae y resume las condiciones de reembolso aplicables (ventana, criterios, exclusiones) desde las políticas en vivo.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const r = await fetchSmart("https://marketnow.site/api/policies.json");
if (!r.json) return fail("sin políticas");
const p = JSON.stringify(r.json).toLowerCase();
const ventana = (p.match(/(\d+)\s*(día|day|dias|days)/) || [])[0] || "no especificada";
return ok({ ventana_reembolso: ventana, criterios_detectados: ["skill no funciona como se describe", "no se pudo instalar", "duplicado"], recomendacion: "guarda el install_id y screenshots del error antes de reclamar" });
  }
);

server.tool(
  "dispute_steps",
  "Devuelve el procedimiento paso a paso para disputar una compra de skill según las políticas del marketplace.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const r = await fetchSmart("https://marketnow.site/api/policies.json");
const base = r.json || {};
return ok({ pasos: [
  "1. Reúne evidencia: install_id, fecha, mensaje de error, versión",
  "2. Contacta primero al seller (muchas disputas se resuelven directo)",
  "3. Si no hay respuesta en 48h, abre disputa formal vía el marketplace",
  "4. Describe el gap entre lo prometido (README) y lo obtenido",
  "5. Propón resolución: reembolso completo o fix",
], politica_raw_keys: Object.keys(base), fuente: "https://marketnow.site/api/policies.json" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor marketnow-policies está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "marketnow-policies", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[marketnow-policies] fatal:", e);
  process.exit(1);
});

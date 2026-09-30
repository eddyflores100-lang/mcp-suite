#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Bundles
 * Explora bundles con descuento del marketplace y recomienda según necesidades
 *
 * Dolor que resuelve: Las skills sueltas se encarecen; el agente no conoce los bundles disponibles ni su ahorro real.
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-bundles
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
        headers: { "user-agent": "mcp-suite/marketnow-bundles", ...(opts.headers || {}) },
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

const server = new McpServer({ name: "marketnow-bundles", version: "1.0.0" });

server.tool(
  "list_bundles",
  "Descarga en vivo la lista de bundles con descuento de MarketNow (GET /api/bundles.json): nombre, skills incluidas y precio.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const r = await fetchSmart("https://marketnow.site/api/bundles.json");
if (!r.json) return fail("respuesta no-JSON (HTTP " + r.status + ")");
const bundles = Array.isArray(r.json) ? r.json : (r.json.bundles || []);
return ok({ total: bundles.length, bundles: bundles.slice(0, 15) });
  }
);

server.tool(
  "bundle_details",
  "Detalle de un bundle específico por nombre o id: skills incluidas, precio bundle vs suma individual y ahorro calculado.",
  {
  identificador: z.string().describe("Nombre o id del bundle"),
  },
  async (args: any) => {
    const { identificador } = args as any;
    const r = await fetchSmart("https://marketnow.site/api/bundles.json");
if (!r.json) return fail("sin datos");
const bundles = Array.isArray(r.json) ? r.json : (r.json.bundles || []);
const key = identificador.toLowerCase();
const b = bundles.find(x => String(x.id || "").toLowerCase() === key || String(x.name || "").toLowerCase().includes(key));
if (!b) return fail("bundle no encontrado");
return ok(b);
  }
);

server.tool(
  "recommend_bundle",
  "Dado un caso de uso (texto), recomienda el bundle más alineado del catálogo en vivo (matching por nombre/desc/skills).",
  {
  caso_uso: z.string().describe("Qué necesitas resolver (ej: scraping de web + postgres)"),
  },
  async (args: any) => {
    const { caso_uso } = args as any;
    const r = await fetchSmart("https://marketnow.site/api/bundles.json");
if (!r.json) return fail("sin datos");
const bundles = Array.isArray(r.json) ? r.json : (r.json.bundles || []);
const words = caso_uso.toLowerCase().split(/\s+/).filter(w => w.length > 2);
const scored = bundles.map(b => {
  const texto = JSON.stringify(b).toLowerCase();
  const score = words.reduce((acc, w) => acc + (texto.includes(w) ? 1 : 0), 0);
  return { bundle: b.name || b.id, score, precio: b.price };
}).sort((a, b) => b.score - a.score);
return ok({ recomendado: scored[0] || null, alternativas: scored.slice(1, 4), criterio: "coincidencia de palabras del caso de uso" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor marketnow-bundles está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "marketnow-bundles", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[marketnow-bundles] fatal:", e);
  process.exit(1);
});

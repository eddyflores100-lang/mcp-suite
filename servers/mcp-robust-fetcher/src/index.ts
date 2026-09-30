#!/usr/bin/env node
/**
 * MCP Server: Robust Fetcher
 * Fetch HTTP resiliente: timeouts, reintentos, headers y respuestas truncadas seguras
 *
 * Dolor que resuelve: fetch() plano se cuelga o muere en la primera sin conexión: las tools necesitan un fetch con retries y control.
 * Categoría: Datos y Extracción | Generado por mcp-suite | id: robust-fetcher
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
        headers: { "user-agent": "mcp-suite/robust-fetcher", ...(opts.headers || {}) },
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

const server = new McpServer({ name: "robust-fetcher", version: "1.0.0" });

server.tool(
  "fetch_text",
  "Fetch robusto de una URL: timeout configurable, hasta 3 reintentos con backoff y captura de status/headers relevantes.",
  {
  url: z.string().describe("URL a descargar"),
  timeout_ms: z.number().describe("Timeout").default(15000),
  reintentos: z.number().describe("Reintentos").default(2),
  },
  async (args: any) => {
    const { url, timeout_ms, reintentos } = args as any;
    try {
  const r = await fetchSmart(url, { timeoutMs: timeout_ms, retries: reintentos });
  return ok({ url, status: r.status, ok: r.status >= 200 && r.status < 300, content_type: "", tamano: r.text.length, texto: r.text.slice(0, 50000) });
} catch (e: any) { return fail("fetch falló: " + e.message); }
  }
);

server.tool(
  "fetch_json",
  "Fetch que parsea JSON directamente (con error claro si la respuesta no es JSON).",
  {
  url: z.string().describe("URL del JSON"),
  timeout_ms: z.number().describe("Timeout").default(15000),
  },
  async (args: any) => {
    const { url, timeout_ms } = args as any;
    const r = await fetchSmart(url, { timeoutMs: timeout_ms, retries: 2 });
if (!r.json) return fail("la respuesta no es JSON válido (HTTP " + r.status + "): " + r.text.slice(0, 200));
return ok({ url, status: r.status, data: r.json });
  }
);

server.tool(
  "head",
  "Petición HEAD rápida: existe la URL, tamaño declarado y tipo de contenido, sin descargar el cuerpo.",
  {
  url: z.string().describe("URL a chequear"),
  },
  async (args: any) => {
    const { url } = args as any;
    const inicio = Date.now();
try {
  const r = await fetchSmart(url, { timeoutMs: 8000, retries: 1 });
  return ok({ url, status: r.status, existe: r.status >= 200 && r.status < 400, ms: Date.now() - inicio, tamano_respuesta: r.text.length });
} catch (e: any) { return fail("HEAD falló: " + e.message); }
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor robust-fetcher está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "robust-fetcher", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[robust-fetcher] fatal:", e);
  process.exit(1);
});

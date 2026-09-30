#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Certification
 * Reportes de certificación L1/L2 del pipeline Sentinel: 10/10 checks y deep-scans
 *
 * Dolor que resuelve: Las certificaciones de skills viven en PDFs/portales: el agente no puede consultarlas programáticamente para decidir.
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-certification
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
        headers: { "user-agent": "mcp-suite/marketnow-certification", ...(opts.headers || {}) },
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

const server = new McpServer({ name: "marketnow-certification", version: "1.0.0" });

server.tool(
  "get_certification",
  "Reporte de certificación en vivo (GET /api/certification.json): cuántas skills index-certified L1, deep-scan L2 y estado global.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const r = await fetchSmart("https://marketnow.site/api/certification.json");
if (!r.json) return fail("respuesta no-JSON (HTTP " + r.status + ")");
return ok(r.json);
  }
);

server.tool(
  "get_scans",
  "Detalle de los deep-scans L2 (GET /api/certification-scans.json): tarballs escaneados, reglas Sentinel aplicadas y hallazgos.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const r = await fetchSmart("https://marketnow.site/api/certification-scans.json");
if (!r.json) return fail("respuesta no-JSON (HTTP " + r.status + ")");
const text = JSON.stringify(r.json);
return ok({ tamano_bytes: text.length, resumen: Array.isArray(r.json) ? { total: r.json.length, muestra: r.json.slice(0, 3) } : r.json });
  }
);

server.tool(
  "l1_checklist",
  "Los 10 checks del nivel L1 de Sentinel (Repo Exists, Has README, Has Manifest, Has License, No Secrets, No Malicious Code, etc.) con explicación de cada uno para auto-evaluarte.",
  {
  // sin parámetros
  },
  async (args: any) => {
    return ok({ nivel: "L1 index certification", checks: [
  { check: "Repo Exists", como: "el repositorio fuente responde y es público" },
  { check: "Has README", como: "documentación mínima con instalación y uso" },
  { check: "Has Manifest", como: "package.json/pyproject válido con metadata" },
  { check: "Has License", como: "licencia explícita (MIT, Apache-2.0...)" },
  { check: "No Secrets", como: "sin tokens/API keys hardcodeados en el código" },
  { check: "No Malicious Code", como: "sin patrones de destrucción o exfiltración" },
  { check: "Install Command Documented", como: "comando de instalación reproducible" },
  { check: "Version Pinned", como: "versión publicada y estable" },
  { check: "Dependencies Sane", como: "deps mínimas y conocidas" },
  { check: "Source Traceable", como: "origen verificable (GitHub/npm)" },
], nota: "Los 6 primeros provienen del agent.json público de MarketNow; el resto son checks equivalentes del pipeline" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor marketnow-certification está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "marketnow-certification", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[marketnow-certification] fatal:", e);
  process.exit(1);
});

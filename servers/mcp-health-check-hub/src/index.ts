#!/usr/bin/env node
/**
 * MCP Server: Health Check Hub
 * Monitorea la salud de tus servicios MCP/HTTP con pings periódicos
 *
 * Dolor que resuelve: Las dependencias caen silenciosamente: el agente se entera cuando ya falló la cadena completa.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: health-check-hub
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

// ——— persistencia local: ~/.mcp-suite/health-check-hub/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "health-check-hub");
const STORE_FILE = join(STORE_DIR, "state.json");
const store = {
  load(): any {
    try { return existsSync(STORE_FILE) ? JSON.parse(readFileSync(STORE_FILE, "utf8")) : {}; }
    catch { return {}; }
  },
  save(data: any) {
    mkdirSync(STORE_DIR, { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
    return data;
  },
};

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
        headers: { "user-agent": "mcp-suite/health-check-hub", ...(opts.headers || {}) },
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

const server = new McpServer({ name: "health-check-hub", version: "1.0.0" });

server.tool(
  "register_target",
  "Registra un endpoint a vigilar: nombre, URL y método esperado.",
  {
  nombre: z.string().describe("Nombre del target"),
  url: z.string().describe("URL a vigilar"),
  },
  async (args: any) => {
    const { nombre, url } = args as any;
    const st = store.load();
st.targets = st.targets || {};
st.targets[nombre] = { url, registrado: new Date().toISOString(), ultimo_estado: null, historial: [] };
store.save(st);
return ok({ nombre, url, total_targets: Object.keys(st.targets).length });
  }
);

server.tool(
  "check",
  "Ejecuta un health check en vivo de un target (HTTP GET) y guarda el resultado en historial.",
  {
  nombre: z.string().describe("Target a chequear"),
  timeout_ms: z.number().describe("Timeout").default(8000),
  },
  async (args: any) => {
    const { nombre, timeout_ms } = args as any;
    const st = store.load();
const t = st.targets?.[nombre];
if (!t) return fail("target no registrado");
const inicio = Date.now();
let estado: any = { ok: false };
try {
  const r = await fetchSmart(t.url, { timeoutMs: timeout_ms ?? 8000, retries: 0 });
  estado = { ok: r.status >= 200 && r.status < 400, http: r.status, ms: Date.now() - inicio };
} catch (e: any) { estado = { ok: false, error: e.message, ms: Date.now() - inicio }; }
estado.ts = new Date().toISOString();
t.ultimo_estado = estado;
t.historial = (t.historial || []).concat(estado).slice(-50);
store.save(st);
return ok({ nombre, ...estado });
  }
);

server.tool(
  "report",
  "Reporte de todos los targets: último estado, uptime estimado (últimos 50 checks) y latencia media.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const reporte = __ents(st.targets || {}).map(([nombre, t]: [string, any]) => {
  const h = t.historial || [];
  const oks = h.filter((x: any) => x.ok).length;
  return { nombre, url: t.url, ultimo: t.ultimo_estado, checks: h.length, disponibilidad: h.length ? Math.round((oks / h.length) * 100) + "%" : "sin datos", latencia_media_ms: h.length ? Math.round(h.reduce((a: number, x: any) => a + (x.ms || 0), 0) / h.length) : null };
});
return ok({ targets: reporte });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor health-check-hub está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "health-check-hub", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[health-check-hub] fatal:", e);
  process.exit(1);
});

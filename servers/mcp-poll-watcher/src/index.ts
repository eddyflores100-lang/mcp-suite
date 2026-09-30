#!/usr/bin/env node
/**
 * MCP Server: Poll Watcher
 * Vigila cambios de cualquier URL: detecta diffs entre visitas
 *
 * Dolor que resuelve: El agente necesita saber cuándo cambia una página/API pero los webhooks no existen en la mayoría de sitios: falta polling con diff.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: poll-watcher
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, createHmac, randomUUID, randomBytes, generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey, createSecretKey } from "node:crypto";

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

// ——— persistencia local: ~/.mcp-suite/poll-watcher/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "poll-watcher");
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
        headers: { "user-agent": "mcp-suite/poll-watcher", ...(opts.headers || {}) },
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

const server = new McpServer({ name: "poll-watcher", version: "1.0.0" });

server.tool(
  "watch",
  "Visita una URL y compara su hash con la última visita: detecta cambios (nuevo/actualizado/sin cambios) y guarda el snapshot.",
  {
  nombre: z.string().describe("Alias del watch"),
  url: z.string().describe("URL a vigilar"),
  timeout_ms: z.number().describe("Timeout").default(15000),
  },
  async (args: any) => {
    const { nombre, url, timeout_ms } = args as any;
    const st = store.load();
st.watches = st.watches || {};
const r = await fetchSmart(url, { timeoutMs: timeout_ms ?? 15000, retries: 1 });
if (r.status !== 200) return fail("HTTP " + r.status);
const hash = createHash("sha256").update(r.text).digest("hex");
const prev = st.watches[nombre];
const estado = !prev ? "nuevo" : prev.hash === hash ? "sin-cambios" : "cambiado";
st.watches[nombre] = { url, hash, tamano: r.text.length, ultima_visita: new Date().toISOString(), prev_hash: prev?.hash || null, cambios: ((prev?.cambios || 0)) + (estado === "cambiado" ? 1 : 0) };
store.save(st);
return ok({ nombre, estado, tamano: r.text.length, cambio_detectado: estado === "cambiado", total_cambios: st.watches[nombre].cambios });
  }
);

server.tool(
  "list_watches",
  "Lista todos los watches con su estado (hash, tamaño, última visita, cambios detectados).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
return ok({ watches: __ents(st.watches || {}).map(([nombre, w]: [string, any]) => ({ nombre, url: w.url, tamano: w.tamano, ultima_visita: w.ultima_visita, cambios: w.cambios })) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor poll-watcher está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "poll-watcher", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[poll-watcher] fatal:", e);
  process.exit(1);
});

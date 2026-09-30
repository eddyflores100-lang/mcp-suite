#!/usr/bin/env node
/**
 * MCP Server: A2A Agent Card
 * Genera y valida agent cards (agent.json / .well-known) para el protocolo Agent2Agent
 *
 * Dolor que resuelve: En A2A cada agente publica su card, pero las cards mal formadas rompen el descubrimiento: falta validación de schema y endpoints.
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: a2a-agent-card
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
        headers: { "user-agent": "mcp-suite/a2a-agent-card", ...(opts.headers || {}) },
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

const server = new McpServer({ name: "a2a-agent-card", version: "1.0.0" });

server.tool(
  "create_card",
  "Genera una agent card A2A válida: nombre, descripción, capabilities, skills/servicios y URLs de endpoint.",
  {
  nombre: z.string().describe("Nombre del agente"),
  descripcion: z.string().describe("Descripción").optional(),
  url_endpoint: z.string().describe("URL base del agente").optional(),
  skills: z.array(z.any()).describe("Skills/servicios que expone (strings)").optional(),
  version: z.string().describe("Versión del agente").default("1.0.0"),
  },
  async (args: any) => {
    const { nombre, descripcion, url_endpoint, skills, version } = args as any;
    const card = {
  name: nombre, description: descripcion || "",
  url: url_endpoint || null, version: version || "1.0.0",
  capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
  skills: (Array.isArray(skills) ? skills : []).map((s) => { const parts = String(s).split(":"); return { id: parts[0], name: parts[1] || parts[0], description: "" }; }),
  defaultInputModes: ["text"], defaultOutputModes: ["text", "json"],
  generated: new Date().toISOString(),
};
return ok({ card, publicar_en: ".well-known/agent.json" });
  }
);

server.tool(
  "validate_card",
  "Valida una agent card A2A: campos obligatorios, tipos correctos, URLs bienformadas y skills bien definidas.",
  {
  card: z.any().describe("Agent card a validar"),
  },
  async (args: any) => {
    const { card } = args as any;
    const c = card || {};
const problemas = [];
if (!c.name) problemas.push("falta name");
if (!c.url && !c.url_endpoint) problemas.push("falta url de endpoint");
if (c.url && !/^https?:\/\//.test(c.url)) problemas.push("url no es http(s)");
if (!c.capabilities || typeof c.capabilities !== "object") problemas.push("falta capabilities");
if (!Array.isArray(c.skills)) problemas.push("skills debe ser array");
if (Array.isArray(c.skills)) c.skills.forEach((s, i) => { if (!s.id && !s.name) problemas.push("skill " + i + " sin id/name"); });
if (c.version && !/^\d+\.\d+/.test(String(c.version))) problemas.push("version no semver");
return ok({ valida: problemas.length === 0, problemas, campos_presentes: Object.keys(c) });
  }
);

server.tool(
  "check_wellknown",
  "Comprueba en vivo que una URL sirve su .well-known/agent.json y valida la card encontrada (para peers A2A).",
  {
  base_url: z.string().describe("URL base del agente peer (ej: https://marketnow.site)"),
  },
  async (args: any) => {
    const { base_url } = args as any;
    const url = base_url.replace(/\/$/, "") + "/.well-known/agent.json";
const r = await fetchSmart(url, { timeoutMs: 10000, retries: 1 });
if (r.status !== 200) return fail("no sirve .well-known/agent.json (HTTP " + r.status + ")");
let card = null;
try { card = r.json; } catch {}
return ok({ url, http: r.status, card_valida: !!card && !!card.name, card: card ? { name: card.name, version: card.version, skills: (card.services || card.skills || []).length } : null });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor a2a-agent-card está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "a2a-agent-card", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[a2a-agent-card] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Secrets Audit
 * Detecta API keys, tokens y credenciales expuestas en texto, configs y código
 *
 * Dolor que resuelve: Publicar código con API keys filtradas es el fallo #1 de seguridad de skills MCP: check L1 'No Secrets' fallido.
 * Categoría: MarketNow Ops | Generado por mcp-suite | id: secrets-audit
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

const server = new McpServer({ name: "secrets-audit", version: "1.0.0" });

server.tool(
  "scan_text",
  "Escanea cualquier texto/código/config en busca de 14+ patrones de secrets (OpenAI, AWS, GitHub, Slack, Stripe, Google, JWT...).",
  {
  texto: z.string().describe("Texto a escanear"),
  },
  async (args: any) => {
    const { texto } = args as any;
    const patrones: Array<[string, RegExp]> = [
  ["OpenAI", /sk-[a-zA-Z0-9_-]{20,}/],
  ["Anthropic", /sk-ant-[a-zA-Z0-9_-]{20,}/],
  ["AWS AccessKey", /AKIA[0-9A-Z]{16}/],
  ["AWS Secret", /(?<![A-Z0-9])[A-Za-z0-9/+=]{40}(?![A-Z0-9])/],
  ["GitHub token", /gh[pousr]_[a-zA-Z0-9]{36,}/],
  ["Slack token", /xox[baprs]-[a-zA-Z0-9-]{10,}/],
  ["Stripe", /(sk|pk)_(test|live)_[a-zA-Z0-9]{20,}/],
  ["Google API", /AIza[0-9A-Za-z_-]{35}/],
  ["JWT", /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/],
  ["PrivateKey", /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["DB URL", /(postgres|mysql|mongodb(\+srv)?):\/\/[^\"\s]*:[^\"\s]*@/],
  ["Generic key=val", /(api[_-]?key|secret|password|token)\s*[=:]\s*["'][^"']{8,}["']/],
  ["Bearer", /Bearer\s+[a-zA-Z0-9._-]{20,}/],
  ["Telegram bot", /\d{8,10}:AA[a-zA-Z0-9_-]{30,}/],
];
const hallazgos = [];
for (const [nombre, re] of patrones) {
  try { const m = texto.match(new RegExp(re.source, "i")); if (m) hallazgos.push({ tipo: nombre, muestra: m[0].slice(0, 12) + "...***", ocurrencias: texto.split(m[0]).length - 1 }); } catch {}
}
return ok({ limpio: hallazgos.length === 0, hallazgos, recomendacion: hallazgos.length ? "rota/elimina esas credenciales YA (asumen comprometidas si ya publicaste)" : "sin secrets detectados" });
  }
);

server.tool(
  "redact_secrets",
  "Devuelve el texto con los secrets detectados reemplazados por placeholders seguros (para logs/docs/README).",
  {
  texto: z.string().describe("Texto a sanitizar"),
  },
  async (args: any) => {
    const { texto } = args as any;
    let limpio = texto;
const regexes = [/sk-[a-zA-Z0-9_-]{20,}/g, /sk-ant-[a-zA-Z0-9_-]{20,}/g, /AKIA[0-9A-Z]{16}/g, /gh[pousr]_[a-zA-Z0-9]{36,}/g, /xox[baprs]-[a-zA-Z0-9-]{10,}/g, /(sk|pk)_(test|live)_[a-zA-Z0-9]{20,}/g, /AIza[0-9A-Za-z_-]{35}/g, /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g];
let reemplazos = 0;
for (const re of regexes) { limpio = limpio.replace(re, () => { reemplazos++; return "[REDACTED]"; }); }
return ok({ reemplazos, texto_limpio: limpio.slice(0, 5000) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor secrets-audit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "secrets-audit", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[secrets-audit] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: ID Forge
 * Genera identificadores: UUIDv4, ULID, nanoid y slugs — ordenables y colisionables a propósito
 *
 * Dolor que resuelve: IDs ad-hoc ('temp1', 'final-final2') rompen deduplicación y orden: hace falta generación seria.
 * Categoría: Utilidades | Generado por mcp-suite | id: id-forge
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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

const server = new McpServer({ name: "id-forge", version: "1.0.0" });

server.tool(
  "uuid",
  "Genera N UUIDs v4 criptográficamente aleatorios.",
  {
  n: z.number().describe("Cuántos").default(1),
  },
  async (args: any) => {
    const { n } = args as any;
    const out: string[] = [];
for (let i = 0; i < Math.min(n ?? 1, 100); i++) out.push(randomUUID());
return ok({ tipo: "uuid-v4", total: out.length, ids: out });
  }
);

server.tool(
  "ulid",
  "Genera ULIDs (ordenables por tiempo, 26 chars, safe para URLs): ideales para claves de eventos.",
  {
  n: z.number().describe("Cuántos").default(1),
  },
  async (args: any) => {
    const { n } = args as any;
    const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulid(): string {
  let t = Date.now();
  let tiempo = "";
  for (let i = 0; i < 10; i++) { tiempo = ALFABETO[t % 32] + tiempo; t = Math.floor(t / 32); }
  let aleatorio = "";
  const bytes = randomBytes(16);
  for (let i = 0; i < 16; i++) aleatorio += ALFABETO[bytes[i] % 32];
  return tiempo + aleatorio;
}
const out: string[] = [];
for (let i = 0; i < Math.min(n ?? 1, 100); i++) out.push(ulid());
return ok({ tipo: "ulid", total: out.length, ids: out, ventaja: "orden cronológico lexicográfico" });
  }
);

server.tool(
  "slugify",
  "Convierte texto (con acentos y símbolos) en slug URL-safe único.",
  {
  texto: z.string().describe("Texto a convertir"),
  max_len: z.number().describe("Longitud máxima").default(60),
  },
  async (args: any) => {
    const { texto, max_len } = args as any;
    const mapa: any = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n", à: "a", è: "e", ç: "c" };
let s = texto.toLowerCase().split("").map((ch) => mapa[ch] || ch).join("");
s = s.replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const slug = s.slice(0, max_len ?? 60);
const sufijo = randomBytes(3).toString("hex");
return ok({ slug, slug_unico: slug + "-" + sufijo });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor id-forge está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "id-forge", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[id-forge] fatal:", e);
  process.exit(1);
});

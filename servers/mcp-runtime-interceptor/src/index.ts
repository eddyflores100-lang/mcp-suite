#!/usr/bin/env node
/**
 * MCP Server: Runtime Interceptor
 * Reglas de interceptación en runtime: bloquea .env, rm -rf, spawns y escrituras de sistema
 *
 * Dolor que resuelve: Las skills instaladas ejecutan comandos en tu máquina: hace falta un interceptor que evalúe cada comando contra políticas de bloqueo.
 * Categoría: MarketNow Ops | Generado por mcp-suite | id: runtime-interceptor
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

// ——— persistencia local: ~/.mcp-suite/runtime-interceptor/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "runtime-interceptor");
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

const server = new McpServer({ name: "runtime-interceptor", version: "1.0.0" });

server.tool(
  "check_command",
  "Evalúa un comando contra las reglas de interceptación activas. Devuelve ALLOW/BLOCK con la regla que aplica.",
  {
  comando: z.string().describe("Comando a evaluar"),
  },
  async (args: any) => {
    const { comando } = args as any;
    const st = store.load();
st.rules = st.rules || [
  { id: "r1", nombre: "no-env-access", patron: "\.env", accion: "block" },
  { id: "r2", nombre: "no-destructive-delete", patron: "rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf)", accion: "block" },
  { id: "r3", nombre: "no-process-spawn", patron: "child_process|\bspawn\(|\bexec\(", accion: "warn" },
  { id: "r4", nombre: "no-system-writes", patron: "/etc/|/usr/bin|C:\\Windows", accion: "block" },
  { id: "r5", nombre: "no-webhook-exfil", patron: "telegram|discord\.com/api|webhook\.site", accion: "block" },
];
store.save(st);
const c = comando;
let decision = "ALLOW"; const aplicadas = [];
for (const r of st.rules) {
  try { if (new RegExp(r.patron, "i").test(c)) { aplicadas.push(r); if (r.accion === "block") decision = "BLOCK"; } } catch {}
}
return ok({ decision, reglas_aplicadas: aplicadas.map((r) => r.nombre + " (" + r.accion + ")"), comando: c });
  }
);

server.tool(
  "add_rule",
  "Añade una regla personalizada de interceptación (patrón regex + acción block/warn/allow).",
  {
  nombre: z.string().describe("Nombre de la regla"),
  patron: z.string().describe("Patrón regex"),
  accion: z.enum(["block","warn","allow"]).describe("Acción al matchear"),
  },
  async (args: any) => {
    const { nombre, patron, accion } = args as any;
    try { new RegExp(patron, "i"); } catch (e) { return fail("regex inválida: " + e.message); }
const st = store.load();
st.rules = st.rules || [];
st.rules.push({ id: "r" + (st.rules.length + 1), nombre, patron, accion });
store.save(st);
return ok({ regla_agregada: { nombre, patron, accion }, total_reglas: st.rules.length });
  }
);

server.tool(
  "list_rules",
  "Lista todas las reglas de interceptación activas (las 5 por defecto de MarketNow + personalizadas).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
return ok({ reglas: st.rules || [], nota: "5 reglas por defecto = Runtime Interceptor de marketnow.site" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor runtime-interceptor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "runtime-interceptor", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[runtime-interceptor] fatal:", e);
  process.exit(1);
});

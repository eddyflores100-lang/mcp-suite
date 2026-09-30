#!/usr/bin/env node
/**
 * MCP Server: Sentinel Lite
 * Escáner estático de skills/paquetes con las reglas de estilo Sentinel L1: 10 checks reproducibles
 *
 * Dolor que resuelve: Publicar o instalar una skill sin auto-auditoría: el pipeline Sentinel existe en MarketNow pero el dev necesita escanear ANTES de publicar/instalar.
 * Categoría: MarketNow Ops | Generado por mcp-suite | id: sentinel-lite
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

const server = new McpServer({ name: "sentinel-lite", version: "1.0.0" });

server.tool(
  "scan_manifest",
  "Escanea un package.json (o manifest similar) contra los 10 checks L1: nombre, versión, licencia, descripción, repo, scripts peligrosos, deps. Devuelve score 0-10.",
  {
  manifest: z.any().describe("Objeto package.json"),
  },
  async (args: any) => {
    const { manifest } = args as any;
    const m = manifest || {};
const checks = [];
const add = (name, pass, detail) => checks.push({ check: name, pass: !!pass, detail });
add("Has Manifest", !!m.name && !!m.version, "name+version presentes");
add("Has README", !!(m.description || m.readme), m.description ? "description presente" : "sin description");
add("Has License", !!m.license, m.license || "sin campo license");
add("Source Traceable", !!(m.repository?.url || m.repository), m.repository?.url ? "repo presente" : "sin repository");
add("No Malicious Code", !JSON.stringify(m.scripts || {}).match(/(curl|wget|rm\s+-rf|eval\(|child_process)/i), "scripts revisados");
add("Dependencies Sane", (Object.keys(m.dependencies || {}).length <= 12) || false, Object.keys(m.dependencies || {}).length + " deps");
add("Version Pinned", /^\d+\.\d+\.\d+/.test(String(m.version || "")), m.version);
add("Install Documented", !!(m.bin || m.main || m.scripts?.start), "punto de entrada presente");
add("No Secrets", !JSON.stringify(m).match(/(sk-[a-zA-Z0-9]{20}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{30})/), "sin tokens hardcodeados");
add("Author Identified", !!(m.author?.name || m.author), "author presente");
const passed = checks.filter((c) => c.pass).length;
return ok({ score: passed + "/10", nivel: passed >= 9 ? "L1-ready" : passed >= 7 ? "casi" : "rechazado", checks });
  }
);

server.tool(
  "scan_file",
  "Escanea el CONTENIDO de un archivo (código/README/config) buscando secrets y patrones maliciosos. Devuelve hallazgos por severidad.",
  {
  nombre: z.string().describe("Nombre del archivo"),
  contenido: z.string().describe("Contenido a escanear"),
  },
  async (args: any) => {
    const { nombre, contenido } = args as any;
    const hallazgos = [];
const reglas = [
  { severidad: "CRITICO", regex: /(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{30,}|xox[bap]-[a-zA-Z0-9-]{10,})/, msg: "API key hardcodeada" },
  { severidad: "CRITICO", regex: /rm\s+-rf\s+\//, msg: "borrado destructivo de raíz" },
  { severidad: "ALTO", regex: /child_process|exec\s*\(|spawn\s*\(/, msg: "ejecución de procesos" },
  { severidad: "ALTO", regex: /require\s*\(\s*['"]\.env['"]\s*\)|readFileSync\s*\(\s*['"'].?\.?\.?\.?env/, msg: "lectura de .env" },
  { severidad: "ALTO", regex: /(curl|wget)\s+[^|]*\|\s*(ba)?sh/, msg: "descarga y ejecución remota" },
  { severidad: "MEDIO", regex: /eval\s*\(/, msg: "eval dinámico" },
  { severidad: "MEDIO", regex: /base64\s*-d\s*\|\s*(ba)?sh|atob\s*\(/, msg: "decodificación y ejecución" },
  { severidad: "MEDIO", regex: /(sendBeacon|fetch\s*\()\s*[^)]*\b(telegram|discord\.com\/api|webhook)/, msg: "exfiltración potencial a webhook" },
  { severidad: "BAJO", regex: /TODO|FIXME|HACK/, msg: "marcas de deuda técnica" },
];
for (const r of reglas) {
  const m = contenido.match(new RegExp(r.regex.source, "gi"));
  if (m) hallazgos.push({ severidad: r.severidad, regla: r.msg, ocurrencias: m.length });
}
const criticos = hallazgos.filter((h) => h.severidad === "CRITICO").length;
return ok({ archivo: nombre, lineas: contenido.split("\n").length, hallazgos, veredicto: criticos > 0 ? "RECHAZAR" : hallazgos.some((h) => h.severidad === "ALTO") ? "REVISAR" : "LIMPIO" });
  }
);

server.tool(
  "scan_install",
  "Escanea un comando de instalación (npx/npm/pip/curl) contra las reglas de riesgo de MarketNow: flags, fuentes, versiones.",
  {
  comando: z.string().describe("Comando de instalación"),
  },
  async (args: any) => {
    const { comando } = args as any;
    const c = comando.toLowerCase();
const riesgo = [];
if (c.includes("curl") && c.includes("|")) riesgo.push("pipe-to-shell");
if (c.includes("npx -y") || c.includes("npx --yes")) riesgo.push("auto-download-sin-confirmar");
if (c.includes("sudo")) riesgo.push("privilege-escalation");
if (c.includes("--force")) riesgo.push("force-install");
if (!/@\d|@latest|#/.test(c) && (c.includes("npm i") || c.includes("npm install"))) riesgo.push("version-no-fijada");
if (c.includes("git+") || c.includes("github.com")) riesgo.push("fuente-git-directa");
const nivel = riesgo.some((r) => r === "pipe-to-shell" || r === "privilege-escalation") ? "dangerous" : riesgo.length >= 2 ? "risky" : riesgo.length === 1 ? "caution" : "safe";
return ok({ comando, nivel, riesgos: riesgo, recomendacion: nivel === "safe" ? "instalable" : "revisar antes de instalar (usa marketnow-trust)" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor sentinel-lite está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "sentinel-lite", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[sentinel-lite] fatal:", e);
  process.exit(1);
});

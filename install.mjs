#!/usr/bin/env node
/**
 * mcp-suite — Instalador multi-cliente
 * Registra los servidores MCP en Claude Desktop, Cursor, Windsurf o Claude Code.
 *
 * Uso:
 *   node install.mjs                        # interactivo
 *   node install.mjs --client claude        # directo
 *   node install.mjs --client cursor --category "MarketNow"
 *   node install.mjs --client claude --only marketnow-search,safe-math
 *   node install.mjs --client claude --remove  # desinstala
 *   node install.mjs --list                 # lista el catálogo
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CATALOG = JSON.parse(readFileSync(join(ROOT, "catalog.json"), "utf8"));
const SERVERS_DIR = join(ROOT, "servers");

const args = process.argv.slice(2);
const flag = (name) => (args.includes("--" + name) ? args[args.indexOf("--" + name) + 1] : null);

const client = flag("client") || "claude";
const onlyCategory = flag("category");
const onlyIds = flag("only")?.split(",").map((s) => s.trim());
const removeMode = args.includes("--remove");
const listMode = args.includes("--list");

// ─── rutas de config por cliente ───
function configPath(c) {
  const home = homedir();
  switch (c) {
    case "claude":
      return process.platform === "win32"
        ? join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json")
        : join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "cursor":
      return join(home, ".cursor", "mcp.json");
    case "windsurf":
      return process.platform === "win32"
        ? join(home, "AppData", "Roaming", "Windsurf", "mcp_config.json")
        : join(home, ".codeium", "windsurf", "mcp_config.json");
    case "claude-code":
      return join(home, ".claude.json");
    default:
      return null;
  }
}

// ─── selección de servidores ───
function seleccion() {
  let list = CATALOG.servers;
  if (onlyCategory) list = list.filter((s) => s.category.toLowerCase() === onlyCategory.toLowerCase());
  if (onlyIds) list = list.filter((s) => onlyIds.includes(s.id));
  return list;
}

// ─── modo lista ───
if (listMode) {
  console.log("\n📚 Catálogo mcp-suite — " + CATALOG.total_servers + " servidores\n");
  for (const [cat, ids] of Object.entries(CATALOG.categories)) {
    console.log("  " + cat + " (" + ids.length + "):");
    for (const id of ids) console.log("    - " + id);
  }
  console.log("\nInstala: node install.mjs --client claude [--category X | --only id1,id2]\n");
  process.exit(0);
}

const servers = seleccion();
if (!servers.length) {
  console.error("Sin servidores que matcheen el filtro. Usa --list para ver el catálogo.");
  process.exit(1);
}

const cfgPath = configPath(client);
if (!cfgPath) {
  console.error("Cliente desconocido: " + client + " (usa claude | cursor | windsurf | claude-code)");
  process.exit(1);
}

console.log("═══════════════════════════════════════════════");
console.log(" mcp-suite installer");
console.log(" cliente: " + client + " · servidores: " + servers.length);
console.log(" config:  " + cfgPath);
console.log("═══════════════════════════════════════════════\n");

// ─── verificar dist compilado ───
const sinDist = servers.filter((s) => !existsSync(join(SERVERS_DIR, "mcp-" + s.id, "dist", "index.js")));
if (sinDist.length) {
  console.log("⚙ Compilando " + sinDist.length + " servidores sin dist/ ...");
  const r = spawnSync("node", [join(ROOT, "tools", "build.mjs")], { stdio: "inherit" });
  if (r.status !== 0) { console.error("✗ build falló"); process.exit(1); }
}

// ─── leer config existente ───
let config = {};
if (existsSync(cfgPath)) {
  try { config = JSON.parse(readFileSync(cfgPath, "utf8")); } catch (e) {
    console.error("✗ La config existente no es JSON válido: " + e.message);
    process.exit(1);
  }
}
const backupPath = cfgPath + ".backup-mcp-suite";
if (existsSync(cfgPath) && !removeMode) {
  copyFileSync(cfgPath, backupPath);
  console.log("✓ backup: " + backupPath + "\n");
}

// Claude Code usa formato plano en .claude.json con clave mcpServers a veces anidada por proyecto;
// para simplicidad usamos la clave mcpServers raíz.
const mcpKey = "mcpServers";
config[mcpKey] = config[mcpKey] || {};

let añadidos = 0, eliminados = 0;
for (const s of servers) {
  const entry = {
    command: "node",
    args: [join(SERVERS_DIR, "mcp-" + s.id, "dist", "index.js")],
  };
  if (removeMode) {
    if (config[mcpKey][s.id]) { delete config[mcpKey][s.id]; eliminados++; }
  } else {
    config[mcpKey][s.id] = entry;
    añadidos++;
  }
}

mkdirSync(dirname(cfgPath), { recursive: true });
writeFileSync(cfgPath, JSON.stringify(config, null, 2));
console.log(removeMode
  ? "✓ " + eliminados + " servidores eliminados de " + client
  : "✓ " + añadidos + " servidores registrados en " + client);
console.log("\nSiguiente paso: reinicia " + (client === "claude" ? "Claude Desktop" : client) + " para que cargue los MCP.");
console.log("Prueba: pregunta 'usa la tool health_check del servidor safe-math'\n");

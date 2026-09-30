#!/usr/bin/env node
/**
 * mcp-suite — Generador de servidores MCP
 * Emite servers/mcp-<id>/{package.json,tsconfig.json,src/index.ts,README.md,data}
 * a partir de specs declarativas en tools/specs/*.mjs
 *
 * Uso: node tools/generator.mjs [--only <id>] [--check]
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SPECS_DIR = join(ROOT, "tools", "specs");
const SERVERS_DIR = join(ROOT, "servers");
const CATALOG_FILE = join(ROOT, "catalog.json");

const args = process.argv.slice(2);
const onlyFlag = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const checkMode = args.includes("--check");

// ---------- validación ----------
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TOOL_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const PARAM_TYPES = new Set(["string", "number", "boolean", "array", "enum", "any"]);

function validateSpecs(all) {
  const errors = [];
  const seenIds = new Set();
  for (const spec of all) {
    if (!spec.id || !ID_RE.test(spec.id) || spec.id.length > 48) errors.push(`id inválido: ${spec.id}`);
    if (seenIds.has(spec.id)) errors.push(`id duplicado: ${spec.id}`);
    seenIds.add(spec.id);
    if (!spec.title) errors.push(`${spec.id}: falta title`);
    if (!spec.tagline) errors.push(`${spec.id}: falta tagline`);
    if (!spec.category) errors.push(`${spec.id}: falta category`);
    if (!spec.pain) errors.push(`${spec.id}: falta pain`);
    if (!Array.isArray(spec.tools) || spec.tools.length === 0) errors.push(`${spec.id}: sin tools`);
    const toolNames = new Set();
    for (const t of spec.tools || []) {
      if (!TOOL_RE.test(t.name)) errors.push(`${spec.id}: tool name inválido ${t.name}`);
      if (toolNames.has(t.name)) errors.push(`${spec.id}: tool duplicado ${t.name}`);
      toolNames.add(t.name);
      if (t.name === "health_check") errors.push(`${spec.id}: health_check está reservado`);
      if (!t.desc) errors.push(`${spec.id}.${t.name}: falta desc`);
      if (!t.code || typeof t.code !== "string") errors.push(`${spec.id}.${t.name}: falta code`);
      for (const [k, v] of Object.entries(t.params || {})) {
        const type = typeof v === "string" ? v : v?.t;
        if (!PARAM_TYPES.has(type)) errors.push(`${spec.id}.${t.name}.${k}: tipo inválido ${type}`);
        if (type === "enum" && (!Array.isArray(v.values) || v.values.length < 2)) errors.push(`${spec.id}.${t.name}.${k}: enum sin values`);
      }
    }
  }
  return errors;
}

// ---------- emisión de código ----------
function zodFor(paramName, p) {
  const type = typeof p === "string" ? p : p.t;
  const d = typeof p === "object" ? p.d : undefined;
  const parts = [];
  switch (type) {
    case "string": parts.push("z.string()"); break;
    case "number": parts.push("z.number()"); break;
    case "boolean": parts.push("z.boolean()"); break;
    case "array": parts.push("z.array(z.any())"); break;
    case "enum": parts.push(`z.enum(${JSON.stringify(p.values)})`); break;
    case "any": parts.push("z.any()"); break;
  }
  if (typeof p === "object" && p.d) parts.push(`.describe(${JSON.stringify(p.d)})`);
  if (typeof p === "object" && p.def !== undefined) parts.push(`.default(${JSON.stringify(p.def)})`);
  else if (typeof p === "object" && p.opt && !p.def) parts.push(".optional()");
  return `  ${paramName}: ${parts.join("")},`;
}

// ---------- fixup de código embebido (TS-safe) ----------
// 1) Object.values/entries sobre `any || {}` infiere unknown[] -> helper tipado
// 2) aritmética number-Date (TS2362/2363) y comparación Date-number (TS2365)
function fixupCode(code) {
  let c = code;
  c = c.replaceAll("Object.values(", "__vals(");
  c = c.replaceAll("Object.entries(", "__ents(");
  c = c.replaceAll("new Map(", "new Map<any, any>(");
  // (?!\s*\.getTime) evita re-aplicar sobre código que ya usa .getTime()
  c = c.replace(/Date\.now\(\)\s*-\s*new Date\(([^()]+)\)(?!\s*\.getTime)/g, (_m, x) => `Date.now() - new Date(${x}).getTime()`);
  c = c.replace(/new Date\(([^()]+)\)\s*-\s*Date\.now\(\)/g, (_m, x) => `new Date(${x}).getTime() - Date.now()`);
  c = c.replace(/new Date\(([^()]+)\)\s*([<>])\s*Date\.now\(\)/g, (_m, x, op) => `new Date(${x}).getTime() ${op} Date.now()`);
  // Date - Date (TS no lo permite aunque JS sí)
  c = c.replace(/new Date\(([^()]+)\)\s*-\s*new Date\(([^()]+)\)/g, (_m, x, y) => `new Date(${x}).getTime() - new Date(${y}).getTime()`);
  return c;
}

function toolRegistration(t, serverId) {
  const paramsKeys = Object.keys(t.params || {});
  const schema = paramsKeys.length
    ? paramsKeys.map((k) => zodFor(k, (t.params || {})[k])).join("\n")
    : "  // sin parámetros";
  const destructure = paramsKeys.length ? `const { ${paramsKeys.join(", ")} } = args as any;` : "";
  return `server.tool(
  ${JSON.stringify(t.name)},
  ${JSON.stringify(t.desc)},
  {
${schema}
  },
  async (args: any) => {
    ${destructure ? destructure + "\n    " : ""}${fixupCode(t.code.trim())}
  }
);`;
}

function emitServerSource(spec) {
  const id = spec.id;
  const imports = [];
  if (spec.needsFetch) { /* fetch es global en Node 18+ */ }
  const fsImports = [];
  const osImports = [];
  const pathImports = [];
  const cryptoImports = [];
  const urlImports = [];
  for (const imp of spec.imports || []) {
    if (imp === "fs") fsImports.push("readFileSync", "writeFileSync", "existsSync", "mkdirSync", "readdirSync", "appendFileSync", "statSync");
    if (imp === "os") osImports.push("homedir", "tmpdir", "cpus", "freemem", "totalmem");
    if (imp === "path") pathImports.push("join");
    if (imp === "crypto") cryptoImports.push("createHash", "createHmac", "randomUUID", "randomBytes", "generateKeyPairSync", "sign", "verify", "createPublicKey", "createPrivateKey", "createSecretKey");
    if (imp === "url") urlImports.push("fileURLToPath");
  }
  if (spec.persistent) { if (!fsImports.length) fsImports.push("readFileSync", "writeFileSync", "existsSync", "mkdirSync"); if (!osImports.includes("homedir")) osImports.push("homedir"); if (!pathImports.includes("join")) pathImports.push("join"); }
  if (spec.usesData) { if (!fsImports.length) fsImports.push("readFileSync", "existsSync"); if (!urlImports.includes("fileURLToPath")) urlImports.push("fileURLToPath"); }

  const importLines = [];
  if (fsImports.length) importLines.push(`import { ${[...new Set(fsImports)].join(", ")} } from "node:fs";`);
  if (osImports.length) importLines.push(`import { ${[...new Set(osImports)].join(", ")} } from "node:os";`);
  if (pathImports.length) importLines.push(`import { ${[...new Set(pathImports)].join(", ")} } from "node:path";`);
  if (cryptoImports.length) importLines.push(`import { ${[...new Set(cryptoImports)].join(", ")} } from "node:crypto";`);
  if (urlImports.length) importLines.push(`import { ${[...new Set(urlImports)].join(", ")} } from "node:url";`);

  const helperSections = [];

  helperSections.push(`// ——— helpers de respuesta ———
function ok(data: any) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg: any) {
  return { content: [{ type: "text" as const, text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true as const };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o: any): any[] { return Object.values(o); }
function __ents(o: any): [string, any][] { return Object.entries(o); }`);

  if (spec.persistent) {
    helperSections.push(`// ——— persistencia local: ~/.mcp-suite/${id}/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", ${JSON.stringify(id)});
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
};`);
  }

  if (spec.needsFetch) {
    helperSections.push(`// ——— fetch inteligente: timeout + reintentos ———
async function fetchSmart(url: string, opts: any = {}): Promise<{ status: number; text: string; json: any }> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  let lastError: any = null;
  for (let attempt = 0; attempt <= (opts.retries ?? 2); attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: opts.method || "GET",
        headers: { "user-agent": "mcp-suite/${id}", ...(opts.headers || {}) },
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
}`);
  }

  if (spec.usesData) {
    helperSections.push(`// ——— datos embebidos (carpeta data/) ———
function loadData(name: string): any {
  const p = fileURLToPath(new URL("../data/" + name, import.meta.url));
  return JSON.parse(readFileSync(p, "utf8"));
}`);
  }

  if (spec.prelude) helperSections.push(`// ——— estado/preludio específico ———\n${spec.prelude.trim()}`);

  const toolRegs = spec.tools.map((t) => toolRegistration(t, id)).join("\n\n");

  const toolCount = spec.tools.length + 1;

  return `#!/usr/bin/env node
/**
 * MCP Server: ${spec.title}
 * ${spec.tagline}
 *
 * Dolor que resuelve: ${spec.pain}
 * Categoría: ${spec.category} | Generado por mcp-suite | id: ${id}
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
${importLines.join("\n")}

${helperSections.join("\n\n")}

const server = new McpServer({ name: ${JSON.stringify(id)}, version: "1.0.0" });

${toolRegs}

server.tool(
  "health_check",
  "Verifica que el servidor ${id} está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: ${JSON.stringify(id)}, tools: ${toolCount}, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[${id}] fatal:", e);
  process.exit(1);
});
`;
}

function emitPackageJson(spec) {
  return JSON.stringify({
    name: `@mcp-suite/${spec.id}`,
    version: "1.0.0",
    description: `${spec.title} — ${spec.tagline} (MCP server stdio)`,
    type: "module",
    main: "dist/index.js",
    bin: { [`mcp-${spec.id}`]: "dist/index.js" },
    scripts: { build: "tsc -p ." },
    keywords: ["mcp", "model-context-protocol", "ai-agent", spec.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")],
    license: "MIT",
    mcp: { transport: "stdio", tools: spec.tools.length + 1 },
    dependencies: { "@modelcontextprotocol/sdk": "^1.30.0", zod: "^4.0.0" },
  }, null, 2) + "\n";
}

function emitTsconfig() {
  return JSON.stringify({
    extends: "../../tsconfig.base.json",
    compilerOptions: { outDir: "dist", rootDir: "src" },
    include: ["src/**/*"],
  }, null, 2) + "\n";
}

function emitReadme(spec) {
  const toolsMd = spec.tools.map((t) => {
    const paramsMd = Object.entries(t.params || {}).map(([k, v]) => {
      const type = typeof v === "string" ? v : v.t;
      const d = typeof v === "object" ? v.d || "" : "";
      const opt = typeof v === "object" && (v.opt || v.def !== undefined) ? "opcional" : "requerido";
      return `  - \`${k}\` (${type}, ${opt}): ${d}`;
    }).join("\n");
    return `### \`${t.name}\`\n${t.desc}${paramsMd ? "\n\n**Parámetros:**\n" + paramsMd : ""}`;
  }).join("\n\n");

  const dataNote = spec.usesData ? `\n> Este servidor incluye datos embebidos en \`data/\` (no requiere conexión para operar).\n` : "";
  const fetchNote = spec.needsFetch ? `\n> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.\n` : "";
  const storeNote = spec.persistent ? `\n> Estado persistente en \`~/.mcp-suite/${spec.id}/state.json\` (local, privado, tuya la data).\n` : "";

  return `# ${spec.title}

> ${spec.tagline}

**Categoría:** ${spec.category} · **ID:** \`mcp-${spec.id}\`

**Dolor de agente que resuelve:** ${spec.pain}
${dataNote}${fetchNote}${storeNote}
## Tools (${spec.tools.length + 1} incl. health_check)

${toolsMd}

## Instalación — Claude Desktop

\`\`\`json
{
  "mcpServers": {
    "${spec.id}": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-${spec.id}/dist/index.js"]
    }
  }
}
\`\`\`

Cursor / Cline / Continue: misma configuración stdio (\`command: node\`).

## Notas técnicas

${spec.notes || "Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado."}
`;
}

// ---------- carga de specs ----------
async function loadSpecs() {
  const files = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".mjs")).sort();
  const all = [];
  for (const f of files) {
    const mod = await import(join(SPECS_DIR, f));
    const arr = mod.default || mod.specs || [];
    for (const s of arr) all.push({ __file: f, ...s });
  }
  return all;
}

// ---------- main ----------
const specs = await loadSpecs();
const errors = validateSpecs(specs);
if (errors.length) {
  console.error("❌ Errores de validación:");
  for (const e of errors) console.error("  -", e);
  process.exit(1);
}

console.log(`✔ ${specs.length} specs cargadas, 0 errores de validación`);
if (checkMode) {
  const byCat = {};
  for (const s of specs) byCat[s.category] = (byCat[s.category] || 0) + 1;
  console.table(byCat);
  process.exit(0);
}

const target = onlyFlag ? specs.filter((s) => s.id === onlyFlag) : specs;
if (onlyFlag && !target.length) { console.error(`no existe spec: ${onlyFlag}`); process.exit(1); }

const catalog = { generated_at: new Date().toISOString(), total_servers: specs.length, categories: {}, servers: [] };

for (const spec of specs) {
  const dir = join(SERVERS_DIR, `mcp-${spec.id}`);
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "data"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), emitServerSource(spec));
  writeFileSync(join(dir, "package.json"), emitPackageJson(spec));
  writeFileSync(join(dir, "tsconfig.json"), emitTsconfig());
  writeFileSync(join(dir, "README.md"), emitReadme(spec));

  if (spec.usesData) {
    for (const [name, src] of Object.entries(spec.usesData)) {
      if (existsSync(src)) { copyFileSync(src, join(dir, "data", name)); }
      else console.warn(`⚠ ${spec.id}: data no encontrada ${src}`);
    }
  }

  catalog.categories[spec.category] = catalog.categories[spec.category] || [];
  catalog.categories[spec.category].push(spec.id);
  catalog.servers.push({
    id: spec.id, dir: `servers/mcp-${spec.id}`, title: spec.title, tagline: spec.tagline,
    category: spec.category, pain: spec.pain,
    tools: spec.tools.map((t) => ({ name: t.name, desc: t.desc })),
    persistent: !!spec.persistent, needs_fetch: !!spec.needsFetch, has_data: !!spec.usesData,
  });
}

writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
console.log(`✔ generados ${target.length}/${specs.length} servidores en servers/`);
const totalTools = specs.reduce((acc, s) => acc + s.tools.length + 1, 0);
console.log(`✔ total tools (incl. health_check): ${totalTools}`);
console.log(`✔ catálogo: catalog.json (${Object.keys(catalog.categories).length} categorías)`);

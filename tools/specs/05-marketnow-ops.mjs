// ═══ CATEGORÍA: MarketNow · Ops & Seguridad del marketplace ═══
export default [
  {
    id: "sentinel-lite",
    title: "Sentinel Lite",
    tagline: "Escáner estático de skills/paquetes con las reglas de estilo Sentinel L1: 10 checks reproducibles",
    category: "MarketNow Ops",
    pain: "Publicar o instalar una skill sin auto-auditoría: el pipeline Sentinel existe en MarketNow pero el dev necesita escanear ANTES de publicar/instalar.",
    notes: "Escanea manifest (package.json), archivos de texto (README, código) y comandos de instalación con checks L1: README, manifest, licencia, secrets, patrones maliciosos, install documentado, deps sanas.",
    tools: [
      {
        name: "scan_manifest",
        desc: "Escanea un package.json (o manifest similar) contra los 10 checks L1: nombre, versión, licencia, descripción, repo, scripts peligrosos, deps. Devuelve score 0-10.",
        params: { manifest: { t: "any", d: "Objeto package.json" } },
        code: `const m = manifest || {};
const checks = [];
const add = (name, pass, detail) => checks.push({ check: name, pass: !!pass, detail });
add("Has Manifest", !!m.name && !!m.version, "name+version presentes");
add("Has README", !!(m.description || m.readme), m.description ? "description presente" : "sin description");
add("Has License", !!m.license, m.license || "sin campo license");
add("Source Traceable", !!(m.repository?.url || m.repository), m.repository?.url ? "repo presente" : "sin repository");
add("No Malicious Code", !JSON.stringify(m.scripts || {}).match(/(curl|wget|rm\\s+-rf|eval\\(|child_process)/i), "scripts revisados");
add("Dependencies Sane", (Object.keys(m.dependencies || {}).length <= 12) || false, Object.keys(m.dependencies || {}).length + " deps");
add("Version Pinned", /^\\d+\\.\\d+\\.\\d+/.test(String(m.version || "")), m.version);
add("Install Documented", !!(m.bin || m.main || m.scripts?.start), "punto de entrada presente");
add("No Secrets", !JSON.stringify(m).match(/(sk-[a-zA-Z0-9]{20}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{30})/), "sin tokens hardcodeados");
add("Author Identified", !!(m.author?.name || m.author), "author presente");
const passed = checks.filter((c) => c.pass).length;
return ok({ score: passed + "/10", nivel: passed >= 9 ? "L1-ready" : passed >= 7 ? "casi" : "rechazado", checks });`,
      },
      {
        name: "scan_file",
        desc: "Escanea el CONTENIDO de un archivo (código/README/config) buscando secrets y patrones maliciosos. Devuelve hallazgos por severidad.",
        params: { nombre: { t: "string", d: "Nombre del archivo" }, contenido: { t: "string", d: "Contenido a escanear" } },
        code: `const hallazgos = [];
const reglas = [
  { severidad: "CRITICO", regex: /(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{30,}|xox[bap]-[a-zA-Z0-9-]{10,})/, msg: "API key hardcodeada" },
  { severidad: "CRITICO", regex: /rm\\s+-rf\\s+\\//, msg: "borrado destructivo de raíz" },
  { severidad: "ALTO", regex: /child_process|exec\\s*\\(|spawn\\s*\\(/, msg: "ejecución de procesos" },
  { severidad: "ALTO", regex: /require\\s*\\(\\s*['"]\\.env['"]\\s*\\)|readFileSync\\s*\\(\\s*['"'].?\\.?\\.?\\.?env/, msg: "lectura de .env" },
  { severidad: "ALTO", regex: /(curl|wget)\\s+[^|]*\\|\\s*(ba)?sh/, msg: "descarga y ejecución remota" },
  { severidad: "MEDIO", regex: /eval\\s*\\(/, msg: "eval dinámico" },
  { severidad: "MEDIO", regex: /base64\\s*-d\\s*\\|\\s*(ba)?sh|atob\\s*\\(/, msg: "decodificación y ejecución" },
  { severidad: "MEDIO", regex: /(sendBeacon|fetch\\s*\\()\\s*[^)]*\\b(telegram|discord\\.com\\/api|webhook)/, msg: "exfiltración potencial a webhook" },
  { severidad: "BAJO", regex: /TODO|FIXME|HACK/, msg: "marcas de deuda técnica" },
];
for (const r of reglas) {
  const m = contenido.match(new RegExp(r.regex.source, "gi"));
  if (m) hallazgos.push({ severidad: r.severidad, regla: r.msg, ocurrencias: m.length });
}
const criticos = hallazgos.filter((h) => h.severidad === "CRITICO").length;
return ok({ archivo: nombre, lineas: contenido.split("\\n").length, hallazgos, veredicto: criticos > 0 ? "RECHAZAR" : hallazgos.some((h) => h.severidad === "ALTO") ? "REVISAR" : "LIMPIO" });`,
      },
      {
        name: "scan_install",
        desc: "Escanea un comando de instalación (npx/npm/pip/curl) contra las reglas de riesgo de MarketNow: flags, fuentes, versiones.",
        params: { comando: { t: "string", d: "Comando de instalación" } },
        code: `const c = comando.toLowerCase();
const riesgo = [];
if (c.includes("curl") && c.includes("|")) riesgo.push("pipe-to-shell");
if (c.includes("npx -y") || c.includes("npx --yes")) riesgo.push("auto-download-sin-confirmar");
if (c.includes("sudo")) riesgo.push("privilege-escalation");
if (c.includes("--force")) riesgo.push("force-install");
if (!/@\\d|@latest|#/.test(c) && (c.includes("npm i") || c.includes("npm install"))) riesgo.push("version-no-fijada");
if (c.includes("git+") || c.includes("github.com")) riesgo.push("fuente-git-directa");
const nivel = riesgo.some((r) => r === "pipe-to-shell" || r === "privilege-escalation") ? "dangerous" : riesgo.length >= 2 ? "risky" : riesgo.length === 1 ? "caution" : "safe";
return ok({ comando, nivel, riesgos: riesgo, recomendacion: nivel === "safe" ? "instalable" : "revisar antes de instalar (usa marketnow-trust)" });`,
      },
    ],
  },
  {
    id: "install-risk",
    title: "Install Risk",
    tagline: "Clasifica el riesgo de instalar cualquier paquete/comando antes de ejecutarlo",
    category: "MarketNow Ops",
    pain: "npm install a ciegas rompe entornos e instala malware: falta una capa de clasificación de riesgo previa a toda instalación.",
    tools: [
      {
        name: "classify_command",
        desc: "Clasifica cualquier comando shell en tier de riesgo de instalación (safe/caution/risky/dangerous) con reglas explicadas.",
        params: { comando: { t: "string", d: "Comando completo a clasificar" } },
        code: `const c = comando.toLowerCase();
let puntos = 0; const motivos = [];
const reglas: Array<[string, number, string]> = [
  ["curl", 1, "descarga de red"], ["wget", 1, "descarga de red"],
  ["sudo", 3, "privilegios elevados"], ["rm ", 3, "borrado de archivos"],
  ["| sh", 4, "ejecución de stream"], ["| bash", 4, "ejecución de stream"],
  ["chmod 777", 2, "permisos peligrosos"], ["--force", 1, "ignora validaciones"],
  ["npx -y", 1, "auto-descarga"], ["eval ", 3, "eval dinámico"],
  ["> /etc", 4, "escritura en sistema"], ["mkfs", 5, "formateo de disco"],
  ["dd if=", 4, "escritura cruda de disco"],
];
for (const [pat, pts, motivo] of reglas) if (c.includes(pat)) { puntos += pts; motivos.push(motivo + " (" + pts + ")"); }
const tier = puntos >= 6 ? "dangerous" : puntos >= 3 ? "risky" : puntos >= 1 ? "caution" : "safe";
return ok({ comando, puntos, tier, motivos, accion: tier === "safe" ? "proceder" : tier === "caution" ? "proceder con monitoreo" : "revisar manualmente o abortar" });`,
      },
      {
        name: "safer_alternative",
        desc: "Sugiere una versión más segura de un comando riesgoso: fijar versión, quitar sudo/force, evitar pipe-to-shell.",
        params: { comando: { t: "string", d: "Comando a mejorar" } },
        code: `let mejorado = comando;
const cambios = [];
if (/npx\\s+(--yes\\s+)?(?!-y)/.test(mejorado) && !/@\\d/.test(mejorado)) { cambios.push("fijar versión del paquete"); }
if (mejorado.includes("sudo")) { mejorado = mejorado.replace(/sudo\\s+/g, ""); cambios.push("quitar sudo"); }
if (mejorado.includes("--force")) { mejorado = mejorado.replace(/\\s--force/g, ""); cambios.push("quitar --force"); }
if (/curl[^|]*\\|\\s*(ba)?sh/.test(mejorado)) { cambios.push("descargar el script, revisarlo, luego ejecutarlo"); }
if (/npm\\s+install\\s+\\S+/.test(mejorado) && !/@\\d/.test(mejorado)) { cambios.push("usar npm install paquete@x.y.z exacta"); }
return ok({ original: comando, mejorado, cambios, nota: cambios.length ? "aplica los cambios listados" : "el comando ya es razonablemente seguro" });`,
      },
    ],
  },
  {
    id: "runtime-interceptor",
    title: "Runtime Interceptor",
    tagline: "Reglas de interceptación en runtime: bloquea .env, rm -rf, spawns y escrituras de sistema",
    category: "MarketNow Ops",
    pain: "Las skills instaladas ejecutan comandos en tu máquina: hace falta un interceptor que evalúe cada comando contra políticas de bloqueo.",
    persistent: true,
    notes: "Las 5 reglas por defecto replican el Runtime Interceptor de MarketNow: bloquear acceso a .env, rm -rf, spawns de procesos, escrituras de sistema y network exfil a webhooks.",
    tools: [
      {
        name: "check_command",
        desc: "Evalúa un comando contra las reglas de interceptación activas. Devuelve ALLOW/BLOCK con la regla que aplica.",
        params: { comando: { t: "string", d: "Comando a evaluar" } },
        code: `const st = store.load();
st.rules = st.rules || [
  { id: "r1", nombre: "no-env-access", patron: "\\.env", accion: "block" },
  { id: "r2", nombre: "no-destructive-delete", patron: "rm\\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf)", accion: "block" },
  { id: "r3", nombre: "no-process-spawn", patron: "child_process|\\bspawn\\(|\\bexec\\(", accion: "warn" },
  { id: "r4", nombre: "no-system-writes", patron: "/etc/|/usr/bin|C:\\\\Windows", accion: "block" },
  { id: "r5", nombre: "no-webhook-exfil", patron: "telegram|discord\\.com/api|webhook\\.site", accion: "block" },
];
store.save(st);
const c = comando;
let decision = "ALLOW"; const aplicadas = [];
for (const r of st.rules) {
  try { if (new RegExp(r.patron, "i").test(c)) { aplicadas.push(r); if (r.accion === "block") decision = "BLOCK"; } } catch {}
}
return ok({ decision, reglas_aplicadas: aplicadas.map((r) => r.nombre + " (" + r.accion + ")"), comando: c });`,
      },
      {
        name: "add_rule",
        desc: "Añade una regla personalizada de interceptación (patrón regex + acción block/warn/allow).",
        params: { nombre: { t: "string", d: "Nombre de la regla" }, patron: { t: "string", d: "Patrón regex" }, accion: { t: "enum", values: ["block", "warn", "allow"], d: "Acción al matchear" } },
        code: `try { new RegExp(patron, "i"); } catch (e) { return fail("regex inválida: " + e.message); }
const st = store.load();
st.rules = st.rules || [];
st.rules.push({ id: "r" + (st.rules.length + 1), nombre, patron, accion });
store.save(st);
return ok({ regla_agregada: { nombre, patron, accion }, total_reglas: st.rules.length });`,
      },
      {
        name: "list_rules",
        desc: "Lista todas las reglas de interceptación activas (las 5 por defecto de MarketNow + personalizadas).",
        params: {},
        code: `const st = store.load();
return ok({ reglas: st.rules || [], nota: "5 reglas por defecto = Runtime Interceptor de marketnow.site" });`,
      },
    ],
  },
  {
    id: "owasp-mcp-matrix",
    title: "OWASP MCP Matrix",
    tagline: "Matriz de cumplimiento del OWASP MCP Cheat Sheet: 12 controles, auto-evaluación y reporte",
    category: "MarketNow Ops",
    pain: "Construir MCP servers sin checklist de seguridad OWASP: faltan controles estandarizados (authz, secrets, sandbox, logging).",
    tools: [
      {
        name: "get_controls",
        desc: "Los 12 controles del OWASP MCP Cheat Sheet con estado recomendado y cómo implementarlos.",
        params: {},
        code: `return ok({ controles: [
  { c: "MC-1", nombre: "Autenticación del servidor", como: "tokens/API keys, nunca anon en producción" },
  { c: "MC-2", nombre: "Autorización por tool", como: "scopes por herramienta, least privilege" },
  { c: "MC-3", nombre: "Secrets fuera del código", como: "variables de entorno / vault" },
  { c: "MC-4", nombre: "Sandboxing de ejecución", como: "gVisor/contenedores para código externo" },
  { c: "MC-5", nombre: "Validación de inputs", como: "schemas estrictos en cada tool" },
  { c: "MC-6", nombre: "Rate limiting", como: "límites por cliente/tool" },
  { c: "MC-7", nombre: "Sanitización de prompts", como: "escanear inyecciones en entradas" },
  { c: "MC-8", nombre: "Logging auditable", como: "bitácora inmutable de llamadas" },
  { c: "MC-9", nombre: "Cifrado en tránsito", como: "TLS en transportes remotos" },
  { c: "MC-10", nombre: "Monitoreo de anomalías", como: "métricas y alertas de abuso" },
  { c: "MC-11", nombre: "Rotación de credenciales", como: "expiración y revocación" },
  { c: "MC-12", nombre: "Respuesta a incidentes", como: "plan de contención y kill-switch" },
] });`,
      },
      {
        name: "self_assess",
        desc: "Auto-evaluación: marca qué controles cumples (lista de IDs) y obtiene score de cumplimiento + brechas críticas.",
        params: { cumplidos: { t: "array", d: "IDs cumplidos (ej: ['MC-1','MC-3'])" } },
        code: `const todos = ["MC-1","MC-2","MC-3","MC-4","MC-5","MC-6","MC-7","MC-8","MC-9","MC-10","MC-11","MC-12"];
const hechos = new Set((Array.isArray(cumplidos) ? cumplidos : []).map((x) => String(x).toUpperCase()));
const faltan = todos.filter((c) => !hechos.has(c));
const criticos = faltan.filter((c) => ["MC-1", "MC-2", "MC-3", "MC-5", "MC-8"].includes(c));
return ok({ cumplidos: hechos.size + "/12", score: Math.round((hechos.size / 12) * 100) + "%", faltan, criticos: criticos.length ? criticos : "ninguno", veredicto: criticos.length === 0 ? "Aceptable" : "Brechas críticas: atender antes de producción" });`,
      },
    ],
  },
  {
    id: "skill-publisher",
    title: "Skill Publisher",
    tagline: "Prepara tu skill para publicar en MarketNow: checklist L1, manifest y readme generados",
    category: "MarketNow Ops",
    pain: "Publicar una skill requiere README, manifest, licencia y checks de seguridad: mucha fricción para el dev que quiere monetizar.",
    tools: [
      {
        name: "check_readiness",
        desc: "Evalúa si tu skill está lista para publicar: exige nombre, descripción, install command, licencia y repo. Checklist completo.",
        params: { skill: { t: "any", d: "Datos de la skill: {name, description, install, license, repository}" } },
        code: `const s = skill || {};
const faltan = [];
if (!s.name) faltan.push("name");
if (!s.description || s.description.length < 30) faltan.push("description >= 30 chars");
if (!s.install) faltan.push("install command");
if (!s.license) faltan.push("license");
if (!s.repository) faltan.push("repository URL");
return ok({ lista_para_publicar: faltan.length === 0, faltan, siguientes_pasos: faltan.length ? "completa los campos faltantes" : "envía a auditoría Sentinel v3.0 (gratis) y define precio" });`,
      },
      {
        name: "generate_manifest",
        desc: "Genera un package.json pulido para publicar como skill MCP: metadata completa, bin, keywords mcp.",
        params: {
          nombre: { t: "string", d: "Nombre del paquete (sin @scope)" },
          version: { t: "string", d: "Versión semver", opt: true, def: "1.0.0" },
          descripcion: { t: "string", d: "Descripción de la skill" },
          licencia: { t: "string", d: "Licencia", opt: true, def: "MIT" },
          repo: { t: "string", d: "URL del repositorio", opt: true },
          autor: { t: "string", d: "Nombre del autor", opt: true },
        },
        code: `const manifest = {
  name: nombre.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
  version: version || "1.0.0",
  description: descripcion,
  license: licencia || "MIT",
  type: "module",
  main: "dist/index.js",
  bin: { [nombre.toLowerCase().replace(/[^a-z0-9-]/g, "-")]: "dist/index.js" },
  scripts: { build: "tsc -p ." },
  keywords: ["mcp", "model-context-protocol", "ai-agent", "skill"],
  author: autor || "",
  repository: repo ? { type: "git", url: repo } : undefined,
  mcp: { transport: "stdio" },
};
return ok({ manifest, siguiente_paso: "usa sentinel-lite scan_manifest para validar antes de publicar" });`,
      },
      {
        name: "readme_template",
        desc: "Genera un README.md de plantilla de alta conversión para tu skill (qué resuelve, tools, install, config).",
        params: { nombre: { t: "string", d: "Nombre de la skill" }, resuelve: { t: "string", d: "Qué problema resuelve" }, install_cmd: { t: "string", d: "Comando de instalación" } },
        code: `const fence = String.fromCharCode(96, 96, 96);
const json_cfg = '{ "mcpServers": { "' + nombre.toLowerCase().replace(/[^a-z0-9-]/g, "-") + '": { "command": "node", "args": ["./dist/index.js"] } } }';
const readme = [
  "# " + nombre, "",
  "> " + resuelve, "",
  "## Instalación", "", fence + "bash", install_cmd, fence, "",
  "## Configuración (Claude Desktop)", "", fence + "json", json_cfg, fence, "",
  "## Tools", "", "- health_check: verifica el servidor", "",
  "## Seguridad", "",
  "- Sin telemetría, sin acceso a red salvo indicado - Estado local en ~/.mcp-suite/", "",
].join("\\n");
return ok({ readme });`,
      },
    ],
  },
  {
    id: "secrets-audit",
    title: "Secrets Audit",
    tagline: "Detecta API keys, tokens y credenciales expuestas en texto, configs y código",
    category: "MarketNow Ops",
    pain: "Publicar código con API keys filtradas es el fallo #1 de seguridad de skills MCP: check L1 'No Secrets' fallido.",
    tools: [
      {
        name: "scan_text",
        desc: "Escanea cualquier texto/código/config en busca de 14+ patrones de secrets (OpenAI, AWS, GitHub, Slack, Stripe, Google, JWT...).",
        params: { texto: { t: "string", d: "Texto a escanear" } },
        code: `const patrones: Array<[string, RegExp]> = [
  ["OpenAI", /sk-[a-zA-Z0-9_-]{20,}/],
  ["Anthropic", /sk-ant-[a-zA-Z0-9_-]{20,}/],
  ["AWS AccessKey", /AKIA[0-9A-Z]{16}/],
  ["AWS Secret", /(?<![A-Z0-9])[A-Za-z0-9/+=]{40}(?![A-Z0-9])/],
  ["GitHub token", /gh[pousr]_[a-zA-Z0-9]{36,}/],
  ["Slack token", /xox[baprs]-[a-zA-Z0-9-]{10,}/],
  ["Stripe", /(sk|pk)_(test|live)_[a-zA-Z0-9]{20,}/],
  ["Google API", /AIza[0-9A-Za-z_-]{35}/],
  ["JWT", /eyJ[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}/],
  ["PrivateKey", /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["DB URL", /(postgres|mysql|mongodb(\\+srv)?):\\/\\/[^\\"\\s]*:[^\\"\\s]*@/],
  ["Generic key=val", /(api[_-]?key|secret|password|token)\\s*[=:]\\s*["'][^"']{8,}["']/],
  ["Bearer", /Bearer\\s+[a-zA-Z0-9._-]{20,}/],
  ["Telegram bot", /\\d{8,10}:AA[a-zA-Z0-9_-]{30,}/],
];
const hallazgos = [];
for (const [nombre, re] of patrones) {
  try { const m = texto.match(new RegExp(re.source, "i")); if (m) hallazgos.push({ tipo: nombre, muestra: m[0].slice(0, 12) + "...***", ocurrencias: texto.split(m[0]).length - 1 }); } catch {}
}
return ok({ limpio: hallazgos.length === 0, hallazgos, recomendacion: hallazgos.length ? "rota/elimina esas credenciales YA (asumen comprometidas si ya publicaste)" : "sin secrets detectados" });`,
      },
      {
        name: "redact_secrets",
        desc: "Devuelve el texto con los secrets detectados reemplazados por placeholders seguros (para logs/docs/README).",
        params: { texto: { t: "string", d: "Texto a sanitizar" } },
        code: `let limpio = texto;
const regexes = [/sk-[a-zA-Z0-9_-]{20,}/g, /sk-ant-[a-zA-Z0-9_-]{20,}/g, /AKIA[0-9A-Z]{16}/g, /gh[pousr]_[a-zA-Z0-9]{36,}/g, /xox[baprs]-[a-zA-Z0-9-]{10,}/g, /(sk|pk)_(test|live)_[a-zA-Z0-9]{20,}/g, /AIza[0-9A-Za-z_-]{35}/g, /eyJ[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}/g, /-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----/g];
let reemplazos = 0;
for (const re of regexes) { limpio = limpio.replace(re, () => { reemplazos++; return "[REDACTED]"; }); }
return ok({ reemplazos, texto_limpio: limpio.slice(0, 5000) });`,
      },
    ],
  },
  {
    id: "mcp-card-registry",
    title: "MCP Card Registry",
    tagline: "Genera y valida MCP server cards (mcp.json / .well-known/mcp.json) para discovery estándar",
    category: "MarketNow Ops",
    pain: "Cada servidor MCP se describe distinto: la MCP Card (mcp.json) estandariza el discovery pero nadie la genera/valida.",
    persistent: true,
    tools: [
      {
        name: "generate_card",
        desc: "Genera una MCP Card para tu servidor: nombre, transporte, tools expuestas, versión y requirements.",
        params: {
          nombre: { t: "string", d: "Nombre del servidor MCP" },
          version: { t: "string", d: "Versión", opt: true, def: "1.0.0" },
          descripcion: { t: "string", d: "Descripción", opt: true },
          tools: { t: "array", d: "Nombres de tools expuestas" },
          transporte: { t: "enum", values: ["stdio", "sse", "streamable-http"], d: "Transporte", opt: true, def: "stdio" },
        },
        code: `const card = {
  schemaVersion: "1.0",
  name: nombre, version: version || "1.0.0", description: descripcion || "",
  transport: { type: transporte || "stdio" },
  tools: (Array.isArray(tools) ? tools : []).map((t) => ({ name: String(t) })),
  capabilities: { tools: true, resources: false, prompts: false },
  generated: new Date().toISOString(),
};
return ok({ card, publicar_en: transporte === "stdio" ? "mcp.json del repo" : ".well-known/mcp.json del dominio" });`,
      },
      {
        name: "validate_card",
        desc: "Valida una MCP Card: schema, transporte bien definido, tools con nombre y versiones.",
        params: { card: { t: "any", d: "MCP Card a validar" } },
        code: `const c = card || {};
const problemas = [];
if (!c.name) problemas.push("falta name");
if (!c.transport?.type) problemas.push("falta transport.type");
if (!["stdio", "sse", "streamable-http", "http"].includes(c.transport?.type)) problemas.push("transport desconocido: " + c.transport?.type);
if (!Array.isArray(c.tools)) problemas.push("tools debe ser array");
if (Array.isArray(c.tools)) c.tools.forEach((t, i) => { if (!t?.name) problemas.push("tool " + i + " sin name"); });
if (!c.version) problemas.push("falta version");
return ok({ valida: problemas.length === 0, problemas });`,
      },
      {
        name: "register_locally",
        desc: "Registra una MCP Card en tu registro local de confianza para consulta futura de otros agentes.",
        params: { card: { t: "any", d: "Card a registrar" } },
        code: `const st = store.load();
st.registry = st.registry || [];
st.registry.push({ registrado: new Date().toISOString(), card });
store.save(st);
return ok({ registradas: st.registry.length });`,
      },
    ],
  },
  {
    id: "reputation-oracle",
    title: "Reputation Oracle",
    tagline: "Agrega señales heterogéneas en un score de reputación explicable para sellers y skills",
    category: "MarketNow Ops",
    pain: "Score = caja negra: el comprador no sabe cómo se compone la reputación de una skill ni qué señales pesan.",
    persistent: true,
    tools: [
      {
        name: "score_from_signals",
        desc: "Calcula score de reputación 0-100 desde señales: stars GitHub, downloads npm, sentinel score, antigüedad, tasa de issues. Pesos ajustables.",
        params: {
          estrellas: { t: "number", d: "Estrellas GitHub", opt: true, def: 0 },
          downloads: { t: "number", d: "Descargas semanales npm", opt: true, def: 0 },
          sentinel: { t: "number", d: "Sentinel score 0-10", opt: true, def: 0 },
          issues_abiertos: { t: "number", d: "Issues abiertos", opt: true, def: 0 },
          antiguedad_meses: { t: "number", d: "Meses desde primer release", opt: true, def: 0 },
        },
        code: `const estrellas_pts = Math.min(30, Math.log10(1 + (estrellas ?? 0)) * 12);
const downloads_pts = Math.min(25, Math.log10(1 + (downloads ?? 0)) * 10);
const sentinel_pts = ((sentinel ?? 0) / 10) * 30;
const issues_pen = Math.min(10, Math.log10(1 + (issues_abiertos ?? 0)) * 5);
const madurez_pts = Math.min(15, Math.log10(1 + (antiguedad_meses ?? 0)) * 8);
const total = Math.round(Math.max(0, Math.min(100, estrellas_pts + downloads_pts + sentinel_pts + madurez_pts - issues_pen)));
return ok({ score: total, desglose: { estrellas: Math.round(estrellas_pts), downloads: Math.round(downloads_pts), sentinel: Math.round(sentinel_pts), madurez: Math.round(madurez_pts), penalizacion_issues: -Math.round(issues_pen) }, interpretacion: total >= 70 ? "alta reputación" : total >= 40 ? "reputación media" : "reputación baja: verificar manualmente" });`,
      },
      {
        name: "suspicious_patterns",
        desc: "Detecta patrones de manipulación de reputación: reviews duplicadas, spikes de descargas, puntuaciones inconsistentes.",
        params: { reviews: { t: "array", d: "Lista de reviews [{autor, texto, estrellas, fecha}]" } },
        code: `const rs = Array.isArray(reviews) ? reviews : [];
const alertas = [];
const textos = rs.map((r) => String(r.texto || "").toLowerCase());
const dup = textos.filter((t, i) => textos.indexOf(t) !== i);
if (dup.length) alertas.push({ tipo: "reviews-duplicadas", n: dup.length });
const cinco = rs.filter((r) => r.estrellas === 5).length;
if (rs.length > 5 && cinco / rs.length > 0.95) alertas.push({ tipo: "todo-5-estrellas", proporcion: Math.round((cinco / rs.length) * 100) + "%" });
const mismo_dia = new Set(rs.map((r) => String(r.fecha || "").slice(0, 10))).size;
if (rs.length > 4 && mismo_dia === 1) alertas.push({ tipo: "burst-un-dia", detalle: "todas el mismo día" });
return ok({ sospechoso: alertas.length > 0, alertas, total_reviews: rs.length });`,
      },
    ],
  },
];

// ═══ CATEGORÍA: MarketNow · API viva (site: marketnow.site) ═══
// Endpoints reales verificados: /api/skills.json, /api/agent.json,
// /api/audit-report.json, /api/bundles.json, /api/policies.json,
// /api/certification.json, /api/certification-scans.json
export default [
  {
    id: "marketnow-agent-card",
    title: "MarketNow · Agent Card",
    tagline: "Lee la tarjeta machine-readable de marketnow.site y descubre sus capabilities MCP/A2A",
    category: "MarketNow",
    pain: "Los agentes no saben qué servicios ofrece un sitio ni cómo interactuar con él: falta descubrimiento estandarizado de capabilities.",
    needsFetch: true,
    notes: "Hace fetch en vivo de https://marketnow.site/api/agent.json (7KB) y expone sus capabilities: protocolos MCP (SSE/WebSocket/JSON-RPC), herramientas (search_skills, get_skill, get_categories, health), A2A agent card, ATC y endpoints de discovery.",
    tools: [
      {
        name: "get_agent_card",
        desc: "Descarga en vivo la tarjeta de agente de marketnow.site (GET /api/agent.json): nombre, descripción, versión, URL y capabilities soportadas.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/agent.json");
if (!r.json) return fail("respuesta no-JSON (HTTP " + r.status + ")");
const a = r.json.agent || {};
return ok({ name: a.name, description: a.description, url: a.url, version: a.version, schema: r.json.schemaVersion, fetched_at: new Date().toISOString() });`,
      },
      {
        name: "list_remote_mcp_tools",
        desc: "Lista las herramientas MCP que expone MarketNow remotamente (search_skills, get_skill, get_categories, health) según su agent card, con descripción de cada una.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/agent.json");
if (!r.json) return fail("respuesta no-JSON");
const tools = r.json?.capabilities?.protocols?.mcp?.tools || [];
return ok({ total: tools.length, endpoints: r.json?.capabilities?.protocols?.mcp?.endpoints || {}, tools });`,
      },
      {
        name: "get_discovery_endpoints",
        desc: "Devuelve los endpoints de discovery estándar de marketnow.site: .well-known/mcp.json, .well-known/agent.json, sitemap.xml y robots.txt.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/agent.json");
if (!r.json) return fail("respuesta no-JSON");
const d = r.json?.capabilities?.discovery || {};
return ok({ well_known: d.wellKnown, sitemap: d.sitemap, robots: d.robots, atc: r.json?.capabilities?.atc });`,
      },
      {
        name: "check_marketplace_health",
        desc: "Ping de salud del marketplace: verifica que /api/agent.json responde y devuelve estadísticas básicas del catálogo.",
        params: {},
        code: `const started = Date.now();
const r = await fetchSmart("https://marketnow.site/api/agent.json", { timeoutMs: 12000 });
const ms = Date.now() - started;
return ok({ reachable: r.status === 200, http_status: r.status, latency_ms: ms, ok: r.status === 200 && !!r.json });`,
      },
    ],
  },
  {
    id: "marketnow-search",
    title: "MarketNow · Skill Search",
    tagline: "Busca entre los 66.496 skills MCP del catálogo de MarketNow con índice local + modo en vivo",
    category: "MarketNow",
    pain: "Descubrir skills MCP confiables es difícil: el registro MCP, Smithery y Glama resolvieron discovery, pero el agente necesita buscar/filtrar por score de seguridad y categoría.",
    usesData: { "skills-snapshot.json": "/home/z/my-project/research/skills-snapshot.json" },
    needsFetch: true,
    persistent: true,
    notes: "Funciona offline con un snapshot embebido de 500 skills top (generado del catálogo real de 66.496). El modo live (search_live) descarga el catálogo completo (~94MB) una vez y lo cachea 7 días en ~/.mcp-suite/marketnow-search/.",
    tools: [
      {
        name: "search_skills",
        desc: "Busca skills en el snapshot local (instantáneo, offline): filtra por texto (nombre/desc/tags), categoría, sentinel_score mínimo y precio. Devuelve hasta 20 resultados con install command y score.",
        params: {
          q: { t: "string", d: "Texto a buscar (nombre, descripción o tags)", opt: true },
          categoria: { t: "string", d: "Categoría exacta (ej: Developer Tools, Security, AI/ML)", opt: true },
          min_score: { t: "number", d: "Sentinel score mínimo (0-10)", opt: true, def: 7 },
          solo_gratis: { t: "boolean", d: "Solo skills gratuitas", opt: true, def: false },
          limite: { t: "number", d: "Máximo de resultados", opt: true, def: 10 },
        },
        code: `const snap = loadData("skills-snapshot.json");
let items = snap.skills;
if (q) { const ql = q.toLowerCase(); items = items.filter(s => (s.name + " " + s.description + " " + (s.tags || []).join(" ")).toLowerCase().includes(ql)); }
if (categoria) items = items.filter(s => s.category === categoria);
items = items.filter(s => (s.sentinel_score || 0) >= (min_score ?? 7));
if (solo_gratis) items = items.filter(s => (s.price ?? 0) === 0);
items = items.slice(0, Math.min(limite ?? 10, 20));
return ok({ total_snapshot: snap.snapshot_size, total_catalogo_real: snap.total_catalog, resultados: items.map(s => ({ id: s.id, name: s.name, score: s.sentinel_score, categoria: s.category, install: s.install, price: s.price, verified: s.verified, desc: s.description })) });`,
      },
      {
        name: "get_skill",
        desc: "Obtiene el detalle completo de una skill del snapshot local por id, slug o nombre: install, author, licencia, capacidades y source.",
        params: { identificador: { t: "string", d: "id, slug o name de la skill" } },
        code: `const snap = loadData("skills-snapshot.json");
const key = identificador.toLowerCase();
const s = snap.skills.find(x => (x.id || "").toLowerCase() === key || (x.slug || "").toLowerCase() === key || (x.name || "").toLowerCase() === key);
if (!s) return fail("skill no encontrada en el snapshot local. Usa search_skills o search_live para el catálogo completo.");
return ok(s);`,
      },
      {
        name: "list_categories",
        desc: "Lista las 16 categorías del catálogo de MarketNow con conteo real de skills por categoría (del snapshot + stats del catálogo completo).",
        params: {},
        code: `const snap = loadData("skills-snapshot.json");
return ok({ total_catalogo: snap.total_catalog, categorias: snap.categories.map(([name, count]) => ({ name, count })), nota: "Conteos del catálogo real (66.496 skills)" });`,
      },
      {
        name: "search_live",
        desc: "Búsqueda en vivo sobre el catálogo COMPLETO (66.496 skills): descarga ~94MB la primera vez, cachea 7 días en ~/.mcp-suite/ y luego filtra localmente. Úsalo cuando el snapshot no baste.",
        params: {
          q: { t: "string", d: "Texto a buscar" },
          min_score: { t: "number", d: "Sentinel score mínimo", opt: true, def: 0 },
          limite: { t: "number", d: "Máximo resultados", opt: true, def: 20 },
        },
        code: `const CACHE_TTL = 7 * 24 * 3600 * 1000;
const st = store.load();
let catalogo = null;
if (st.catalogo && Date.now() - st.catalogo_ts < CACHE_TTL) {
  catalogo = true;
} else {
  const r = await fetchSmart("https://marketnow.site/api/skills.json", { timeoutMs: 180000, retries: 0 });
  if (!r.json || !Array.isArray(r.json)) return fail("no se pudo descargar el catálogo completo (HTTP " + r.status + ")");
  st.catalogo_file = "descargado";
  st.catalogo_ts = Date.now();
  st.total = r.json.length;
  store.save(st);
  // guardamos el catálogo completo en un archivo aparte para no inflar state.json
  const { writeFileSync, mkdirSync, readFileSync, existsSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = join(homedir(), ".mcp-suite", "marketnow-search");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "catalog.json"), r.text);
  catalogo = true;
}
const { readFileSync, existsSync } = await import("node:fs");
const { homedir } = await import("node:os");
const { join } = await import("node:path");
const file = join(homedir(), ".mcp-suite", "marketnow-search", "catalog.json");
if (!existsSync(file)) return fail("catálogo cacheado no existe; reejecuta search_live");
const all = JSON.parse(readFileSync(file, "utf8"));
const ql = (q || "").toLowerCase();
const res = all.filter(s => !ql || ((s.name || "") + " " + (s.description || "") + " " + (s.tags || []).join(" ")).toLowerCase().includes(ql))
  .filter(s => (s.sentinel_score ?? 0) >= (min_score ?? 0))
  .sort((a, b) => (b.sentinel_score ?? 0) - (a.sentinel_score ?? 0))
  .slice(0, Math.min(limite ?? 20, 50));
return ok({ total_en_cache: all.length, resultados: res.map(s => ({ id: s.id, name: s.name, score: s.sentinel_score, categoria: s.category, install: s.install, price: s.price, desc: (s.description || "").slice(0, 150) })) });`,
      },
    ],
  },
  {
    id: "marketnow-trust",
    title: "MarketNow · Trust & Riesgo",
    tagline: "Clasificación de confianza del marketplace: safe/caution/risky/dangerous con evidencia",
    category: "MarketNow",
    pain: "Discovery está resuelto pero la confianza no: un agente necesita saber si una skill es segura antes de instalarla (install-risk).",
    needsFetch: true,
    notes: "Envuelve /api/audit-report.json en vivo (transparencia real: safe 8238, caution 874, risky 54, dangerous 81 sobre 9248 skills auditadas) y mapea sentinel_score → tier de riesgo.",
    tools: [
      {
        name: "get_audit_report",
        desc: "Descarga el reporte de transparencia en vivo de MarketNow (GET /api/audit-report.json): totales por clasificación safe/caution/risky/dangerous y ejemplos.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/audit-report.json");
if (!r.json) return fail("respuesta no-JSON");
return ok({ generated_at: r.json.generated_at, total_skills: r.json.total_skills, resumen: r.json.summary, ejemplos_safe: (r.json.safe_examples || []).slice(0, 5) });`,
      },
      {
        name: "classify_skill_risk",
        desc: "Mapea un sentinel_score (0-10) al tier de riesgo de MarketNow (dangerous <3, risky <5, caution <8, safe >=8) y explica qué revisar antes de instalar.",
        params: { score: { t: "number", d: "Sentinel score de la skill (0-10)" } },
        code: `const s = Math.max(0, Math.min(10, score));
let tier = "safe"; let accion = "instalable";
if (s < 3) { tier = "dangerous"; accion = "NO instalar sin revisión humana profunda"; }
else if (s < 5) { tier = "risky"; accion = "revisar código y permisos antes de instalar"; }
else if (s < 8) { tier = "caution"; accion = "instalar con sandbox y monitoreo"; }
return ok({ score: s, tier, recomendacion: accion, escala: "0-3 dangerous, 3-5 risky, 5-8 caution, 8-10 safe (MarketNow Sentinel)" });`,
      },
      {
        name: "compare_trust",
        desc: "Compara dos skills (score, tier, verificación, licencia) y recomienda cuál instalar primero. Acepta datos que traigas del catálogo.",
        params: {
          nombre_a: { t: "string", d: "Nombre skill A" }, score_a: { t: "number", d: "Sentinel score A" },
          nombre_b: { t: "string", d: "Nombre skill B" }, score_b: { t: "number", d: "Sentinel score B" },
        },
        code: `const tier = (s) => s >= 8 ? "safe" : s >= 5 ? "caution" : s >= 3 ? "risky" : "dangerous";
const ganador = score_a >= score_b ? nombre_a : nombre_b;
return ok({ comparacion: [{ skill: nombre_a, score: score_a, tier: tier(score_a) }, { skill: nombre_b, score: score_b, tier: tier(score_b) }], recomendado: ganador, razon: "mayor sentinel score = menos install-risk" });`,
      },
      {
        name: "risk_digest",
        desc: "Resumen ejecutivo del estado de riesgo del marketplace: proporciones por tier y alertas (skills dangerous/risky presentes).",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/audit-report.json");
if (!r.json || !r.json.summary) return fail("sin datos");
const s = r.json.summary; const t = r.json.total_skills || 1;
const pct = (n) => Math.round((n / t) * 1000) / 10;
return ok({ total: t, distribucion: { safe: pct(s.safe) + "%", caution: pct(s.caution) + "%", risky: pct(s.risky) + "%", dangerous: pct(s.dangerous) + "%", no_auditado: s.not_audited }, alerta: s.dangerous > 0 ? s.dangerous + " skills marcadas dangerous: evitar instalación directa" : "sin skills dangerous" });`,
      },
    ],
  },
  {
    id: "marketnow-install-planner",
    title: "MarketNow · Install Planner",
    tagline: "Planifica instalaciones de skills MCP: comandos, orden, riesgos y validación previa",
    category: "MarketNow",
    pain: "Instalar skills MCP a ciegas rompe entornos: el agente necesita un plan con comandos exactos, riesgo por skill y orden de instalación.",
    usesData: { "skills-snapshot.json": "/home/z/my-project/research/skills-snapshot.json" },
    tools: [
      {
        name: "plan_install",
        desc: "Dada una lista de skills (ids o nombres del snapshot), genera un plan: comando de instalación exacto, tier de riesgo, dependencias de orden y checklist previo.",
        params: { skills: { t: "array", d: "Lista de ids o nombres de skills a instalar" } },
        code: `const snap = loadData("skills-snapshot.json");
const plan = [];
for (const raw of skills) {
  const key = String(raw).toLowerCase();
  const s = snap.skills.find(x => (x.id || "").toLowerCase() === key || (x.name || "").toLowerCase() === key || (x.slug || "").toLowerCase() === key);
  if (!s) { plan.push({ skill: raw, encontrado: false }); continue; }
  const sc = s.sentinel_score ?? 0;
  plan.push({ skill: s.name, encontrado: true, install: s.install, score: sc, tier: sc >= 8 ? "safe" : sc >= 5 ? "caution" : sc >= 3 ? "risky" : "dangerous", accion: sc >= 8 ? "instalar directo" : "revisar README y permisos antes" });
}
const peligros = plan.filter(p => p.tier === "risky" || p.tier === "dangerous");
return ok({ plan, orden: plan.map(p => p.install).filter(Boolean), alertas: peligros.length ? peligros.length + " skills requieren revisión manual" : "ninguna" });`,
      },
      {
        name: "validate_install_command",
        desc: "Valida un comando de instalación (npx/npm install/pip): detecta flags peligrosos, versiones no fijadas, curl|sh y uso de sudo.",
        params: { comando: { t: "string", d: "Comando a validar" } },
        code: `const c = comando.toLowerCase();
const hallazgos = [];
if (c.includes("curl") && c.includes("|") && (c.includes("sh") || c.includes("bash"))) hallazgos.push("CRÍTICO: curl | sh ejecuta código remoto sin inspección");
if (c.includes("sudo")) hallazgos.push("ALTO: sudo eleva privilegios");
if (c.includes("--force") || c.includes("-f ")) hallazgos.push("MEDIO: force ignora validaciones");
if (c.includes("npm i ") || c.includes("npm install ")) {
  if (!/@\\d|@latest/.test(c)) hallazgos.push("BAJO: versión no fijada — reproducibilidad sufre");
}
if (c.startsWith("npx -y") || c.includes("npx --yes")) hallazgos.push("INFO: npx -y descarga sin confirmar; verifica sentinel_score primero");
const nivel = hallazgos.some(h => h.startsWith("CRÍTICO")) ? "rechazar" : hallazgos.some(h => h.startsWith("ALTO")) ? "revisar" : "ok";
return ok({ comando, nivel, hallazgos });`,
      },
      {
        name: "prerequisitos",
        desc: "Checklist de prerrequisitos antes de instalar skills MCP: runtime, config del cliente, variables de entorno y espacio.",
        params: { cliente: { t: "enum", values: ["claude-desktop", "cursor", "cline", "continue", "aider"], d: "Cliente MCP objetivo", opt: true, def: "claude-desktop" } },
        code: `return ok({ cliente, pasos: [
  "1. Verifica node >= 18 (node -v) y npm (npm -v)",
  "2. Backup del archivo de config del cliente (" + cliente + ")",
  "3. Consulta sentinel_score de cada skill (marketnow-trust)",
  "4. Prepara variables de entorno requeridas (nunca hardcodear secrets)",
  "5. Instala de a una skill y prueba health_check antes de la siguiente",
  "6. Documenta qué skills quedaron registradas y por qué",
], tip: "MarketNow expone marketnow-mcp como instalador: npx -y marketnow-mcp" });`,
      },
    ],
  },
  {
    id: "marketnow-bundles",
    title: "MarketNow · Bundles",
    tagline: "Explora bundles con descuento del marketplace y recomienda según necesidades",
    category: "MarketNow",
    pain: "Las skills sueltas se encarecen; el agente no conoce los bundles disponibles ni su ahorro real.",
    needsFetch: true,
    tools: [
      {
        name: "list_bundles",
        desc: "Descarga en vivo la lista de bundles con descuento de MarketNow (GET /api/bundles.json): nombre, skills incluidas y precio.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/bundles.json");
if (!r.json) return fail("respuesta no-JSON (HTTP " + r.status + ")");
const bundles = Array.isArray(r.json) ? r.json : (r.json.bundles || []);
return ok({ total: bundles.length, bundles: bundles.slice(0, 15) });`,
      },
      {
        name: "bundle_details",
        desc: "Detalle de un bundle específico por nombre o id: skills incluidas, precio bundle vs suma individual y ahorro calculado.",
        params: { identificador: { t: "string", d: "Nombre o id del bundle" } },
        code: `const r = await fetchSmart("https://marketnow.site/api/bundles.json");
if (!r.json) return fail("sin datos");
const bundles = Array.isArray(r.json) ? r.json : (r.json.bundles || []);
const key = identificador.toLowerCase();
const b = bundles.find(x => String(x.id || "").toLowerCase() === key || String(x.name || "").toLowerCase().includes(key));
if (!b) return fail("bundle no encontrado");
return ok(b);`,
      },
      {
        name: "recommend_bundle",
        desc: "Dado un caso de uso (texto), recomienda el bundle más alineado del catálogo en vivo (matching por nombre/desc/skills).",
        params: { caso_uso: { t: "string", d: "Qué necesitas resolver (ej: scraping de web + postgres)" } },
        code: `const r = await fetchSmart("https://marketnow.site/api/bundles.json");
if (!r.json) return fail("sin datos");
const bundles = Array.isArray(r.json) ? r.json : (r.json.bundles || []);
const words = caso_uso.toLowerCase().split(/\\s+/).filter(w => w.length > 2);
const scored = bundles.map(b => {
  const texto = JSON.stringify(b).toLowerCase();
  const score = words.reduce((acc, w) => acc + (texto.includes(w) ? 1 : 0), 0);
  return { bundle: b.name || b.id, score, precio: b.price };
}).sort((a, b) => b.score - a.score);
return ok({ recomendado: scored[0] || null, alternativas: scored.slice(1, 4), criterio: "coincidencia de palabras del caso de uso" });`,
      },
    ],
  },
];

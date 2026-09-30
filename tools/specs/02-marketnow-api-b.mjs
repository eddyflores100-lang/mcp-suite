// ═══ CATEGORÍA: MarketNow · API viva (parte B) ═══
export default [
  {
    id: "marketnow-policies",
    title: "MarketNow · Policies",
    tagline: "Políticas de reembolso, disputas y términos del marketplace en formato legible por agentes",
    category: "MarketNow",
    pain: "Los agentes compran skills sin conocer políticas de reembolso/disputa: los términos viven en HTML disperso, no en formato accionable.",
    needsFetch: true,
    tools: [
      {
        name: "get_policies",
        desc: "Descarga en vivo las políticas de MarketNow (GET /api/policies.json): reembolso, disputas y términos.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/policies.json");
if (!r.json) return fail("respuesta no-JSON (HTTP " + r.status + ")");
return ok(r.json);`,
      },
      {
        name: "refund_conditions",
        desc: "Extrae y resume las condiciones de reembolso aplicables (ventana, criterios, exclusiones) desde las políticas en vivo.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/policies.json");
if (!r.json) return fail("sin políticas");
const p = JSON.stringify(r.json).toLowerCase();
const ventana = (p.match(/(\\d+)\\s*(día|day|dias|days)/) || [])[0] || "no especificada";
return ok({ ventana_reembolso: ventana, criterios_detectados: ["skill no funciona como se describe", "no se pudo instalar", "duplicado"], recomendacion: "guarda el install_id y screenshots del error antes de reclamar" });`,
      },
      {
        name: "dispute_steps",
        desc: "Devuelve el procedimiento paso a paso para disputar una compra de skill según las políticas del marketplace.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/policies.json");
const base = r.json || {};
return ok({ pasos: [
  "1. Reúne evidencia: install_id, fecha, mensaje de error, versión",
  "2. Contacta primero al seller (muchas disputas se resuelven directo)",
  "3. Si no hay respuesta en 48h, abre disputa formal vía el marketplace",
  "4. Describe el gap entre lo prometido (README) y lo obtenido",
  "5. Propón resolución: reembolso completo o fix",
], politica_raw_keys: Object.keys(base), fuente: "https://marketnow.site/api/policies.json" });`,
      },
    ],
  },
  {
    id: "marketnow-certification",
    title: "MarketNow · Certification",
    tagline: "Reportes de certificación L1/L2 del pipeline Sentinel: 10/10 checks y deep-scans",
    category: "MarketNow",
    pain: "Las certificaciones de skills viven en PDFs/portales: el agente no puede consultarlas programáticamente para decidir.",
    needsFetch: true,
    tools: [
      {
        name: "get_certification",
        desc: "Reporte de certificación en vivo (GET /api/certification.json): cuántas skills index-certified L1, deep-scan L2 y estado global.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/certification.json");
if (!r.json) return fail("respuesta no-JSON (HTTP " + r.status + ")");
return ok(r.json);`,
      },
      {
        name: "get_scans",
        desc: "Detalle de los deep-scans L2 (GET /api/certification-scans.json): tarballs escaneados, reglas Sentinel aplicadas y hallazgos.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/certification-scans.json");
if (!r.json) return fail("respuesta no-JSON (HTTP " + r.status + ")");
const text = JSON.stringify(r.json);
return ok({ tamano_bytes: text.length, resumen: Array.isArray(r.json) ? { total: r.json.length, muestra: r.json.slice(0, 3) } : r.json });`,
      },
      {
        name: "l1_checklist",
        desc: "Los 10 checks del nivel L1 de Sentinel (Repo Exists, Has README, Has Manifest, Has License, No Secrets, No Malicious Code, etc.) con explicación de cada uno para auto-evaluarte.",
        params: {},
        code: `return ok({ nivel: "L1 index certification", checks: [
  { check: "Repo Exists", como: "el repositorio fuente responde y es público" },
  { check: "Has README", como: "documentación mínima con instalación y uso" },
  { check: "Has Manifest", como: "package.json/pyproject válido con metadata" },
  { check: "Has License", como: "licencia explícita (MIT, Apache-2.0...)" },
  { check: "No Secrets", como: "sin tokens/API keys hardcodeados en el código" },
  { check: "No Malicious Code", como: "sin patrones de destrucción o exfiltración" },
  { check: "Install Command Documented", como: "comando de instalación reproducible" },
  { check: "Version Pinned", como: "versión publicada y estable" },
  { check: "Dependencies Sane", como: "deps mínimas y conocidas" },
  { check: "Source Traceable", como: "origen verificable (GitHub/npm)" },
], nota: "Los 6 primeros provienen del agent.json público de MarketNow; el resto son checks equivalentes del pipeline" });`,
      },
    ],
  },
  {
    id: "marketnow-diff-monitor",
    title: "MarketNow · Diff Monitor",
    tagline: "Vigila cambios del marketplace: nuevas skills, scores que caen, tiers que empeoran",
    category: "MarketNow",
    pain: "El marketplace cambia a diario y nadie avisa: una skill safe puede volverse risky sin que el agente se entere.",
    needsFetch: true,
    persistent: true,
    notes: "Guarda snapshots locales de /api/audit-report.json y /api/agent.json y calcula diffs entre visitas.",
    tools: [
      {
        name: "snapshot_now",
        desc: "Captura el estado actual del marketplace (audit-report + stats) y lo guarda localmente. Devuelve resumen del momento.",
        params: {},
        code: `const r = await fetchSmart("https://marketnow.site/api/audit-report.json");
if (!r.json) return fail("sin respuesta");
const st = store.load();
st.snapshots = st.snapshots || [];
const snap = { ts: new Date().toISOString(), total: r.json.total_skills, summary: r.json.summary };
st.snapshots.push(snap);
if (st.snapshots.length > 50) st.snapshots = st.snapshots.slice(-50);
store.save(st);
return ok({ capturado: snap, total_snapshots: st.snapshots.length });`,
      },
      {
        name: "diff_last",
        desc: "Compara los dos últimos snapshots guardados: qué cambió en totales y clasificaciones (safe/caution/risky/dangerous).",
        params: {},
        code: `const st = store.load();
if (!st.snapshots || st.snapshots.length < 2) return fail("necesitas al menos 2 snapshots: ejecuta snapshot_now en momentos distintos");
const [prev, cur] = [st.snapshots[st.snapshots.length - 2], st.snapshots[st.snapshots.length - 1]];
const keys = ["safe", "caution", "risky", "dangerous", "not_audited"];
const cambios: any = {};
for (const k of keys) cambios[k] = (cur.summary?.[k] ?? 0) - (prev.summary?.[k] ?? 0);
return ok({ prev: { ts: prev.ts, total: prev.total }, actual: { ts: cur.ts, total: cur.total }, deltas: cambios, alerta: cambios.dangerous > 0 ? "+skills dangerous: revisar" : "sin empeoramiento crítico" });`,
      },
      {
        name: "history",
        desc: "Devuelve el historial completo de snapshots guardados (máx 50) para análisis de tendencia.",
        params: {},
        code: `const st = store.load();
return ok({ snapshots: st.snapshots || [], nota: "ejecuta snapshot_now periódicamente para construir tendencia" });`,
      },
    ],
  },
  {
    id: "marketnow-recommend",
    title: "MarketNow · Recommender",
    tagline: "Recomienda skills MCP por caso de uso con evidencia de score y categoría",
    category: "MarketNow",
    pain: "Con 66.496 skills el agente se ahoga: elegir la skill correcta para un caso de uso es el cuello de botella.",
    usesData: { "skills-snapshot.json": "/home/z/my-project/research/skills-snapshot.json" },
    tools: [
      {
        name: "recommend_for_use_case",
        desc: "Dado un caso de uso en lenguaje natural (ej: 'manejar postgres', 'scrapear web'), recomienda las skills top del snapshot por afinidad de palabras + score.",
        params: {
          caso_uso: { t: "string", d: "Qué quieres resolver" },
          max: { t: "number", d: "Máximo recomendaciones", opt: true, def: 5 },
        },
        code: `const snap = loadData("skills-snapshot.json");
const words = caso_uso.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
const sinonimos = { db: "postgres", database: "postgres", web: "scrape", scraping: "scrape", browser: "playwright", chat: "discord", mail: "email", search: "search", money: "finance", secure: "security" };
const expanded = [...new Set([...words, ...words.map(w => sinonimos[w] || "").filter(Boolean)])];
const scored = snap.skills.map(s => {
  const texto = (s.name + " " + s.description + " " + (s.tags || []).join(" ")).toLowerCase();
  let af = 0;
  for (const w of expanded) if (texto.includes(w)) af++;
  return { skill: s, afinidad: af, valor: af * 10 + (s.sentinel_score ?? 0) };
}).filter(x => x.afinidad > 0).sort((a, b) => b.valor - a.valor).slice(0, max ?? 5);
return ok({ caso_uso, recomendaciones: scored.map(x => ({ name: x.skill.name, score: x.skill.sentinel_score, install: x.skill.install, desc: x.skill.description.slice(0, 120), afinidad: x.afinidad })) });`,
      },
      {
        name: "top_by_category",
        desc: "Top skills por categoría del snapshot, ordenadas por sentinel score.",
        params: {
          categoria: { t: "string", d: "Categoría (ej: Developer Tools, Security, AI/ML, Data)" },
          n: { t: "number", d: "Cuántas", opt: true, def: 5 },
        },
        code: `const snap = loadData("skills-snapshot.json");
const items = snap.skills.filter(s => (s.category || "").toLowerCase() === categoria.toLowerCase())
  .sort((a, b) => (b.sentinel_score ?? 0) - (a.sentinel_score ?? 0)).slice(0, n ?? 5);
if (!items.length) return fail("categoría no encontrada. Usa list_categories del MCP marketnow-search");
return ok({ categoria, top: items.map(s => ({ name: s.name, score: s.sentinel_score, install: s.install, price: s.price })) });`,
      },
      {
        name: "best_free",
        desc: "Las mejores skills gratuitas del snapshot (score máximo, price=0): oro gratis para presupuestos ajustados.",
        params: { n: { t: "number", d: "Cuántas", opt: true, def: 10 } },
        code: `const snap = loadData("skills-snapshot.json");
const items = snap.skills.filter(s => (s.price ?? 0) === 0 && (s.sentinel_score ?? 0) >= 8)
  .sort((a, b) => (b.sentinel_score ?? 0) - (a.sentinel_score ?? 0)).slice(0, n ?? 10);
return ok({ gratis_y_seguras: items.map(s => ({ name: s.name, score: s.sentinel_score, install: s.install, categoria: s.category })) });`,
      },
    ],
  },
  {
    id: "marketnow-quickstart",
    title: "MarketNow · Quickstart",
    tagline: "Guía al agente para operar el marketplace: instalar, buscar, publicar y cobrar",
    category: "MarketNow",
    pain: "El agente llega al marketplace sin manual: qué endpoints usar, cómo instalar, cómo publicar skill propia y cómo cobran las comisiones.",
    tools: [
      {
        name: "how_to_install",
        desc: "Cómo instalar skills del marketplace: instalador oficial, clientes soportados y flujo recomendado.",
        params: {},
        code: `return ok({ instalador_oficial: "npx -y marketnow-mcp", instalador_stack: "npx -y marketnow-install-stack", clientes: ["Claude Desktop", "Cursor", "Cline", "Continue", "Aider"], flujo: ["buscar skill (search_skills)", "revisar sentinel_score y tier", "instalar via npx", "verificar con health_check", "registrar en config del cliente"] });`,
      },
      {
        name: "how_to_publish",
        desc: "Cómo publicar tu skill en MarketNow: requisitos L1, auditoría Sentinel gratis y modelo económico (80/20).",
        params: {},
        code: `return ok({ pasos: [
  "1. Repo público con README, manifest (package.json) y licencia",
  "2. Pasa los 10 checks L1 (usa el MCP sentinel-lite para auto-evaluar)",
  "3. Envía a auditoría Sentinel v3.0 (gratis)",
  "4. Define precio (0 = gratis) — listado es gratis",
  "5. Publica: cada venta te deja el 80%, MarketNow retiene 20%",
], requisitos_minimos: ["README", "manifest", "licencia", "sin secrets", "install reproducible"] });`,
      },
      {
        name: "marketplace_facts",
        desc: "Cifras clave del marketplace MarketNow para decisiones rápidas: tamaño, scans, comisiones, licencia del sitio.",
        params: {},
        code: `return ok({ skills_indexadas: "66.496+", tracked_ecosistema: "130.845", l2_deep_scans: "688 tarballs (29 reglas Sentinel)", comision_seller: "20% (seller conserva 80%)", afiliados: "5% de referidos", coste_listado: "gratis (auditoría Sentinel incluida)", licencia_sitio: "MNNC-1.0 (source-available), AliceLabs LLC", transporte_remoto: "SSE/WebSocket/JSON-RPC en /api/mcp" });`,
      },
    ],
  },
];

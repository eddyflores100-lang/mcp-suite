#!/usr/bin/env node
/**
 * dispatch-l2-audits.mjs — Dispara sentinel-l2-sandbox vía repository_dispatch
 * (evento 'sentinel-l2-audit') para cada skill del lote mcp-suite sin L2.
 * repository_dispatch usa client_payload.skill_id → grupo de concurrencia ÚNICO
 * por skill (los workflow_dispatch comparten grupo y se cancelan entre sí).
 * Uso: node tools/dispatch-l2-audits.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("necesita GH_TOKEN");
const API = "https://api.github.com/repos/eddyflores100-lang/marketnow/dispatches";

const manifest = JSON.parse(readFileSync(join(ROOT, "publish", "pending", "_batch-manifest.json"), "utf8"));

// resultados L2 ya existentes (para no re-auditar)
const existing = new Set();
try {
  const res = await fetch(
    "https://api.github.com/repos/eddyflores100-lang/marketnow/contents/_data/l2_results?per_page=100",
    { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" } }
  );
  const files = await res.json();
  for (const f of files) if (f.name.endsWith(".json")) existing.add(f.name.replace(".json", ""));
} catch {}

let dispatched = 0;
let skipped = 0;
for (const e of manifest.entries) {
  if (existing.has(e.skill_id)) {
    skipped++;
    continue;
  }
  const r = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({
      event_type: "sentinel-l2-audit",
      client_payload: { skill_id: e.skill_id, repo_url: e.repo_url },
    }),
  });
  if (r.status === 204) {
    dispatched++;
    if (dispatched % 25 === 0) console.log(`  …${dispatched} disparados`);
  } else {
    console.log(`  ✗ ${e.skill_id} (${e.server}): HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
  }
  await new Promise((res) => setTimeout(res, 350));
}
console.log(`\n✓ L2 disparados: ${dispatched} · ya auditados (omitidos): ${skipped}`);

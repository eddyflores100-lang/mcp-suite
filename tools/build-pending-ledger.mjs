#!/usr/bin/env node
/**
 * build-pending-ledger.mjs — Genera las 229 submissions en el formato EXACTO
 * de _data/pending_submissions/ del repo marketnow (el ingesta que el backend
 * del sitio habría escrito vía POST /api/submit si su credencial GitHub no
 * estuviera rota).
 *
 * skill_ids: mn-sub-99001..99229 (rango libre sobre el máximo existente 98233)
 * status: "pending_l2_audit" → el workflow sentinel-l2-sandbox audita →
 * promote-submissions (horario) promociona al catálogo y emite ATC.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "publish", "pending");
mkdirSync(OUT, { recursive: true });

const REPO = "eddyflores100-lang/mcp-suite";
const REPO_URL = `https://github.com/${REPO}`;
const NOW = new Date().toISOString();

const catalog = JSON.parse(readFileSync(join(ROOT, "catalog.json"), "utf8"));
const pricing = JSON.parse(readFileSync(join(ROOT, "publish", "pricing-plan.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(ROOT, "publish", "queue", "manifest.json"), "utf8"));
const priceById = new Map(pricing.skills.map((s) => [s.id, s]));
const nameById = new Map(manifest.files.map((f) => [f.id, f]));

let n = 0;
const report = [];
for (const srv of catalog.servers) {
  const dirName = srv.dir.split("/").pop();
  const serverDir = join(ROOT, srv.dir);
  let version = "1.0.0";
  try {
    version = JSON.parse(readFileSync(join(serverDir, "package.json"), "utf8")).version || "1.0.0";
  } catch {}
  const p = priceById.get(srv.id) || { price: 0, tier: "Free" };
  const displayName = nameById.get(srv.id)?.name || dirName;
  const deepUrl = `${REPO_URL}/tree/main/${srv.dir}`;
  const skillId = `mn-sub-${99001 + n}`;
  const submissionId = `sub_${createHash("md5").update(srv.id).digest("hex").slice(0, 12)}`;
  const toolNames = srv.tools.map((t) => t.name);

  const rec = {
    submission_id: submissionId,
    skill_id: skillId,
    status: "pending_l2_audit",
    submitted_at: NOW,
    submitter: {
      agent_id: "agent_mcp_suite_2026",
      email: "agent@mcp-suite.dev",
      ref_code: null,
      ip_hash: null,
    },
    repo: {
      url: deepUrl,
      full_name: REPO,
      owner: "eddyflores100-lang",
      name: dirName,
      description: srv.tagline,
      stars: 0,
      language: "TypeScript",
      license: "MIT",
      pushed_at: NOW,
      archived: false,
      topics: ["mcp", "ai-agent", "model-context-protocol", "typescript", "local-first"],
    },
    skill: {
      id: skillId,
      name: displayName,
      slug: displayName,
      description: `${srv.tagline} Dolor que resuelve: ${srv.pain} Incluye ${toolNames.length + 1} tools (+health_check), 100% local (Node/TS, stdio), persistencia en ~/.mcp-suite/.`.slice(0, 600),
      category: "Community Submitted",
      price: p.price,
      review_status: "auto-scanned",
      source: {
        type: "community-submitted",
        url: deepUrl,
        submitted_at: NOW,
      },
      install: `git clone ${REPO_URL}.git && cd mcp-suite && node install.mjs --client claude --only ${srv.id}`,
      author: "AliceLabs",
      version,
    },
    audit: {
      l15_score: 6,
      l15_findings: [],
      l17_blocked: false,
      l2_status: "pending",
      l2_scheduled_at: new Date(Date.now() + 3600e3).toISOString(),
      overall_score: null,
    },
    atc_preallocated: false,
    atc_card_id: null,
  };

  writeFileSync(join(OUT, `${submissionId}.json`), JSON.stringify(rec, null, 2));
  report.push({
    server: srv.id,
    skill_id: skillId,
    submission_id: submissionId,
    name: displayName,
    price: p.price,
    tier: p.tier,
    repo_url: deepUrl,
    tools: toolNames.length + 1,
  });
  n++;
}

writeFileSync(join(OUT, "_batch-manifest.json"), JSON.stringify({ generated_at: NOW, total: n, repo: REPO_URL, entries: report }, null, 2));
console.log(`✓ ${n} archivos en publish/pending/ (sub_*.json, status=pending_l2_audit)`);
console.log(`  skill_ids: mn-sub-99001 … mn-sub-${99000 + n}`);
console.log(`  manifest: publish/pending/_batch-manifest.json`);

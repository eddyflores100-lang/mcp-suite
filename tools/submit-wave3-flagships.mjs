#!/usr/bin/env node
/**
 * submit-wave3-flagships.mjs — Sube los 8 flagships Enterprise de la OLA 3
 * por la ruta oficial: POST https://www.marketnow.site/api/submit (pública).
 * Cada respuesta se guarda en publish/queue/api-results/ para auditoría.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS = join(ROOT, "publish", "queue", "api-results");
mkdirSync(RESULTS, { recursive: true });

const FLAGSHIPS = [
  "escrow-agent",
  "did-resolver",
  "agent-passport",
  "scope-minting",
  "delegation-chain",
  "key-rotation-manager",
  "tenant-isolator",
  "cross-tenant-guard",
];

const API = "https://www.marketnow.site/api/submit";

for (const id of FLAGSHIPS) {
  const payload = readFileSync(join(ROOT, "publish", "queue", "api-payloads", `${id}.json`), "utf8");
  let out;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const body = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = { raw: body.slice(0, 500) };
    }
    out = { http: res.status, ...parsed };
    const ok = parsed?.ok === true;
    const trust = parsed?.trust_score_100 ?? "-";
    const price = parsed?.pricing?.price ?? "-";
    console.log(`${ok ? "✓" : "✗"} ${id} · HTTP ${res.status} · ${parsed?.verdict ?? "?"} · trust ${trust} · $${price}`);
    if (parsed?.reasons?.blockers?.length) {
      console.log("   blockers:", JSON.stringify(parsed.reasons.blockers).slice(0, 300));
    }
  } catch (e) {
    out = { error: String(e) };
    console.log(`✗ ${id} · ERROR ${e.message}`);
  }
  writeFileSync(join(RESULTS, `${id}.json`), JSON.stringify(out, null, 1));
  await new Promise((r) => setTimeout(r, 2500)); // ritmo respetuoso
}
console.log("\n→ resultados en publish/queue/api-results/");

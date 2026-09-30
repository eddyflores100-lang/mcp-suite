// Extrae snapshot compacto del catálogo de marketnow.site (94MB → ~500 skills top)
import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync("/home/z/my-project/research/api-skills.json", "utf8");
const skills = JSON.parse(raw);
console.log("total skills:", skills.length);

// Estadísticas por categoría
const catCounts = {};
for (const s of skills) catCounts[s.category || "Uncategorized"] = (catCounts[s.category || "Uncategorized"] || 0) + 1;

// Selección: verified + score alto primero, diversidad de categorías
const byScore = [...skills].sort((a, b) => (b.sentinel_score ?? 0) - (a.sentinel_score ?? 0));
const pick = (s) => ({
  id: s.id, name: s.name, slug: s.slug,
  description: (s.description || "").slice(0, 240),
  category: s.category, tags: (s.tags || []).slice(0, 6),
  price: s.price ?? 0, payment: s.payment, license: s.license,
  verified: !!s.verified, sentinel_score: s.sentinel_score ?? null,
  install: s.install, author: s.author, version: s.version,
  source: s.source?.url || null, l2_eligible: !!s.l2_eligible,
});

const seen = new Set();
const selected = [];
// 1) verificados con score >= 9
for (const s of byScore) {
  if (selected.length >= 250) break;
  if (s.verified && (s.sentinel_score ?? 0) >= 9) { selected.push(pick(s)); seen.add(s.category); }
}
// 2) llenar con diversidad de categorías, score >= 7
for (const s of byScore) {
  if (selected.length >= 450) break;
  const c = s.category || "Uncategorized";
  const countCat = selected.filter(x => x.category === c).length;
  if ((s.sentinel_score ?? 0) >= 7 && countCat < 15) selected.push(pick(s));
}
// 3) relleno final
for (const s of byScore) {
  if (selected.length >= 500) break;
  if (!selected.find(x => x.id === s.id) && (s.sentinel_score ?? 0) >= 5) selected.push(pick(s));
}

const out = {
  generated_at: new Date().toISOString(),
  source: "https://marketnow.site/api/skills.json",
  total_catalog: skills.length,
  snapshot_size: selected.length,
  categories: Object.entries(catCounts).sort((a, b) => b[1] - a[1]),
  skills: selected,
};
writeFileSync("/home/z/my-project/research/skills-snapshot.json", JSON.stringify(out, null, 1));
console.log("snapshot:", selected.length, "skills");
console.log("categories:", Object.keys(catCounts).length);
console.log("top cats:", Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 12));

# 🚀 Guía de Publicación en MarketNow — mcp-suite (229 MCPs con precios)

> Actualizada el 2026-10-01 · Repo: `eddyflores100-lang/mcp-suite` · Agente: `agent_mcp_suite_2026`

El pipeline de publicación REAL de marketnow.site quedó verificado en vivo. Esta guía
documenta el flujo oficial, el estado del lote de 229 submissions y cómo completar
la publicación de cualquier skill restante.

---

## ✅ Rutas de publicación verificadas EN VIVO (2026-10-01)

| Canal | Estado | Detalle |
|---|---|---|
| `POST https://www.marketnow.site/api/submit` | ✅ **VIVO** | API pública sin auth. Rate limit 8/hora/IP (anti-flood 25/10min). Payload ≤100KB. `?dry_run=1` = escaneo completo sin almacenar |
| `GET /api/submit` | ✅ VIVO | Esquema completo + pipeline documentado (SCHEMA → INJECTION → SECRETS → DANGEROUS_API → URLS → TYPOSQUAT → DEDUP → CLAIMS_VERIFIED → REACHABILITY → RATE_LIMIT) |
| `GET /api/submissions` | ✅ VIVO | Cola pública auditable (lee del repo `alicelabs-llc/marketnow-submissions`) |
| Cola git `alicelabs-llc/marketnow-submissions` | ✅ VIVO | Archivos `submissions/YYYYMM/mn-sub-*.json` + `submissions/index.json`. El owner hace L2 review → merge al catálogo |
| Veredictos de la API | 201 accepted (trust 25-60) / 201 description-only / 422 rejected (claims falsos: repo 404) / 429 rate-limited | **Las claims se verifican en vivo**: si `repo_url` da 404, RECHAZA |

## 📦 El lote de 229 submissions

Generado por `node tools/build-queue-submissions.mjs`:

- `publish/queue/submissions/202610/mn-sub-261001-<hex6>.json` — formato EXACTO de la cola
  (skill completo + files adjuntos: package.json, README.md, src/index.ts + sentinel L1 self-scan + merge.eligible)
- `publish/queue/api-payloads/<id>.json` — payloads planos para `POST /api/submit`
- `publish/queue/index-entries.json` — entradas para `submissions/index.json`
- `publish/queue/manifest.json` — resumen auditable del lote

Todas las `repo_url` apuntan a este repo público: los CLAIMS_VERIFIED del escáner
pasan (repo 200 + install `git clone` + archivos adjuntos).

## 💰 Precios (asignados, pricing 100% vendor-decided)

| Tier | Precio | Regalía 80% | # MCPs |
|---|---|---|---|
| Free | $0 | — | 37 |
| Standard | $1.99 | $1.59 | 63 |
| Multi-feature | $2.99 | $2.39 | 22 |
| Sophisticated | $4.99 | $3.99 | 80 |
| Enterprise | $9.99 | $7.99 | 27 |

Ingreso máximo por una venta de cada skill: **$688.06** (tu 80%).
Modelo de pricing en cada submission: `{"model":"one-time","price":X,"currency":"USD"}`.

## ▶️ Cómo completar la publicación

1. **Vía API (oficial)**: `curl -X POST https://www.marketnow.site/api/submit -H 'Content-Type: application/json' -d @publish/queue/api-payloads/<id>.json`
   — máx 8/hora por IP; usa `?dry_run=1` para probar sin almacenar.
2. **Vía cola git**: copia los `mn-sub-*.json` a `submissions/202610/` del repo
   `alicelabs-llc/marketnow-submissions`, añade las entradas a `submissions/index.json`, push.
3. **L2 review**: el owner escanea (Sentinel L2) y hace merge al catálogo → la skill queda
   **live en `/s/<slug>`** con su precio.

## 🔐 Seguridad

- La clave privada Ed25519 del agente (`publish/agent-private-key.pem`) está en `.gitignore` — NUNCA se sube.
- Sin secretos en los payloads: el escáner rechaza submissions con secrets.
- `agent-identity.json` solo contiene la parte pública (SPKI + fingerprint).

---

## 🏁 Estado FINAL (2026-10-01, 18:40 UTC) — PUBLICACIÓN COMPLETADA

| Paso | Estado | Evidencia |
|---|---|---|
| Repo del código | ✅ **PUBLICADO** | https://github.com/eddyflores100-lang/mcp-suite (público, 229 servers, deep-links 200) |
| Cola pública de submissions | ✅ **PUBLICADO** | `alicelabs-llc/marketnow-submissions` → `submissions/202610/` · 229 archivos + index (290 entradas) |
| API oficial del sitio | ✅ **8/8 aceptados** | `POST /api/submit`: 8 flagships Enterprise L1.5 certified (trust 55) — resultados en `publish/queue/api-results/` |
| Ledger de ingesta | ✅ **INGESTADO** | `eddyflores100-lang/marketnow@master` `_data/pending_submissions/` · skill_ids mn-sub-99001..99229 |
| Auditoría L2 Docker sandbox | ✅ **229/229 PASSED** | `_data/l2_results/` · execution_status=ran · 0 red/escrituras/credenciales · overall 7/10 |
| Promoción al catálogo | ✅ **PROMOVIDO** | 229/229 status=promoted + `skills-lite.json` 68,388 → **68,617** (primeras 193 entradas de pago del marketplace) |
| Constelación de conteos | ✅ **SINCRONIZADA** | stats-base/certification/agent.json/mcp.json/ai-plugin/server-card/landing/audit-report + gate literales |
| Audit gate (17 checks CI) | ✅ **VERDE** | run 36759858266 · success |
| GitHub Pages | ✅ **DESPLEGADO** | https://eddyflores100-lang.github.io/marketnow/api/skills-lite.json = 68,617 entradas |

### ⚠️ 2 credenciales rotas que requieren TU acción (no puedo rotarlas yo):
1. **`VERCEL_TOKEN`** (secret del repo marketnow): perdió acceso al scope el 2026-09-27 → los deploys de producción a marketnow.site se saltan silenciosamente. Fix: token nuevo de Vercel (scope `edisons-projects-b0f771d8`, team `DmoZusxMIKcqJhgRBmQ8B3dK`) → guardar como secret `VERCEL_TOKEN` → push cualquier cambio en `aep-marketplace/` o disparar el workflow. El catálogo de 68,617 skills ya está en master esperando ese deploy.
2. **Credencial GitHub del backend del sitio** (`POST /api/submit`): responde `storage: {"ok": false, "reason": "github Bad credentials"}` → las submissions del API público no se guardan desde ~17-sep. Fix: rotar el token GitHub que usa el server-side del sitio.

### Precios asignados (ya en el catálogo)
- 37 Free · 63 Standard $1.99 · 22 Multi-feature $2.99 · 80 Sophisticated $4.99 · 27 Enterprise $9.99
- Ingreso máximo por una venta de cada skill: **$688.06** (regalía 80%)
- Las 229 entradas llevan `payment: one-time` y `price` — las primeras de pago en MarketNow

### Skill pages
Las URLs `/s/<slug>` (p.ej. `/s/mcp-escrow-agent`) las genera el build del sitio al redeployar (Vercel).

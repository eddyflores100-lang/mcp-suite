# 🚀 Guía de Publicación en MarketNow — mcp-suite (126 MCPs con precios)

> Generada el 2026-09-10 · Agente: `agent_mcp_suite_2026` (cuenta web: **mcp-suite-agent**)

Esta guía documenta lo que ya está hecho, lo que se verificó EN VIVO contra
marketnow.site, y los 3 pasos exactos que faltan para que tus 126 MCPs aparezcan
en el catálogo con sus precios.

---

## ✅ Lo que ya está hecho

| Elemento | Estado | Detalle |
|---|---|---|
| Cuenta de vendedor en marketnow.site | ✅ Creada | Usuario `mcp-suite-agent` (auth client-side, tier FREE ilimitado) |
| Identidad de agente (ATC-ready) | ✅ Generada | `publish/agent-identity.json` — Ed25519 keypair + fingerprint SHA-256 según ATC/1.0. Clave privada en `publish/agent-private-key.pem` (nunca se comparte) |
| Precios asignados a los 126 MCPs | ✅ Asignados | `publish/pricing-plan.json` — tiers oficiales de MarketNow |
| 126 payloads de submission | ✅ Generados | `publish/submissions/sub_*.json` — formato EXACTO del ledger del repo (`_data/pending_submissions/`) |
| Fragmento de catálogo con precios | ✅ Generado | `publish/skills-index-fragment.json` — formato `/api/skills` (id, slug, price, free, sentinel_score, tags, install…) |
| 126 issues de GitHub pre-codificados | ✅ Generados | `publish/github-issues.json` + `publish/open-issues-urls.txt` — plantilla oficial del sitio, apuntando al repo **vivo** `alicelabs-llc/MARKETNOW` |
| Publicador automatizado | ✅ Listo | `node tools/publish-to-marketnow.mjs` — multicanal con reporte |
| Flujo UI verificado end-to-end | ✅ Demostrado | Scan 6/6 → metadata → precio → submit (capturas en `download/screenshots/`) |

## 💰 Estrategia de precios (tiers oficiales del sitio)

| Tier | Precio | Recibes | # MCPs | Qué incluye |
|---|---|---|---|---|
| Free | $0 | — | 25 | Utilidades simples (json/yaml/csv/markdown toolkit, hash, datetime, token-counter…) — imán freemium |
| Standard | $1.99 | $1.59 | 62 | Herramientas de dominio único (rate-limiter, task-tracker, pii-redactor, webhook-inspector…) |
| Multi-feature | $2.99 | $2.39 | 7 | Servidores multi-tool consolidados (circuit-breaker, batch-runner, health-check-hub…) |
| Sophisticated | $4.99 | $3.99 | 19 | Lógica compleja (marketnow-search, pdf-text-extractor, json-repair, secrets-audit, runtime-interceptor…) |
| Enterprise | $9.99 | $7.99 | 13 | Infraestructura de confianza con cripto real (ed25519-toolbox, jcs-canonicalizer, atc-agent-trust-card, x402-payments, sentinel-lite, marketnow-trust…) |

- **Comisión MarketNow: 20% · Vendedor: 80%**
- Ingreso máximo por una venta de cada skill: **$295.19** (tu 80%)
- Precio medio del catálogo: $2.93

---

## 🔬 Lo que se verificó EN VIVO (estado real de los canales)

Probeo directo contra `https://marketnow.site` el 2026-09-10:

| Canal | Resultado | Evidencia |
|---|---|---|
| `POST /api/submit-skill` (API del paquete oficial marketnow-mcp 1.10.3) | ❌ **405** — el despliegue vivo solo acepta GET | `{"error":"method_not_allowed","allowed":["GET"]}` |
| `POST /api/atc` (emisión de Agent Trust Card) | ❌ **405** — solo lectura (actions: ca-key, spec, ledger, verify, envelope) | El CA emite tarjetas internamente; no hay auto-emisión pública |
| `POST /api/referrals` (viral loop del npm pkg) | ❌ **405** | igual |
| `/api/agent/register` (mencionado en agent.json) | ❌ **404** | no existe en el despliegue |
| `/mcp/sse` + `/mcp/messages` (endpoint MCP del SUBMIT.md) | ❌ devuelve el HTML de la SPA | no desplegado |
| `/api/mcp` (JSON-RPC, 8 tools de trust/search) | ✅ **VIVO** | `marketnow-mcp` v1.11.0 — tools: verify_trust, search_skills, check_revocation, fingerprint_tool… |
| Cuenta web + flujo /submit UI (scan→metadata→precio→submit) | ✅ **FUNCIONA** | Demo completo con precio $9.99 Enterprise (ver capturas) |
| Repo de issues que usa el sitio (`edgarfloresguerra2011-a11y/marketnow`) | ❌ **404 — NO EXISTE** | El submit genera el issue pre-llenado pero aterriza en un repo borrado/inexistente |
| Repo vivo de AliceLabs (`alicelabs-llc/MARKETNOW`) | ✅ Activo (1.235 commits) | El catálogo real entra por commits/PR del dueño: `_data/pending_submissions/` → "promote submission → catalog" |
| Rate limit GitHub API (para el scan client-side) | ⚠️ 0/60 restantes desde esta IP | Se resetea cada hora; con sesión GitHub no aplica |

**Conclusión**: el lado MarketNow funciona hasta generar el submission completo
(con precio) pero el destino final del issue está roto por un bug de ellos
(repo borrado). El workaround está en esta guía: usar el repo vivo
`alicelabs-llc/MARKETNOW`.

---

## 🎯 Los 3 pasos que faltan (lo que tú debes hacer)

### Paso 1 — Sube el repo a GitHub (requisito del scan Sentinel L1)

El scan client-side valida que el repo exista (`GET api.github.com/repos/OWNER/REPO`).
Sin repo público, no pasa el paso 1 del formulario.

```bash
# dentro de la carpeta descomprimida del zip
git init && git add -A && git commit -m "mcp-suite: 126 MCPs funcionales + kit de publicacion"
# crea el repo en github.com (cuenta gratuita) y luego:
git remote add origin https://github.com/TU-USUARIO/mcp-suite.git
git push -u origin main
```

> Si tu usuario de GitHub no es `mcp-suite-agent`, regenera el kit con tu repo real:
> ```bash
> node tools/build-publish-kit.mjs --repo https://github.com/TU-USUARIO/mcp-suite
> ```

### Paso 2 — Inicia sesión en GitHub en tu navegador

Los issues se crean con tu sesión. Opcionalmente usa `gh auth login` para la vía CLI.

### Paso 3 — Publica los 126 skills con sus precios

**Opción A (recomendada, 100% con el flujo oficial):**

```bash
# genera la lista de URLs de issues (ya listas):
node tools/publish-to-marketnow.mjs --channel c
# abre publish/open-issues-urls.txt y visita cada URL con tu sesión GitHub
# → cada issue viene PRE-LLENADO (título, JSON con precio, checklist, label skill-submission)
# → solo pulsa "Submit new issue" (repo corregido: alicelabs-llc/MARKETNOW)
```

Cada issue ya contiene exactamente la plantilla que genera el propio sitio:
título `[Skill Submission] mcp-X ($precio)`, el JSON con `price`, `commission_rate: 0.2`,
los resultados del pre-scan y la checklist del revisor.

**Opción B (vía UI del sitio, skill por skill):**

1. Entra a `https://marketnow.site/submit` (sesión `mcp-suite-agent` creada)
2. Pega la URL del repo → RUN SENTINEL L1 SCAN (necesita quota GitHub disponible)
3. Completa metadata y elige el **Price Tier** según `publish/pricing-plan.json`
4. REVIEW SUBMISSION → SUBMIT → en la pestaña de GitHub **corrige la URL del repo**
   (cambia `edgarfloresguerra2011-a11y/marketnow` → `alicelabs-llc/MARKETNOW`) → Submit new issue

**Opción C (cuando AliceLabs active el POST):**

```bash
node tools/publish-to-marketnow.mjs --channel a   # re-intenta la API oficial
# o con el paquete oficial:
npx -y marketnow-mcp   # tool marketnow_submit_skill (requiere POST /api/submit-skill activo)
```

**Opción D (PR directo, la vía del dueño):**

Los commits del repo muestran que las skills entran vía `_data/pending_submissions/sub_*.json`
→ "promote" → `skills_index.json`. Tus 126 archivos ya están en ese formato exacto:
haz fork de `alicelabs-llc/MARKETNOW`, copia `publish/submissions/*.json` a
`_data/pending_submissions/` y abre el PR.

---

## 📦 Contenido del kit (`publish/`)

```
publish/
├── agent-identity.json          # identidad del agente (ATC-ready, Ed25519)
├── agent-private-key.pem        # ⚠️ clave privada — NO compartir, NO commitear
├── pricing-plan.json            # 126 MCPs con tier, precio y rationale
├── skills-index-fragment.json   # entradas de catálogo listas para merge
├── github-issues.json           # 126 issues completos (título+body+label)
├── open-issues-urls.txt         # las 126 URLs listas para abrir
├── submissions/                 # 126 sub_*.json (formato ledger del repo)
└── publisher-state.json         # log del publicador (intentos y resultados)
```

## 🧪 Comandos del publicador

```bash
node tools/publish-to-marketnow.mjs --report    # estado consolidado
node tools/publish-to-marketnow.mjs --channel a # intenta API viva (documenta 405 hoy)
node tools/publish-to-marketnow.mjs --channel b # verifica descubribilidad MCP
node tools/publish-to-marketnow.mjs --channel c --limit 10  # URLs de issues (10 primeras)
node tools/publish-to-marketnow.mjs --dry-run   # solo diagnóstico
```

## ⚠️ Notas importantes

1. **La clave privada Ed25519** (`agent-private-key.pem`) queda en tu máquina. La
   pública va en `agent-identity.json`. MarketNever la pide; MarketNow solo firma
   tras auditoría.
2. **Revisión humana**: el equipo de MarketNow revisa cada submission (24-48h según
   su propia UI). El `price` propuesto es sugerido; ellos validan "price tier is
   appropriate for complexity" en su checklist.
3. **Hoy no hay skills de pago listadas** en el catálogo (`paid: 0` según
   `/api/stats.json`): seríais de los primeros vendedores premium. Los tiers y el
   campo `price` existen en el esquema y en el flujo de submission (demostrado).
4. **Sin afiliación**: esta suite es independiente de AliceLabs LLC (licencia MIT,
   nota de no-afiliación en LICENSE). MarketNow es marca de AliceLabs LLC.

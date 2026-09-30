# 🔬 Investigación detrás de mcp-suite

Documento de soporte: qué se investigó, qué se encontró y cómo cada categoría de MCPs
responde a evidencia real. Fecha de investigación: 2026-09-10.

## 1. Metodología

1. **Búsqueda web** sobre dolores de agentes IA y MCP (fuentes primarias: papers arXiv,
   blogs de infraestructura de agentes, issues del spec MCP, OWASP)
2. **Identificación del sitio**: el usuario especificó **marketnow.site**. Se verificó en vivo:
   lectura completa del sitio + prueba de cada endpoint público de su API
3. **Snapshot de datos**: descarga y análisis del catálogo completo (`/api/skills.json`, 94MB,
   66.496 skills) para embeber datos reales en los MCPs
4. **Diseño del catálogo**: 126 MCPs mapeando dolores → herramientas

## 2. Hallazgos: los dolores de los agentes

### 2.1 Overflow de contexto
- **Evidencia**: issue oficial del spec MCP sobre límite de tamaño de respuestas
  ("Response size limit for MCP responses to prevent context overflow" —
  github.com/modelcontextprotocol/modelcontextprotocol)
- **MCPs**: `response-size-guard` (implementa truncado seguro elidiendo arrays),
  `context-budget`, `context-compressor`, `token-counter`, `chunker`

### 2.2 Tool overload → selección errónea
- **Evidencia**: merge.dev "6 challenges of using the Model Context Protocol (MCP)":
  "Your AI agents will struggle to determine the best tools to call... will either make
  the wrong calls or fail"
- **MCPs**: `tool-registry` (catálogo local), `tool-router` (ruteo por intención)

### 2.3 Fallos silenciosos / observabilidad
- **Evidencia**: Fiddler AI "Your MCP Agent Is Failing Silently"; Datadog (monitoring de
  clientes MCP); Pomerium round-up de incidentes MCP
- **MCPs**: `trace-logger`, `metrics-collector`, `latency-tracker`, `error-triage`,
  `heartbeat-monitor`, `run-reporter`, `usage-analytics`, `debug-console`

### 2.4 Memoria persistente y retrieval
- **Evidencia**: arXiv "What Challenges Do Developers Face in AI Agent Systems" (2026):
  "Major Challenge 2: Retrieval, Embeddings, and Agent Memory"
- **MCPs**: `agent-memory`, `agent-memory-graph` (grafo de entidades),
  `agent-episodic-log`, `session-recall`, `working-state-store`, `scratchpad`,
  `context-rot-detector`, `attention-focus`

### 2.5 Alucinación y verificación
- **Evidencia**: Galileo "7 AI Agent Failure Modes and How to Prevent Them";
  literatura sobre self-consistency y reflexión
- **MCPs**: `claim-extractor`, `fact-consistency`, `citation-checker`,
  `consensus-voter`, `self-critic`, `output-grader`

### 2.6 JSON inválido de LLMs
- **Evidencia**: experiencia universal integrando salidas estructuradas
- **MCPs**: `json-repair` (reparación por stack de brackets + fences + comas
  colgantes), `schema-validator`, `normalize-output`, `output-diff`

### 2.7 Seguridad: prompt injection, PII, SSRF, permisos
- **Evidencia**: OWASP Top 10 LLM; OWASP MCP Cheat Sheet; Zuplo "Securing MCP Servers";
  Cerbos sobre identity/authorization en agentes
- **MCPs**: `prompt-injection-scanner` (11 patrones de inyección + sanitización),
  `pii-redactor` (14 tipos incluidos cédula/RUC ecuatorianos), `input-sanitizer`
  (Unicode invisible/Bidi), `permission-gate` (human-in-the-loop), `audit-log`
  (cadena SHA-256 tamper-evident), `sandbox-eval` (parser shunting-yard, cero eval),
  `file-guard` (anti path-traversal), `allowlist-proxy` (anti-SSRF: IPs reservadas,
  puertos peligrosos), `consent-manager` (RGPD), `threat-modeler` (STRIDE)

### 2.8 Resiliencia de red y dependencias
- **Evidencia**: rate limiting para MCP (agentgateway), timeouts y cascadas
- **MCPs**: `rate-limiter` (ventana deslizante), `circuit-breaker`
  (closed/open/half-open), `retry-orchestrator` (backoff + jitter),
  `timeout-guard`, `fallback-chain`, `queue-mcp`, `batch-runner`,
  `idempotency-guard`, `health-check-hub`, `webhook-inspector` (HMAC), `poll-watcher`

### 2.9 Cognición y gestión de la tarea
- **Evidencia**: papers de agentes sobre planning, Reflexion, calibración de
  incertidumbre (Brier score)
- **MCPs**: `plan-decompose`, `task-tracker`, `milestone-checker`,
  `decision-matrix` (+análisis de sensibilidad), `hypothesis-tracker`,
  `priority-queue` (Eisenhower), `risk-register`, `assumption-auditor`,
  `retro-analyzer`, `uncertainty-quantifier`

## 3. Hallazgos: marketnow.site (verificado en vivo)

### 3.1 Qué es
MarketNow (AliceLabs LLC, licencia source-available MNNC-1.0) se define como
**"the trust layer for agent commerce"**: *"Discovery is solved (MCP registry, Smithery,
Glama). Trust is not."*

Componentes verificados:
- **Marketplace de 66.496+ skills MCP** (130.845 tracked en el ecosistema) con trust
  scores 0-10 y *install-risk tier*
- **Sentinel v3.0**: L1 index-certification (10/10 checks: Repo Exists, Has README,
  Has Manifest, Has License, No Secrets, No Malicious Code...) + L2 deep-scan de 688
  tarballs npm (29 reglas)
- **Transparency report** (audit-report.json en vivo, fetched 2026-09-09):
  9.248 skills auditadas → 8.238 safe · 874 caution · 54 risky · 81 dangerous
- **ATC (Agent Trust Card)**: Ed25519 (RFC 8032) + JCS (RFC 8785) + 8 adaptadores de
  formato (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE) vía UTS v2.0.0
- **x402**: pagos sobre HTTP 402 · **AP2**: mandatos delegados con
  human-in-the-loop por defecto
- **Runtime Interceptor**: 5 políticas (bloquea .env, rm -rf, spawns, escrituras de
  sistema, exfiltración a webhooks)
- **OWASP MCP Cheat Sheet**: matriz de 12 controles
- Modelo económico: listado gratis, sellers conservan 80%, comisión 20%, afiliados 5%
- Soporta 13 idiomas (incluido ES) · transporte MCP remoto por SSE/WebSocket/JSON-RPC

### 3.2 API pública (todos los endpoints probados en vivo)

| Endpoint | Estado | Uso en mcp-suite |
|---|---|---|
| `GET /api/skills.json` (94MB, 66.496 skills) | 200 ✓ | `marketnow-search` (modo live + snapshot embebido de 500 top) |
| `GET /api/agent.json` (machine-readable card) | 200 ✓ | `marketnow-agent-card` |
| `GET /api/audit-report.json` (transparencia) | 200 ✓ | `marketnow-trust`, `marketnow-diff-monitor` |
| `GET /api/bundles.json` | 200 ✓ | `marketnow-bundles` |
| `GET /api/policies.json` | 200 ✓ | `marketnow-policies` |
| `GET /api/certification.json` | 200 (con redirect 308) ✓ | `marketnow-certification` |
| `GET /api/certification-scans.json` | 200 (redirect 308) ✓ | `marketnow-certification` |
| `/api/search`, `/api/owasp`, `/api/mandates` | 404 (listados en el sitio pero no live) | no usados; funcionalidad replicada localmente |

Schema de skill (de skills.json): `id, name, slug, description, category, tags, price,
currency, payment, license, verified, sentinel_score, install, author, version, doc,
capabilities, sentinel, source, l2_eligible, discovered_at`

### 3.3 Cómo mcp-suite ayuda a marketnow.site

1. **Consumo programático de su API** (10 MCPs): búsqueda con cache, clasificación de
   riesgo, bundles, políticas, certificación, monitoreo de cambios — agentes sin
   navegador pueden operar el marketplace
2. **Extensión local de su stack de confianza** (10 MCPs): ATC firmada/verificada con
   Ed25519+JCS implementados desde cero, UTS con los 8 adaptadores, pipeline de 12
   etapas de verificación, x402 y AP2 operativos en local
3. **Defensa de su perímetro de seguridad** (8 MCPs): sentinel-lite reproduce los 10
   checks L1, runtime-interceptor replica las 5 reglas de bloqueo, owasp-mcp-matrix
   trackea los 12 controles — los usuarios pueden auto-auditar ANTES de instalar
4. **Habilitación de sellers** (skill-publisher, mcp-card-registry, reputation-oracle):
   el pipeline de publicación de MarketNow gana herramientas de preparación/auditoría

## 4. Decisión de stack

- **TypeScript + SDK oficial 1.30** (probado en Node 24): estándar del ecosistema MCP
- **Transporte stdio**: máxima compatibilidad (Claude Desktop, Cursor, Cline, Continue,
  Aider) sin desplegar nada
- **Monorepo npm workspaces**: una sola instalación de dependencias para 126 servidores
- **Generador de specs declarativas**: uniformidad de helpers (ok/fail/store/fetchSmart),
  health_check automático, README y catálogo generados — cero drift entre servidores
- **dist/ precompilado**: el usuario final no compila nada
- **Persistencia local**: `~/.mcp-suite/<id>/state.json` — sin servidores externos,
  sin telemetría, sin dependencias de runtime

## 5. Limitaciones documentadas

- `pdf-text-extractor` funciona con PDFs de texto (no escaneados): requiere OCR para imágenes
- `yaml-toolkit` implementa el subconjunto práctico de YAML (escalares, listas, maps anidados, flags) — no anchors ni multi-doc
- `token-counter` usa heurística local (chars/4 vs palabras/0.75, máximo de ambos): aproximado sin tokenizer
- `xml-toolkit` parser recursivo propio: no valida namespaces ni DTD/XSD
- `marketnow-search` modo live descarga ~94MB la primera vez (cache 7 días)
- Tasas de cambio de `currency-convert`: live con fallback aproximado offline
- Los MCPs de trust implementan ATC/UTS desde la documentación pública de MarketNow:
  verificación formal contra su test-suite oficial queda como trabajo futuro

---

# 🔬 OLA 2 — Investigación de dolores FUTUROS y gap analysis del ecosistema

Fecha: 2026-09-30. Objetivo: identificar qué YA existe en el ecosistema MCP,
qué dolores de agentes están emergiendo para 2026-2027 y qué falta por construir.

## 6. Metodología de la Ola 2

1. **Búsqueda web dirigida** (8 queries): landscape de servidores MCP populares,
   gaps del ecosistema, fallos multi-agente, computer use, evaluación de agentes,
   context engineering, comercio agéntico, compliance para agentes regulados
   (evidencia en `/home/z/my-project/research/wave2/*.json`)
2. **Gap analysis**: cruce del ecosistema encontrado vs los 126 MCPs existentes
3. **Diseño de 55 servidores supercompletos** (6-9 tools reales c/u, 273 tools +
   health_check) en 10 categorías nuevas → 181 totales

## 7. Qué YA existe en el ecosistema (saturado)

- **Integraciones SaaS dominan**: GitHub, Slack, Notion, Google Workspace, Salesforce,
  HubSpot, Jira, Stripe, Docker Hub, Ahrefs ("Best MCP Servers in 2026", 4 listas
  distintas consultadas) — espacios tomados por los propios vendors
- **Hubs/remotos**: WayStation ("connect with 10,000+ tools"), conectores universales
- **Búsqueda**: Exa, Brave, Vectara — resuelto
- **Observabilidad/eval como SaaS cloud-only**: Langfuse, Braintrust, Helicone, Galileo,
  Fiddler, Arize Phoenix, Weave, Agenta, Maxim AI, Confident AI, Vellum — TODAS
  plataformas cloud; ninguna primitiva local ejecutable por el propio agente

## 8. Los dolores FUTUROS identificados (con fuente)

| # | Dolor futuro | Evidencia | Cobertura ecosistema |
|---|---|---|---|
| 1 | Fallos de coordinación multi-agente: deadlocks, inconsistencia de estado, contentión de recursos, costes de coordinación exponenciales | "Types of Multi-Agent System Failures: 7 Common Failures" (ago-2026); "Why Multi-Agent AI Systems Fail" (dic-2025) | ninguna tool local |
| 2 | Spec ambiguity como causa raíz #1 | "Most multi-agent LLM systems fail from spec ambiguity and coordination gaps, not infrastructure" (sep-2025) | ninguna |
| 3 | Deriva de objetivos en horizonte largo | gradient-dissent: "the fifteen-id literal was written before its failure existed. The drift began the next day" (2026) | ninguna |
| 4 | Costos de tokens en espiral ("dust") | "The Hidden Cost of Dust in Enterprise AI for 2026" (sep-2026); "stop sending the model data it doesn't need" (ago-2026) | solo dashboards SaaS |
| 5 | Eval-as-code local | plataformas SaaS de eval/observabilidad (10+ encontradas, 0 locales) | GAP total |
| 6 | Computer use confiable | fallos por DOM cambiante, selectores frágiles, acciones destructivas | servers de navegador existen; la FIABILIDAD no |
| 7 | Aprendizaje de lecciones entre sesiones | agents repiten errores idénticos | ninguna |
| 8 | Takeover/interrupción humana estructurada | patrones HITL emergentes | ninguna |
| 9 | Frescura temporal del conocimiento | hechos sin fecha de caducidad | ninguna |
| 10 | Compliance para agentes regulados | "Compliance layer for AI agents in regulated industries" (5 días antes de la búsqueda) | EMERGIENDO — gap confirmado |

## 9. Decisiones de diseño de la Ola 2

- **Supercompletos**: 6-9 tools por servidor (media Ola 1: ~3.7) con lógica real:
  detección de ciclos (DFS), clustering lexical (Jaccard), regresión lineal para drift,
  Borda ponderado, matching multi-factor para selector healing, vida media por clase de hecho
- **Todo local y auditario**: ninguna tool nueva requiere red; el estado persiste en
  `~/.mcp-suite/<id>/state.json` (privado, sin telemetría)
- **Ingeniería del generador mejorada**: fixup automático TS-safe (helpers `__vals/__ents`
  tipados, aritmética de Date → `.getTime()`, `Map<any,any>`) + doble-escape de regexes
  dentro de template literals (89 correcciones) — verificado con 181/181 compilaciones
- **Pruebas funcionales idempotentes**: 110/110 con unicidad por corrida (timestamped)
  y resolución de dependencias entre llamadas vía estado persistente

## 10. Pricing de la Ola 2 (kit de publicación)

Distribución final sobre 181: Free 33 · Standard 63 · Multi-feature 22 ·
Sophisticated 44 · Enterprise 19. Ingreso máximo por venta de catálogo completo:
$480.42 (80% vendedor). Rationale por servidor en `publish/pricing-plan.json`.

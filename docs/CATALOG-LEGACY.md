# 🧰 MCP Suite — 229 servidores MCP modernos para agentes IA

> **229 servidores MCP · 1035 tools · 30 categorías · 100% TypeScript · stdio · probados 229/229**
>
> **Ola 1 (126)**: dolores actuales de agentes + integración MarketNow.site.
> **Ola 2 (55, supercompletos)**: dolores FUTUROS — coordinación multi-agente, drift de
> objetivos, spec ambiguity, eval-as-code, economía de tokens, computer-use, aprendizaje
> de lecciones, takeover humano, frescura del conocimiento y compliance ejecutable.
> **Ola 3 (48, supercompletos)**: la capa que nadie ha construido — pre-vuelo de acciones
> (blast radius/dry-run/rollback), comercio A2A completo (escrow/SLA/metering/negociación),
> identidad federada (DID/delegación/rotación), Agent CI/CD (versionado/canary), multimodal
> y voz, multi-tenant con aislamiento, razonamiento estructurado y auto-mejora del agente.
>
> Nacido de investigación real sobre los **dolores de los agentes IA** y construido alrededor de
> **[marketnow.site](https://marketnow.site)** — *the trust layer for agent commerce* —
> el marketplace de 66.496+ skills MCP con escaneo Sentinel, trust scores y pagos x402.
>
> 🚀 **Kit de publicación incluido**: los 229 MCPs tienen **precios asignados** (tiers oficiales
> de MarketNow: Free/$1.99/$2.99/$4.99/$9.99) y están listos para publicarse en el marketplace
> como agente. Ver **`publish/PUBLISH-GUIDE.md`**.

```
┌───────────────────────────────────────────────────────────────────┐
│  MARKETNOW (28)           │  DOLORES DE AGENTES (98)  · OLA 1     │
│  ├─ API viva (10)         │  ├─ Memoria y Contexto (12)           │
│  ├─ Trust Infra (10)      │  ├─ Resiliencia de Tools (13)         │
│  │   ATC·Ed25519·JCS      │  ├─ Calidad de Salida (12)            │
│  │   UTA·x402·AP2         │  ├─ Seguridad (11)                    │
│  └─ Ops & Seguridad (8)   │  ├─ Observabilidad (10)               │
│                           │  ├─ Datos y Extracción (14)           │
│  DOLORES FUTUROS (55)     │  ├─ Cognición y Planificación (10)    │
│  · OLA 2 supercompletos   │  ├─ Comunicación y Humano (8)         │
│  ├─ Multi-Agente (15)     │  └─ Utilidades (8)                    │
│  ├─ Objetivos/Drift (14)  │                                       │
│  ├─ Specs (5)             │  DOLORES FUTUROS (48) · OLA 3         │
│  ├─ Evaluación (12)       │  ├─ Pre-Vuelo de Acciones (6)         │
│  ├─ Economía (12)         │  ├─ Comercio A2A (6)                  │
│  ├─ Computer Use (5)      │  ├─ Identidad Federada (5)             │
│  ├─ Habilidades (5)       │  ├─ Agent CI/CD (6)                    │
│  ├─ Humano/Bucle (5)      │  ├─ Multimodal & Voz (6)              │
│  ├─ Frescura (4)          │  ├─ Multi-Tenant (5)                   │
│  └─ Cumplimiento (4)      │  ├─ Razonamiento (7)                   │
│                           │  └─ Auto-Mejora (7)                    │
│  Enterprise: 27 · Sophisticated: 80                                │
│  Multi-feature: 22 · Standard: 63                                  │
│  Free: 37 — ingreso máx $688 (80%)                                 │
│                                                                    │
│  229 MCPs · 1035 tools · 30 categorías                             │
└───────────────────────────────────────────────────────────────────┘
```

## ⚡ Inicio rápido

```bash
# 1. Requisitos: Node 18+ (probado en Node 24)
node -v

# 2. Dependencias + compilación + registro en tu cliente MCP
./install.sh                      # macOS / Linux
node install.mjs --client claude  # directo (claude | cursor | windsurf | claude-code)

# 3. Variantes
node install.mjs --client claude --category "MarketNow"         # solo la categoría MarketNow
node install.mjs --client cursor --only safe-math,json-repair   # servidores específicos
node install.mjs --list                                         # ver el catálogo completo
node install.mjs --client claude --remove                       # desinstalar
```

Tras instalar **reinicia Claude Desktop / Cursor** y prueba:
> "usa la tool health_check del servidor safe-math"

Cada servidor incluye una tool `health_check` para diagnóstico instantáneo.

## 🔬 Por qué estos 126 MCP (la investigación)

### 1) Los dolores de los agentes (investigación web, sept 2026)

| Dolor documentado | Fuente | MCPs que lo atacan |
|---|---|---|
| Context overflow: respuestas MCP gigantes rompen el contexto | GitHub modelcontextprotocol #58 | `response-size-guard`, `context-budget`, `context-compressor`, `token-counter` |
| Tool overload: con 100+ tools el modelo elige mal | merge.dev — "6 challenges of MCP" | `tool-registry`, `tool-router` |
| Fallos silenciosos sin observabilidad | Fiddler — "Your MCP Agent Is Failing Silently" | `trace-logger`, `metrics-collector`, `error-triage`, `heartbeat-monitor`, `latency-tracker` |
| Alucinación de hechos y citas | Galileo — 7 AI Agent Failure Modes | `claim-extractor`, `fact-consistency`, `citation-checker`, `consensus-voter` |
| JSON inválido de los LLMs | experiencia universal | `json-repair`, `schema-validator`, `normalize-output` |
| Memoria y retrieval persistentes | arXiv — "What Challenges Do Developers Face in AI Agent Systems" | `agent-memory`, `agent-memory-graph`, `session-recall`, `working-state-store` |
| Prompt injection (OWASP LLM #1) | OWASP | `prompt-injection-scanner`, `input-sanitizer`, `allowlist-proxy` |
| Rate limits, timeouts, cascadas de fallos | Zuplo, agentgateway | `rate-limiter`, `timeout-guard`, `circuit-breaker`, `retry-orchestrator`, `fallback-chain` |
| Coste de tokens invisible | — | `cost-tracker`, `usage-analytics` |
| PII y compliance | — | `pii-redactor`, `consent-manager`, `data-anonymizer` |

### 1b) Los dolores FUTUROS de los agentes (Ola 2 — investigación sept 2026)

Gap analysis del ecosistema: las integraciones SaaS (GitHub/Slack/Notion/Stripe) están
saturadas y la observabilidad/eval es SaaS cloud-only (Langfuse, Braintrust, Helicone,
Galileo, Maxim, Confident AI). **Lo que falta es infraestructura transversal LOCAL**:

| Dolor futuro documentado | Fuente | MCPs de la Ola 2 que lo atacan |
|---|---|---|
| Fallos multi-agente: deadlocks, inconsistencia de estado, contentión, costes de coordinación exponenciales | "7 Common Multi-Agent Failures" (ago-2026) | `agent-org-chart`, `delegation-contracts`, `handoff-protocol`, `blackboard-shared`, `deadlock-detector`, `conflict-resolver`, `quorum-coordinator`, `agent-supervisor` |
| "Fail from spec ambiguity and coordination gaps, not infrastructure" | Why Multi-Agent AI Systems Fail (sep-2025) | `spec-clarifier`, `acceptance-criteria`, `definition-of-done`, `spec-diff-impact`, `requirements-matrix` |
| Deriva de objetivos en misiones largas ("the drift began the next day") | gradient-dissent (2026) | `goal-contract`, `drift-detector`, `commitment-ledger`, `scope-guard`, `time-horizon-planner`, `progress-journal`, `mission-checkpoint` |
| Eval solo existe como SaaS cloud; falta eval-as-code local | Confident AI, Vellum, Maxim (2026) | `golden-set`, `regression-harness`, `prompt-ab-test`, `quality-drift-monitor`, `scenario-simulator`, `failure-tagger` |
| "Hidden cost of dust": espiral de costos de tokens en enterprise | The Hidden Cost of Dust (sep-2026) | `spend-envelope`, `task-roi`, `token-audit`, `model-router-econ`, `budget-forecast`, `cost-attribution` |
| Computer use frágil: DOM que cambia, selectores rotos, acciones destructivas sin undo | — | `dom-baseline`, `selector-healer`, `action-recorder`, `checkpoint-undo`, `viewport-verifier` |
| Los agentes repiten errores: las lecciones no sobreviven la sesión | — | `postmortem-engine`, `lesson-library`, `mistake-patterns`, `skill-forge`, `competency-tracker` |
| Interrupciones/takeover humano sin protocolo; confianza sin calibrar | — | `interruption-broker`, `takeover-request`, `trust-calibrator`, `escalation-policy`, `explain-decision` |
| Hechos sin validez temporal: mezclan 2019 con 2026 | — | `fact-staleness`, `source-timeline`, `deadline-engine`, `temporal-reasoner` |
| Compliance para agentes en industrias reguladas (gap emergente) | "Compliance layer for AI agents" (2026) | `policy-as-code`, `data-residency-check`, `consent-ledger`, `compliance-report` |

### 1c) La capa que falta (Ola 3 — gap analysis post-ola-2, sept 2026)

Tras las olas 1-2 quedaron huecos que NADIE cubre en local. La ola 3 los cierra:

| Gap del ecosistema | Por qué importa en 2026+ | MCPs de la Ola 3 |
|---|---|---|
| Sin pre-vuelo: los agentes ejecutan acciones destructivas sin estimar radio de impacto ni ensayar | La seguridad de agentes pide "pre-flight checks" y compensación de efectos | `blast-radius-estimator`, `dry-run-executor`, `side-effect-ledger`, `reversibility-planner`, `precondition-checker`, `action-limiter` |
| El comercio A2A se queda en pagos (x402): sin custodia, ni SLA medible, ni facturación | La economía agéntica exige el ciclo contractual completo | `escrow-agent`, `sla-contract-manager`, `metering-station`, `quote-negotiator`, `dispute-resolver`, `settlement-ledger` |
| Identidad de agentes opaca: sin DID, ni delegación verificable, ni rotación de claves | Cruzar fronteras organizativas con identidad auditable | `did-resolver`, `delegation-chain`, `key-rotation-manager`, `agent-passport`, `scope-minting` |
| Los prompts se editan a mano sin versionado, canary ni rollback | El prompt es el código más editado y el menos gestionado | `prompt-versioner`, `canary-deployer`, `rollback-manager`, `prompt-dependency-graph`, `change-changelog`, `env-diff-checker` |
| Multimodal sin presupuesto: transcripts kilométricos y assets que revientan el contexto | Los agentes de voz necesitan turn-taking y pacing gobernados | `transcript-condenser`, `av-budget-packer`, `turn-state-machine`, `speech-pacing`, `image-batch-tagger`, `caption-aligner` |
| Un agente para varios inquilinos = fuga silenciosa de datos | El aislamiento multi-tenant no es prompt, es infraestructura | `tenant-isolator`, `tenant-quota-manager`, `noisy-neighbor-detector`, `tenant-data-tagger`, `cross-tenant-guard` |
| Argumentos fluidos pero sin estructura verificable (warrants faltantes, correlación→causa) | La escalera de Pearl y Toulmin aplicadas al razonamiento del agente | `argument-cartographer`, `bayesian-updater`, `counterfactual-lab`, `causal-ladder`, `analogy-finder`, `pareto-tradeoff`, `occam-razor` |
| El agente repite errores porque sus fallos nunca se agrupan ni se excavan | La auto-mejora exige taxonomía, RCA y práctica deliberada | `error-taxonomy`, `root-cause-tree`, `reflection-journal`, `prompt-self-rewriter`, `behavior-diff`, `capability-gap-scanner`, `growth-plan` |

### 2) MarketNow.site — el sitio real (verificado en vivo)

MarketNow es la **capa de confianza para el comercio entre agentes**:

- **66.496+ skills MCP** indexadas, 130.845 tracked en el ecosistema
- **Sentinel**: L1 index-certification (10/10 checks) + L2 deep-scan de tarballs (29 reglas)
- **Trust scores 0-10** e *install-risk tier* en cada skill (audit-report real: 8.238 safe / 874 caution / 54 risky / 81 dangerous sobre 9.248 auditadas)
- **ATC (Agent Trust Card)**: identidad de agente con Ed25519 (RFC 8032) + JCS (RFC 8785)
- **UTA**: *Universal Trust Adapter* — traduce 8 formatos de credencial (ATC, W3C-VC, OAuth, SPIFFE, MCP Card, A2A, ZTA, EAT-AI)
- **x402 / AP2**: pagos HTTP-402 y mandatos delegados human-in-the-loop
- **API pública machine-readable**: `/api/skills.json`, `/api/agent.json`, `/api/audit-report.json`, `/api/bundles.json`, `/api/policies.json`, `/api/certification.json` — todas en vivo y usadas por estos MCPs

**Cómo ayudan estos MCPs a marketnow.site:**

1. **Consumo de su API**: `marketnow-search` (busca 66k skills con snapshot local + cache de 94MB), `marketnow-trust`, `marketnow-bundles`, `marketnow-policies`, `marketnow-certification`, `marketnow-diff-monitor` (vigila cambios del marketplace)
2. **Extienden su stack de confianza**: implementan ATC, JCS, Ed25519, x402, AP2, verification-pipeline (12 etapas) como software local y verificable
3. **Cubren su misión de seguridad**: `sentinel-lite` (10 checks L1 reproducibles), `install-risk`, `runtime-interceptor` (las 5 reglas de bloqueo), `owasp-mcp-matrix`, `secrets-audit`
4. **Preparan skills para publicar**: `skill-publisher`, `mcp-card-registry`, `reputation-oracle` — los sellers de MarketNow pueden auditar ANTES de publicar

## 🗂️ Catálogo completo (229)

### 🛒 MarketNow — API viva (10)
`marketnow-agent-card` · `marketnow-search` · `marketnow-trust` · `marketnow-install-planner` · `marketnow-bundles` · `marketnow-policies` · `marketnow-certification` · `marketnow-diff-monitor` · `marketnow-recommend` · `marketnow-quickstart`

### 🔐 MarketNow — Trust Infrastructure (10)
`ed25519-toolbox` (RFC 8032 real) · `jcs-canonicalizer` (RFC 8785) · `atc-agent-trust-card` (crear/verificar cards firmadas) · `uts-trust-adapter` (8 formatos) · `verification-pipeline` (12 etapas) · `x402-payments` · `ap2-mandates` · `a2a-agent-card` · `w3c-vc-kit` · `trust-gateway`

### 🛡️ MarketNow — Ops & Seguridad (8)
`sentinel-lite` · `install-risk` · `runtime-interceptor` · `owasp-mcp-matrix` · `skill-publisher` · `secrets-audit` · `mcp-card-registry` · `reputation-oracle`

### 🧠 Memoria y Contexto (12)
`agent-memory` · `agent-memory-graph` · `agent-episodic-log` · `context-compressor` · `context-budget` · `conversation-summarizer` · `scratchpad` · `working-state-store` · `session-recall` · `token-counter` · `context-rot-detector` · `attention-focus`

### 🔄 Resiliencia de Tools (13)
`tool-registry` · `tool-router` · `retry-orchestrator` · `circuit-breaker` · `rate-limiter` · `timeout-guard` · `fallback-chain` · `queue-mcp` · `batch-runner` · `health-check-hub` · `idempotency-guard` · `webhook-inspector` · `poll-watcher`

### ✅ Calidad de Salida (12)
`json-repair` (stack de brackets) · `schema-validator` · `output-grader` · `citation-checker` · `claim-extractor` · `fact-consistency` · `self-critic` · `consensus-voter` · `output-diff` · `normalize-output` · `text-qa` · `response-size-guard`

### 🔒 Seguridad (11)
`prompt-injection-scanner` · `pii-redactor` (cédulas/RUC EC) · `input-sanitizer` · `permission-gate` · `audit-log` (cadena de hash) · `sandbox-eval` (shunting-yard, sin eval) · `file-guard` · `tos-checker` · `allowlist-proxy` (SSRF) · `consent-manager` · `threat-modeler` (STRIDE)

### 📈 Observabilidad (10)
`trace-logger` · `metrics-collector` · `cost-tracker` · `latency-tracker` · `run-reporter` · `error-triage` · `heartbeat-monitor` · `experiment-log` · `usage-analytics` · `debug-console`

### 📊 Datos y Extracción (14)
`robust-fetcher` · `html-to-markdown` · `readability-extract` · `table-extractor` · `csv-toolkit` · `json-toolkit` (jsonpath) · `xml-toolkit` · `yaml-toolkit` · `markdown-toolkit` · `pdf-text-extractor` (zlib+Tj/TJ) · `url-inspector` · `diff-detector` · `chunker` · `data-anonymizer` (k-anonimidad)

### 🎯 Cognición y Planificación (10)
`plan-decompose` · `task-tracker` · `milestone-checker` · `decision-matrix` (sensibilidad) · `hypothesis-tracker` · `priority-queue` (Eisenhower) · `risk-register` · `assumption-auditor` · `retro-analyzer` · `uncertainty-quantifier` (Brier)

### 💬 Comunicación y Humano (8)
`human-approval` · `feedback-loop` · `report-builder` · `digest-writer` · `locale-helper` (ES/EN/FR) · `tone-adjuster` · `handoff-notes` · `meeting-notes`

### 🧮 Utilidades (8)
`safe-math` (parser propio) · `stats-toolkit` · `datetime-toolkit` · `currency-convert` (tasas en vivo) · `unit-convert` · `regex-forge` (ReDoS) · `id-forge` (ULID real) · `hash-toolkit`

### 🕸️ OLA 2 · Multi-Agente y Coordinación (8)
`agent-org-chart` (8t) · `delegation-contracts` (9t) · `handoff-protocol` (8t) · `blackboard-shared` (9t) · `deadlock-detector` (7t) · `conflict-resolver` (8t) · `quorum-coordinator` (7t) · `agent-supervisor` (7t)

Deadlocks reales (grafo de esperas + resolución por víctima), contratos de delegación con
criterios verificables, handoffs con score de calidad, pizarra compartida con locks TTL,
quorum con Borda ponderado y supervisión de sub-agentes con presupuesto.

### 🎯 OLA 2 · Objetivos y Largo Plazo (7)
`goal-contract` (8t) · `drift-detector` (6t) · `commitment-ledger` (7t) · `scope-guard` (6t) · `time-horizon-planner` (7t) · `progress-journal` (6t) · `mission-checkpoint` (7t)

El objetivo se declara UNA vez (criterios inmutables), la deriva se mide por decisión,
los compromisos vencen auditablemente, el scope creep se detecta ANTES de gastar tokens
y las misiones largas tienen checkpoints reanudables.

### 📋 OLA 2 · Especificación y Requisitos (5)
`spec-clarifier` (6t) · `acceptance-criteria` (6t) · `definition-of-done` (5t) · `spec-diff-impact` (5t) · `requirements-matrix` (7t)

La causa raíz #1 de fallo multi-agente es spec ambiguity: estas tools detectan vaguedad
léxicamente, generan preguntas bloqueantes, convierten requests en GIVEN/WHEN/THEN y
calculan el impacto de cambiar la spec a mitad de ejecución.

### 🧪 OLA 2 · Evaluación Continua (6)
`golden-set` (7t) · `regression-harness` (6t) · `prompt-ab-test` (6t) · `quality-drift-monitor` (6t) · `scenario-simulator` (6t) · `failure-tagger` (6t)

Eval-as-code LOCAL (el ecosistema solo ofrece SaaS): golden sets con 4 métodos de match,
regresión de comportamiento contra baseline, A/B de prompts con significancia aproximada,
monitor de drift de calidad con regresión lineal y simulador de escenarios de estrés.

### 💸 OLA 2 · Economía del Agente (6)
`spend-envelope` (6t) · `task-roi` (5t) · `token-audit` (5t) · `model-router-econ` (5t) · `budget-forecast` (5t) · `cost-attribution` (5t)

Sobres de gasto con autorización escalonada, ROI por tarea, auditoría de tokens partida
por partida (system/historial/retrieval/tools), ruteo por costo-capacidad, forecast de
burn-rate y atribución de costo por cliente/proyecto.

### 🖥️ OLA 2 · Computer Use (5)
`dom-baseline` (5t) · `selector-healer` (5t) · `action-recorder` (6t) · `checkpoint-undo` (6t) · `viewport-verifier` (5t)

Baselines de DOM con diff de elementos críticos, healing de selectores por similitud
multi-factor, grabación/replay verificada, checkpoints ANTES de acciones destructivas
y verificación de estado visible (deja de asumir que la acción funcionó).

### 🎓 OLA 2 · Aprendizaje de Habilidades (5)
`postmortem-engine` (6t) · `lesson-library` (6t) · `mistake-patterns` (5t) · `skill-forge` (6t) · `competency-tracker` (5t)

Postmortems que se convierten en lecciones recuperables por situación, clustering de
patrones de error ("la tercera vez ya no es mala suerte"), forging de skills versionadas
con tasa de éxito y matriz de competencias que decide qué delegar sin supervisión.

### 🤝 OLA 2 · Humano en el Bucle (5)
`interruption-broker` (5t) · `takeover-request` (5t) · `trust-calibrator` (5t) · `escalation-policy` (6t) · `explain-decision` (5t)

Interrupciones con snapshot y replanificación, paquetes de takeover mínimos (no volcar
todo el historial), confianza calibrada por dominio con evidencia, política de escalamiento
con cooldown anti-spam y explicación post-hoc de decisiones con banderas de auditoría.

### ⏳ OLA 2 · Frescura del Conocimiento (4)
`fact-staleness` (6t) · `source-timeline` (5t) · `deadline-engine` (5t) · `temporal-reasoner` (5t)

Cada hecho tiene vida media según su clase (precio 7d, métrica 30d, estructural ∞),
las fuentes se ordenan en timeline con detección de contradicciones cronológicas,
los deadlines calculan prioridad dinámica y el razonamiento temporal valida secuencias.

### ⚖️ OLA 2 · Cumplimiento (4)
`policy-as-code` (5t) · `data-residency-check` (4t) · `consent-ledger` (5t) · `compliance-report` (5t)

Políticas ejecutables (más restrictivo gana, con auditoría por decisión), residencia de
datos por jurisdicción, ledger de consentimientos con purpose-limitation y reportes de
cumplimiento por marco con evidencia ligada. El gap emergente del ecosistema 2026.

### 🛫 OLA 3 · Pre-Vuelo de Acciones (6)
`blast-radius-estimator` (6t) · `dry-run-executor` (5t) · `side-effect-ledger` (6t) · `reversibility-planner` (5t) · `precondition-checker` (5t) · `action-limiter` (5t)

Antes de ejecutar: grafo de dependencias con propagación transitiva del radio de impacto,
ensayo de planes (precondiciones, lecturas inexistentes, destructivos sin compensación),
libro mayor de efectos con receta de deshacer (LIFO), taxonomía reversible/compensable/
irreversible, puerta GO/NO-GO y limitador local de acciones destructivas inapelable.

### 💰 OLA 3 · Comercio A2A (6)
`escrow-agent` (9t) · `sla-contract-manager` (5t) · `metering-station` (5t) · `quote-negotiator` (6t) · `dispute-resolver` (6t) · `settlement-ledger` (5t)

El ciclo contractual completo entre agentes: custodia con máquina de estados
(CREADO→BLOQUEADO→ENTREGADO→LIBERADO/EN_DISPUTA), SLAs con p95 y detección de brecha
reclamable, medición facturable con tarifas por tramos, negociación con precio de
reserva/BATNA/concesión decreciente, disputas con evidencia ponderada y conciliación
de liquidaciones con informe de antigüedad.

### 🪪 OLA 3 · Identidad Federada (5)
`did-resolver` (7t) · `delegation-chain` (5t) · `key-rotation-manager` (5t) · `agent-passport` (6t) · `scope-minting` (6t)

DIDs locales con firma/verificación HMAC y revocación, cadenas de delegación con
expiración/estrechamiento/profundidad máxima, rotación de claves con ventana de gracia
(la vieja verifica mientras la nueva firma), pasaporte portable con claims sellados y
checksum de integridad, y tokens de capacidad de mínimo privilegio con nonce y usos.

### 🔄 OLA 3 · Agent CI/CD (6)
`prompt-versioner` (6t) · `canary-deployer` (5t) · `rollback-manager` (5t) · `prompt-dependency-graph` (5t) · `change-changelog` (5t) · `env-diff-checker` (4t)

Versionado semántico de prompts con diff línea a línea, canary A/B con banda de
tolerancia (PROMOVER/MANTENER/ABORTAR), snapshots de configuración con restauración
verificada por hash, análisis de impacto transitivo del grafo de dependencias,
changelog Keep-a-Changelog y caza de drift entre entornos con riesgo clasificado.

### 🎙️ OLA 3 · Multimodal & Voz (6)
`transcript-condenser` (6t) · `av-budget-packer` (5t) · `turn-state-machine` (5t) · `speech-pacing` (5t) · `image-batch-tagger` (5t) · `caption-aligner` (5t)

Condensación de transcripciones que conserva decisiones/acciones/compromisos textual,
mochila de assets por densidad de valor con sugerencias de downsample, máquina de
estados de turnos con barge-in, pacing SSML (cifras ralentizan y pausan largo),
lotes de imágenes con sensibilidad obligatoria y alineación caption↔transcript.

### 🏢 OLA 3 · Multi-Tenant (5)
`tenant-isolator` (5t) · `tenant-quota-manager` (5t) · `noisy-neighbor-detector` (4t) · `tenant-data-tagger` (5t) · `cross-tenant-guard` (4t)

Binding sesión→tenant inmutable, cuotas duras por ventana diaria, índice de equidad
tipo Gini y detección del vecino ruidoso contra la mediana de los demás, etiquetado de
datos con herencia en derivados (la etiqueta se propaga o no es confianza) y guardián
de flujos cruzados fail-closed donde PII nunca cruza.

### 🧮 OLA 3 · Razonamiento Estructurado (7)
`argument-cartographer` (5t) · `bayesian-updater` (5t) · `counterfactual-lab` (4t) · `causal-ladder` (4t) · `analogy-finder` (4t) · `pareto-tradeoff` (4t) · `occam-razor` (4t)

Mapas de Toulmin con huecos lógicos y superficie de ataque, actualización bayesiana en
log-odds con traza explicable y detección de doble conteo, contrafactuales ceteris
paribus con comparación de mundos, escalera de Pearl que exige el método correcto por
peldaño, analogías estructurales (relaciones, no palabras), frontera de Pareto con punto
rodilla y navaja de Occam cuantificada (la simplicidad es el desempate, no el criterio).

### 🌱 OLA 3 · Auto-Mejora (7)
`error-taxonomy` (5t) · `root-cause-tree` (5t) · `reflection-journal` (4t) · `prompt-self-rewriter` (5t) · `behavior-diff` (4t) · `capability-gap-scanner` (4t) · `growth-plan` (5t)

Clustering de errores por firma (el error 47 y el 3 son el mismo), cinco porqués
disciplinados con validación de cadena, diario de reflexión que promueve lecciones
repetidas, auto-edición de prompts con guardarrailes (el agente no puede debilitar sus
restricciones) y puerta de medición, diff de comportamiento entre períodos, escáner de
capacidades exigidas vs disponibles ANTES de empezar y práctica deliberada con criterio
binario de éxito.

## 🏗️ Arquitectura

```
mcp-suite/
├── tools/
│   ├── specs/            # 30 categorías · 35 archivos de specs declarativas
│   │   └── 01-marketnow-api-a.mjs ... 49-auto-mejora-b.mjs
│   ├── generator.mjs     # genera cada servidor desde su spec
│   ├── build.mjs         # compila todos (tsc, concurrencia 8)
│   ├── smoke.mjs         # handshake MCP real × 229
│   ├── functional-test.mjs         # 32 pruebas (ola 1)
│   ├── functional-test-wave2.mjs   # 110 pruebas (ola 2)
│   └── functional-test-wave3.mjs   # 207 pruebas (ola 3)
├── servers/m             # mcp-<id>/ × 126
│   └── mcp-safe-math/
│       ├── src/index.ts  # fuente TypeScript legible y editable
│       ├── dist/index.js # compilado, listo para usar
│       ├── data/         # datos embebidos (ej: snapshot de 500 skills)
│       ├── package.json  # @mcp-suite/safe-math (workspaces)
│       └── README.md     # doc del servidor individual
├── install.mjs           # instalador multi-cliente
├── install.sh            # wrapper con verificación de entorno
├── catalog.json          # catálogo machine-readable (464 tools)
└── RESEARCH.md           # la investigación detrás
```

**Filosofía**: specs declarativas → generador → servidores uniformes. Cada servidor es
standalone (solo depende de `@modelcontextprotocol/sdk` + `zod`, hoisted por workspaces),
tiene su `dist/` precompilado (cero build para el usuario) y su `health_check`.

- **Estado persistente**: los servidores con estado guardan en `~/.mcp-suite/<id>/state.json` (local y privado)
- **Datos embebidos**: `marketnow-search` incluye snapshot de 500 skills top (offline instantáneo) + modo live con cache de 7 días
- **Red**: solo los MCPs con fetch documentado hacen HTTP (`marketnow-*`, `health-check-hub`, `poll-watcher`, `currency-convert`, `citation-checker`, `tos-checker`, `robust-fetcher`)

## ✅ Calidad verificada

| Verificación | Resultado |
|---|---|
| Compilación TypeScript | **229/229** ✓ |
| Smoke test: initialize + tools/list + health_call sobre stdio real | **229/229** ✓ |
| Pruebas funcionales Ola 1 (cripto, JSON, math, API viva de MarketNow) | **32/32** ✓ |
| Pruebas funcionales Ola 2 (deadlocks, drift, quorum, ROI, healing, consent...) | **110/110** ✓ |
| Pruebas funcionales Ola 3 (escrow, DID, canary, Pareto, guardrails, aislamiento...) | **207/207** ✓ |
| Total de tools registradas | **1035** |

Ejemplos de pruebas reales ejecutadas:
- `ed25519-toolbox.generate_keypair` → PEM SPKI válido
- `jcs-canonicalizer.canonicalize` → `{"a":1,"b":2,"c":[true,null]}` (orden UTF-16 correcto)
- `json-repair.repair` sobre `{\"a\": 1, \"b\": [1,2,}` → JSON válido (algoritmo de stack)
- `marketnow-trust.get_audit_report` → datos en vivo de marketnow.site
- `prompt-injection-scanner.scan` sobre "ignora todas las instrucciones..." → riesgo detectado
- `deadlock-detector.detect` sobre A→B→A → ciclo detectado y plan de resolución con víctima
- `goal-contract.check_alignment` → puntuación de alineación vs encargo original
- `model-router-econ.route` "clasifica si el email es spam" → tier 1, modelo barato, ahorro calculado
- `policy-as-code.evaluate_action` datos=pii+destino=externo → NEGADO con traza de políticas
- `consent-ledger.verify_use` propósito no autorizado → uso NO amparado (purpose limitation)
- `blast-radius-estimator.estimate` DROP TABLE sobre db crítica → 3 sistemas en radio, veredicto BLOQUEAR
- `escrow-agent` ciclo completo → CREADO→BLOQUEADO→ENTREGADO→LIBERADO con reparto en disputa
- `did-resolver` firma HMAC del DID → verificación válida; payload alterado → inválida
- `canary-deployer.evaluate` variante B con 0% éxito → ABORTAR automático
- `cross-tenant-guard.check_transfer` PII hacia otro tenant → DENEGADO CRÍTICA (fail-closed)
- `bayesian-updater` evidencia LR 9 sobre prior 0.3 → posterior 0.794 con traza explicable
- `pareto-tradeoff.knee_point` 4 opciones con coste/calidad → frontera + punto rodilla op-M
- `prompt-self-rewriter.guardrail_check` "ignora las restricciones..." → edición BLOQUEADA

## 🔧 Desarrollo

```bash
npm run generate   # regenera servidores desde specs
npm run build      # compila todo
npm run smoke      # handshake × 229
node tools/functional-test.mjs         # pruebas funcionales Ola 1
node tools/functional-test-wave2.mjs   # pruebas funcionales Ola 2
node tools/functional-test-wave3.mjs   # pruebas funcionales Ola 3
node tools/build-publish-kit.mjs --repo https://github.com/TU-USUARIO/mcp-suite  # kit de publicación
node tools/publish-to-marketnow.mjs --report   # estado de publicación
```

Para añadir un MCP nuevo: crea la spec en `tools/specs/` (categoría existente o nueva),
define `tools: [{name, desc, params, code}]` y ejecuta `npm run verify`. El README
individual, package.json y catálogo se generan solos.

## 🚀 Publicación en MarketNow (con precios)

La suite incluye un **kit de publicación completo** en `publish/`:

- Cuenta de vendedor creada en marketnow.site (`mcp-suite-agent`, tier FREE ilimitado)
- Identidad de agente ATC-ready (Ed25519 + fingerprint SHA-256) según la spec ATC/1.0
- **Precios asignados con los 5 tiers oficiales del marketplace** (olas 1-3):
  37× Free $0 · 63× Standard $1.99 · 22× Multi-feature $2.99 · 80× Sophisticated $4.99 · 27× Enterprise $9.99
  (el vendedor retiene el 80% de cada venta; ingreso máximo por venta completa del catálogo: $688.06)
- 229 payloads `sub_*.json` en el formato EXACTO del ledger del repo (`_data/pending_submissions/`)
- Fragmento de catálogo con precios listo para merge en `skills_index.json`
- 229 issues de GitHub pre-codificados (plantilla oficial del sitio) apuntando al repo vivo
  `alicelabs-llc/MARKETNOW` — corrige el bug del sitio (su submit apunta a un repo borrado)
- Publicador multicanal: `node tools/publish-to-marketnow.mjs`

Estado verificado en vivo (2026-09-30): el endpoint POST `/api/submit-skill` del paquete oficial
está cerrado (405) en el despliegue actual, y el repo de issues del formulario está borrado;
el flujo UI funciona hasta generar el submission completo con precio. La guía
`publish/PUBLISH-GUIDE.md` documenta las 4 vías de publicación y los 3 pasos que faltan
(push a GitHub → sesión → abrir los issues pre-llenados).

## ⚖️ Licencia y créditos

- Código: **MIT** (ver LICENSE)
- Construido con el [SDK oficial de TypeScript](https://github.com/modelcontextprotocol/typescript-sdk) v1.30
- Los MCPs `marketnow-*` consumen la API pública documentada de marketnow.site (AliceLabs LLC, MNNC-1.0) — sin afiliación oficial, construido para extender su ecosistema de confianza
- Snapshot de skills generado desde `https://marketnow.site/api/skills.json` (fetched 2026-09-10)

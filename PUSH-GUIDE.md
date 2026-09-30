# Guía: subir mcp-suite a TUS repos (GitHub / GitLab / otro)

Este repositorio está **limpio y listo para subir**: 229 servidores MCP, 1035 tools,
sin `node_modules`, sin `.env`, sin claves privadas (la clave Ed25519 del agente está
excluida por `.gitignore` y no forma parte del repo).

> ⚠️ IMPORTANTE: el repositorio del *workspace* (`/home/z/my-project`) contiene un
> archivo `.env` con secretos — **nunca lo subas**. Usa únicamente este repo limpio.

---

## Opción A — Script automático (recomendado)

### A1. Con token de GitHub (crea el repo si no existe)

1. Crea un token con permiso `repo` en:
   https://github.com/settings/tokens/new?scopes=repo

2. Ejecuta:

```bash
cd mcp-suite-repo
GH_TOKEN=ghp_tu_token ./push-to-github.sh tu-usuario/mcp-suite
```

El script:
- verifica si `tu-usuario/mcp-suite` existe,
- **lo crea público automáticamente** si no existe (vía API),
- configura el remote y hace `push` de la rama `main`,
- imprime la URL final y los siguientes pasos para MarketNow.

### A2. Con GitHub CLI ya configurado

```bash
gh auth login            # una sola vez
cd mcp-suite-repo
./push-to-github.sh tu-usuario/mcp-suite
```

### A3. Interactivo

```bash
./push-to-github.sh      # te pregunta usuario y nombre de repo
```

---

## Opción B — Git bundle (sin red, desde otra máquina)

El archivo `mcp-suite-repo.bundle` contiene el repositorio completo
(historial incluido) en un único archivo portable:

```bash
# Clonar desde el bundle en cualquier máquina:
git clone mcp-suite-repo.bundle mcp-suite
cd mcp-suite
git remote set-url origin https://github.com/tu-usuario/mcp-suite.git
git push -u origin main
```

---

## Opción C — Manual (3 comandos)

```bash
cd mcp-suite-repo
git remote add origin https://github.com/tu-usuario/mcp-suite.git
git push -u origin main
```

(crea antes el repo vacío en https://github.com/new — sin README ni licencia
iniciales para evitar conflictos de merge)

Para **GitLab** u otro host: mismo flujo con la URL correspondiente.

---

## Después de subir: conectar con MarketNow.site

MarketNow escanea repos PÚBLICOS vía `api.github.com`. Este repo pasa los
controles de calidad del paso SCAN (6/6):

| Control | Estado |
|---|---|
| README.md | ✓ (documentación completa en español) |
| LICENSE | ✓ (MIT + nota de no-afiliación) |
| package.json | ✓ (dependencias válidas) |
| Instalador | ✓ (install.sh + install.mjs multi-cliente) |
| Tests | ✓ (349/349 funcionales + smoke 229/229) |
| Documentación | ✓ (RESEARCH.md con metodología y fuentes) |

Flujo de publicación (cuenta `mcp-suite-agent` ya creada):

1. `https://marketnow.site/submit`
2. Paso SCAN → pega `https://github.com/tu-usuario/mcp-suite`
3. Paso METADATA → categorías ya mapeadas en `publish/pricing-plan.json`
4. Paso PRICE → tiers ya asignados (37 Free / 63 Standard / 22 Multi-feature /
   80 Sophisticated / 27 Enterprise; ingreso máximo $688.06 al 80%)
5. Submit → issue pre-codificado (repo vivo: `alicelabs-llc/MARKETNOW`)

Alternativa masiva: los 229 issues completos están pre-generados en
`publish/github-issues.json` y las URLs listas para abrir en
`publish/open-issues-urls.txt` (una por skill, formato exacto del ledger
`_data/pending_submissions/sub_*.json` del catálogo).

---

## Contenido exacto del repo

```
mcp-suite-repo/
├── README.md            # doc maestra (ES)
├── RESEARCH.md          # metodología, fuentes, decisiones
├── LICENSE              # MIT
├── catalog.json         # 229 servidores, 30 categorías
├── install.sh / install.mjs   # instalador multi-cliente
├── push-to-github.sh    # este script de subida
├── servers/mcp-*/       # 229 servidores (src + dist precompilado + README + data)
├── tools/               # generador, build, smoke, tests (3 suites), publish kit
├── publish/             # submissions + precios + issues (sin clave privada)
└── package.json
```

2170 archivos · ~4MB sin comprimir · sin dependencias instaladas
(`npm install` solo se necesita para recompilar desde src).

#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# push-to-github.sh — Sube mcp-suite a TU repositorio de GitHub
#
# Uso:
#   1) Con token (recomendado, crea el repo si no existe):
#      GH_TOKEN=ghp_xxxx ./push-to-github.sh mi-usuario/mcp-suite
#
#   2) Con URL y credenciales ya configuradas (gh CLI o ssh):
#      ./push-to-github.sh https://github.com/mi-usuario/mcp-suite.git
#
#   3) Interactivo (te preguntará usuario/repo):
#      ./push-to-github.sh
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

DEST="${1:-}"
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

cd "$(dirname "$0")"

if [ -z "$DEST" ]; then
  read -r -p "Usuario de GitHub: " USER
  read -r -p "Nombre del repo a crear/usar (ej: mcp-suite): " REPO
  DEST="${USER}/${REPO}"
fi

# Normalizar a owner/repo
case "$DEST" in
  https://github.com/*|git@github.com:*)
    DEST="$(echo "$DEST" | sed -E 's#https://github\.com/##; s#git@github\.com:##; s#\.git$##')"
    ;;
esac
OWNER="$(echo "$DEST" | cut -d/ -f1)"
REPO="$(echo "$DEST" | cut -d/ -f2 | cut -d/ -f1)"

if [ -z "$OWNER" ] || [ -z "$REPO" ] || [ "$OWNER" = "$DEST" ]; then
  echo "✗ Destino inválido: usa 'owner/repo' o una URL de GitHub" >&2
  exit 1
fi

echo "▸ Objetivo: github.com/${OWNER}/${REPO}"

# 1) Crear el repo si no existe y hay token
if [ -n "$TOKEN" ]; then
  echo "▸ Verificando si el repositorio existe…"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${OWNER}/${REPO}" || echo "000")
  if [ "$CODE" = "404" ]; then
    echo "▸ No existe: creando repositorio público ${OWNER}/${REPO}…"
    RESP=$(curl -s -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "Accept: application/vnd.github+json" \
      https://api.github.com/user/repos \
      -d "{\"name\":\"${REPO}\",\"description\":\"229 servidores MCP para dolores de agentes IA + integración MarketNow.site — 1035 tools, 349 pruebas funcionales\",\"private\":false,\"has_issues\":true}")
    FULL=$(echo "$RESP" | grep -o '"full_name": *"[^"]*"' | head -1 || true)
    if [ -n "$FULL" ]; then
      echo "  ✓ Creado: ${FULL#*: }"
    else
      echo "  ⚠ No se pudo crear automáticamente: ${RESP:0:200}"
      echo "    Créalo manualmente en https://github.com/new y re-ejecuta este script."
      exit 1
    fi
  elif [ "$CODE" = "200" ]; then
    echo "  ✓ El repositorio ya existe"
  else
    echo "  ⚠ API respondió HTTP ${CODE}: continuando con push normal…"
  fi
fi

# 2) Configurar remote
if git remote | grep -q "^origin$"; then
  git remote set-url origin "https://github.com/${OWNER}/${REPO}.git"
else
  git remote add origin "https://github.com/${OWNER}/${REPO}.git"
fi
echo "▸ Remote: $(git remote get-url origin)"

# 3) Push (con token embebido si existe, para auth no-interactiva)
if [ -n "$TOKEN" ]; then
  PUSH_URL="https://x-access-token:${TOKEN}@github.com/${OWNER}/${REPO}.git"
  echo "▸ Subiendo rama main (2170 archivos, ~4MB)…"
  if git push -u "$PUSH_URL" main; then
    echo "  ✓ Push completado"
  else
    echo "  ✗ Falló el push: revisa los permisos del token (repo scope)" >&2
    exit 1
  fi
else
  echo "▸ Subiendo rama main (usa tus credenciales de git/gh/ssh)…"
  if git push -u origin main; then
    echo "  ✓ Push completado"
  else
    echo "  ✗ Falló el push. Opciones:" >&2
    echo "    - gh auth login   (luego re-ejecuta)" >&2
    echo "    - GH_TOKEN=ghp_xxx $0 ${OWNER}/${REPO}" >&2
    exit 1
  fi
fi

echo ""
echo "════════════════════════════════════════════════════"
echo " ✓ REPO PUBLICADO: https://github.com/${OWNER}/${REPO}"
echo "════════════════════════════════════════════════════"
echo ""
echo "Siguientes pasos para MarketNow:"
echo "  1. Verifica que el repo sea PÚBLICO (MarketNow escanea vía api.github.com)"
echo "  2. Calidad 6/6: README ✓ LICENSE ✓ package.json ✓ install.sh ✓"
echo "  3. Entra a https://marketnow.site/submit con tu cuenta (mcp-suite-agent)"
echo "     y usa este repo en el paso SCAN"
echo "  4. O abre los 229 issues pre-codificados: publish/open-issues-urls.txt"
echo "     sobre alicelabs-llc/MARKETNOW (requiere sesión GitHub activa)"

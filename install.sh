#!/usr/bin/env bash
# mcp-suite — instalador (wrapper de install.mjs)
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔍 Verificando Node..."
if ! command -v node &> /dev/null; then
  echo "✗ Node.js no está instalado. Instálalo desde https://nodejs.org (v18+)"
  exit 1
fi
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "✗ Necesitas Node 18+ (tienes $(node -v))"
  exit 1
fi
echo "✓ Node $(node -v)"

if [ ! -d "$DIR/node_modules" ] || [ ! -d "$DIR/node_modules/@modelcontextprotocol" ]; then
  echo "📦 Instalando dependencias (@modelcontextprotocol/sdk, zod)..."
  (cd "$DIR" && npm install --no-audit --no-fund)
  echo "✓ Dependencias listas"
fi

if [ ! -f "$DIR/servers/mcp-agent-memory/dist/index.js" ]; then
  echo "🔨 Compilando servidores..."
  (cd "$DIR" && node tools/build.mjs)
fi

echo ""
exec node "$DIR/install.mjs" "$@"

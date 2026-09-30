# Secrets Audit

> Detecta API keys, tokens y credenciales expuestas en texto, configs y código

**Categoría:** MarketNow Ops · **ID:** `mcp-secrets-audit`

**Dolor de agente que resuelve:** Publicar código con API keys filtradas es el fallo #1 de seguridad de skills MCP: check L1 'No Secrets' fallido.

## Tools (3 incl. health_check)

### `scan_text`
Escanea cualquier texto/código/config en busca de 14+ patrones de secrets (OpenAI, AWS, GitHub, Slack, Stripe, Google, JWT...).

**Parámetros:**
  - `texto` (string, requerido): Texto a escanear

### `redact_secrets`
Devuelve el texto con los secrets detectados reemplazados por placeholders seguros (para logs/docs/README).

**Parámetros:**
  - `texto` (string, requerido): Texto a sanitizar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "secrets-audit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-secrets-audit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

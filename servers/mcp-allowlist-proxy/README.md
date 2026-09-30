# Allowlist Proxy Guard

> Valida URLs contra allowlist y bloquea SSRF antes de cualquier fetch

**Categoría:** Seguridad · **ID:** `mcp-allowlist-proxy`

**Dolor de agente que resuelve:** Un fetch a http://169.254.169.254/ o a internals exfiltra datos de la nube: SSRF es el riesgo #1 de tools con red.

> Estado persistente en `~/.mcp-suite/allowlist-proxy/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `check_url`
Valida una URL: esquema permitido, dominio en allowlist, bloqueo de IPs internas/reservadas (SSRF guard) y puertos peligrosos.

**Parámetros:**
  - `url` (string, requerido): URL a validar

### `set_allowlist`
Define la allowlist de dominios permitidos (reemplaza la actual).

**Parámetros:**
  - `dominios` (array, requerido): Lista de dominios permitidos

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "allowlist-proxy": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-allowlist-proxy/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

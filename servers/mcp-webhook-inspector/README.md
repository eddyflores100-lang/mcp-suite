# Webhook Inspector

> Inspecciona webhooks entrantes: parse, verificación HMAC y log de eventos

**Categoría:** Resiliencia de Tools · **ID:** `mcp-webhook-inspector`

**Dolor de agente que resuelve:** Los webhooks llegan y nadie sabe si son legítimos ni qué trajeron: falta inspección y verificación de firma.

> Estado persistente en `~/.mcp-suite/webhook-inspector/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `inspect`
Inspecciona un webhook: headers normalizados, parsea el body (JSON) y detecta el proveedor por firma típica.

**Parámetros:**
  - `headers` (any, requerido): Headers HTTP recibidos
  - `body` (string, requerido): Body crudo

### `verify_hmac`
Verifica la firma HMAC-SHA256 de un webhook dado el secreto compartido y la firma recibida.

**Parámetros:**
  - `body` (string, requerido): Body crudo
  - `secreto` (string, requerido): Secreto compartido
  - `firma_recibida` (string, requerido): Firma (hex o base64)

### `recent_events`
Últimos webhooks inspeccionados (proveedor, tipo, timestamp).

**Parámetros:**
  - `limite` (number, opcional): Máx eventos

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "webhook-inspector": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-webhook-inspector/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

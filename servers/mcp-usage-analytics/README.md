# Usage Analytics

> Analítica de uso de tools: qué se usa, qué nunca, y tendencias

**Categoría:** Observabilidad · **ID:** `mcp-usage-analytics`

**Dolor de agente que resuelve:** Mantener MCP instalados que no se usan drena contexto y tokens: falta analítica de uso real.

> Estado persistente en `~/.mcp-suite/usage-analytics/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `record_tool_use`
Registra el uso de una tool (éxito o no, duración).

**Parámetros:**
  - `tool` (string, requerido): Nombre de la tool
  - `exito` (boolean, opcional): Resultado
  - `duracion_ms` (number, opcional): Duración

### `top_tools`
Ranking de tools por uso, con tasa de éxito y duración media. Marca candidatas a desinstalar.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "usage-analytics": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-usage-analytics/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# MarketNow · Recommender

> Recomienda skills MCP por caso de uso con evidencia de score y categoría

**Categoría:** MarketNow · **ID:** `mcp-marketnow-recommend`

**Dolor de agente que resuelve:** Con 66.496 skills el agente se ahoga: elegir la skill correcta para un caso de uso es el cuello de botella.

> Este servidor incluye datos embebidos en `data/` (no requiere conexión para operar).

## Tools (4 incl. health_check)

### `recommend_for_use_case`
Dado un caso de uso en lenguaje natural (ej: 'manejar postgres', 'scrapear web'), recomienda las skills top del snapshot por afinidad de palabras + score.

**Parámetros:**
  - `caso_uso` (string, requerido): Qué quieres resolver
  - `max` (number, opcional): Máximo recomendaciones

### `top_by_category`
Top skills por categoría del snapshot, ordenadas por sentinel score.

**Parámetros:**
  - `categoria` (string, requerido): Categoría (ej: Developer Tools, Security, AI/ML, Data)
  - `n` (number, opcional): Cuántas

### `best_free`
Las mejores skills gratuitas del snapshot (score máximo, price=0): oro gratis para presupuestos ajustados.

**Parámetros:**
  - `n` (number, opcional): Cuántas

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-recommend": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-recommend/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# DOM Baseline

> Baselines de páginas: snapshots estructurales y detección de qué cambió desde la última vez

**Categoría:** Computer Use · **ID:** `mcp-dom-baseline`

**Dolor de agente que resuelve:** El agente de navegador memoriza la estructura de la página y esta cambia sin aviso: el flujo se rompe y el agente no sabe QUÉ cambió exactamente ni cuándo.

> Estado persistente en `~/.mcp-suite/dom-baseline/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `save_snapshot`
Guarda un snapshot de la página: lista de elementos clave (selector, rol, texto visible) extraídos por el navegador.

**Parámetros:**
  - `pagina` (string, requerido): Identificador de la página (url o nombre)
  - `flujo` (string, opcional): Flujo al que pertenece
  - `elementos` (array, requerido): Elementos {selector, texto, tipo} observados

### `diff_page`
Compara la observación actual contra el baseline: elementos desaparecidos, nuevos y con texto cambiado.

**Parámetros:**
  - `pagina` (string, requerido): Página a comparar
  - `flujo` (string, opcional): Flujo
  - `elementos_actuales` (array, requerido): Elementos {selector, texto, tipo} observados ahora

### `get_baseline`
Recupera el baseline actual de una página (selectores estables conocidos).

**Parámetros:**
  - `pagina` (string, requerido): Página
  - `flujo` (string, opcional): Flujo

### `stability_report`
Reporte de estabilidad global: qué páginas cambian más (fragilidad del suite de automatización).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "dom-baseline": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-dom-baseline/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/dom-baseline/. Guarda snapshots estructurales (lista de selectores estables con hash de estructura) por página/flujo; el diff revela elementos añadidos/eliminados/movidos.

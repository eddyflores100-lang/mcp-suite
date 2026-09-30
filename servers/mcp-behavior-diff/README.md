# Behavior Diff

> Diff de conducta: cómo cambió el uso de tools y patrones del agente entre dos períodos, con anomalías señaladas

**Categoría:** Auto-Mejora · **ID:** `mcp-behavior-diff`

**Dolor de agente que resuelve:** Algo cambió en el agente: es más lento, usa otra tool, repite llamadas... pero como no hay diff de comportamiento, el cambio es una sospecha difusa hasta que rompe algo.

> Estado persistente en `~/.mcp-suite/behavior-diff/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `record_behavior`
Registra el snapshot de comportamiento de un período (uso de tools y métricas).

**Parámetros:**
  - `periodo` (string, requerido): Etiqueta del período (ej: semana-37)
  - `uso_tools` (any, requerido): Veces por tool {tool: veces}
  - `latencia_media_ms` (number, opcional): Latencia media del período
  - `errores` (number, opcional): Errores del período

### `diff_periods`
Compara dos períodos: tools nuevas, abandonadas y cambios de proporción.

**Parámetros:**
  - `periodo_a` (string, requerido): Período base
  - `periodo_b` (string, requerido): Período a comparar

### `trend_report`
Tendencia a lo largo de todos los períodos registrados.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "behavior-diff": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-behavior-diff/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/behavior-diff/. Períodos con vectores de uso (tool→veces, ratios, latencia media); diff entre períodos con detección de tools nuevas/abandonadas y cambios de proporción.

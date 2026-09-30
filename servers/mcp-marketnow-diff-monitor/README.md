# MarketNow · Diff Monitor

> Vigila cambios del marketplace: nuevas skills, scores que caen, tiers que empeoran

**Categoría:** MarketNow · **ID:** `mcp-marketnow-diff-monitor`

**Dolor de agente que resuelve:** El marketplace cambia a diario y nadie avisa: una skill safe puede volverse risky sin que el agente se entere.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

> Estado persistente en `~/.mcp-suite/marketnow-diff-monitor/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `snapshot_now`
Captura el estado actual del marketplace (audit-report + stats) y lo guarda localmente. Devuelve resumen del momento.

### `diff_last`
Compara los dos últimos snapshots guardados: qué cambió en totales y clasificaciones (safe/caution/risky/dangerous).

### `history`
Devuelve el historial completo de snapshots guardados (máx 50) para análisis de tendencia.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-diff-monitor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-diff-monitor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Guarda snapshots locales de /api/audit-report.json y /api/agent.json y calcula diffs entre visitas.

# Quality Drift Monitor

> Vigila la tendencia de calidad del agente en el tiempo: detecta empeoramiento gradual antes del cliente

**Categoría:** Evaluación Continua · **ID:** `mcp-quality-drift-monitor`

**Dolor de agente que resuelve:** La calidad del agente no cae de golpe: baja 2% cada semana (cambio de datos, deriva de contexto) y nadie lo nota hasta que el cliente grita. Falta un monitor de tendencia con alertas.

> Estado persistente en `~/.mcp-suite/quality-drift-monitor/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `record_score`
Registra un punto de calidad: score 0-100 con etiqueta y contexto opcional.

**Parámetros:**
  - `score` (number, requerido): Puntuación 0-100
  - `etiqueta` (string, opcional): Etiqueta/dimensión (ej: respuestas, extraccion)
  - `contexto` (string, opcional): Contexto del punto (qué tarea/caso)

### `trend`
Tendencia de una etiqueta: pendiente por semana, media móvil 7 y comparación primer/último tercio.

**Parámetros:**
  - `etiqueta` (string, opcional): Etiqueta a analizar

### `drift_alerts`
Revisa todas las etiquetas y devuelve alertas de drift (umbrales configurables).

**Parámetros:**
  - `umbral_pendiente` (number, opcional): Pendiente semanal que dispara alerta (negativa)
  - `min_puntos` (number, opcional): Puntos mínimos para evaluar

### `compare_period`
Compara dos periodos de una etiqueta (antes vs después de una fecha) con significancia aproximada.

**Parámetros:**
  - `etiqueta` (string, opcional): Etiqueta
  - `fecha_corte` (string, requerido): Fecha ISO de corte

### `series_report`
Reporte de todas las series: puntos, media actual y mini-sparkline ASCII por etiqueta.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "quality-drift-monitor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-quality-drift-monitor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/quality-drift-monitor/. Serie temporal de scores de calidad por etiqueta; calcula pendiente (regresión lineal simple), ventana móvil y dispara alertas configurables.

# Metrics Collector

> Contadores, medidores e histogramas: las métricas del agente en local

**Categoría:** Observabilidad · **ID:** `mcp-metrics-collector`

**Dolor de agente que resuelve:** Sin métricas no hay forma de saber qué tools se usan ni cuánto tardan: tuning a ciegas.

> Estado persistente en `~/.mcp-suite/metrics-collector/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `incr`
Incrementa un contador (ej: llamadas a tool X, errores de tipo Y).

**Parámetros:**
  - `metrica` (string, requerido): Nombre del contador
  - `delta` (number, opcional): Incremento
  - `etiquetas` (any, opcional): Etiquetas {tool, servidor...}

### `observe`
Observa un valor (duración ms, tamaño bytes): guarda las últimas mediciones y calcula estadísticas.

**Parámetros:**
  - `metrica` (string, requerido): Nombre
  - `valor` (number, requerido): Valor observado

### `snapshot`
Snapshot de todas las métricas: contadores y estadísticas de mediciones (media, p50, p95, máx).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "metrics-collector": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-metrics-collector/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

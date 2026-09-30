# Error Taxonomy

> Agrupa los errores del agente en familias con firma común: el error 47 y el 3 son el MISMO error, ahora lo verás

**Categoría:** Auto-Mejora · **ID:** `mcp-error-taxonomy`

**Dolor de agente que resuelve:** El agente acumula 200 errores registrados como 200 eventos únicos: sin clustering por similitud, el patrón que se repite 40 veces es invisible y cada 'arreglo' ataca el síntoma de la semana.

> Estado persistente en `~/.mcp-suite/error-taxonomy/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `ingest_errors`
Ingiere una tanda de errores con su contexto (operación, mensaje, fase).

**Parámetros:**
  - `errores` (array, requerido): Errores {mensaje, operacion?, fase?, severidad?}

### `cluster`
Agrupa los errores en familias por similitud de firma (tokens del mensaje + operación).

**Parámetros:**
  - `umbral_similitud` (number, opcional): Similitud Jaccard mínima para agrupar (0.3-0.6 recomendado)

### `name_cluster`
Bautiza una familia con su causa probable (convierte el patrón en diagnóstico).

**Parámetros:**
  - `familia` (string, requerido): Id de familia (F1)
  - `nombre` (string, requerido): Nombre diagnóstico (ej: timeouts-por-reintentos-en-cadena)
  - `causa_probable` (string, requerido): Qué la causa realmente

### `taxonomy_report`
Reporte de la taxonomía: familias nombradas vs anónimas, cobertura y foco de arreglo.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "error-taxonomy": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-error-taxonomy/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/error-taxonomy/. Ingiere errores con contexto; clustering por similitud Jaccard de tokens + tipo de operación; las familias se nombran y se cuenta su recurrencia real.

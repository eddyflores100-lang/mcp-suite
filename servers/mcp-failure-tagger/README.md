# Failure Tagger

> Taxonomía de fallos del agente: etiqueta, agrupa y encuentra el patrón raíz de los errores

**Categoría:** Evaluación Continua · **ID:** `mcp-failure-tagger`

**Dolor de agente que resuelve:** Los fallos se tratan como anecdotes: cada error se investiga desde cero porque no hay taxonomía compartida ni conteo por tipo, así que el mismo fallo se 'descubre' diez veces.

> Estado persistente en `~/.mcp-suite/failure-tagger/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `get_taxonomy`
Devuelve la taxonomía de fallos raíz con señales típicas de cada tipo.

### `tag_failure`
Etiqueta un incidente con tipo raíz, descripción y causa probable (alimentado por quien investiga).

**Parámetros:**
  - `titulo` (string, requerido): Título corto del incidente
  - `tipo` (enum, requerido): Tipo raíz
  - `descripcion` (string, requerido): Qué pasó exactamente
  - `causa_probable` (string, requerido): Causa raíz estimada
  - `severidad` (enum, opcional): Severidad

### `attach_fix`
Adjunta el fix aplicado a un incidente y márcalo resuelto.

**Parámetros:**
  - `incidente_id` (string, requerido): ID del incidente
  - `fix` (string, requerido): Qué se cambió para resolverlo
  - `verificado` (boolean, opcional): ¿Se verificó que ya no ocurre?

### `failure_stats`
Estadísticas por tipo: frecuencia, severidad media y tasa de recurrencia (mismo tipo sin fix verificado).

### `postmortem_list`
Lista incidentes con fix o críticos sin resolver, para reunión de retrospectiva.

**Parámetros:**
  - `solo_abiertos` (boolean, opcional): Solo no resueltos/no verificados

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "failure-tagger": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-failure-tagger/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/failure-tagger/. Taxonomía fija (10 tipos raíz) + etiquetado de incidentes con causalidad y detección de tipo dominante y recurrente.

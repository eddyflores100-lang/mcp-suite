# Spec Diff Impact

> Cambia la spec en mitad de la ejecución y calcula el impacto: qué trabajo se invalida y qué sobrevive

**Categoría:** Especificación y Requisitos · **ID:** `mcp-spec-diff-impact`

**Dolor de agente que resuelve:** El humano cambia la spec cuando ya llevas 3 horas construyendo: el agente no sabe qué de lo hecho sirve, qué hay que tirar y qué hay que rehacer, así que lo rehace TODO (o nada).

> Estado persistente en `~/.mcp-suite/spec-diff-impact/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `save_version`
Guarda una versión de la spec (requisitos como lista) y devuelve el diff contra la anterior si existe.

**Parámetros:**
  - `requisitos` (array, requerido): Lista de requisitos de esta versión
  - `version_label` (string, opcional): Etiqueta (v1, post-feedback...)

### `impact_analysis`
Dado el último cambio de spec y el trabajo hecho (lista de entregables), estima qué se invalida y qué sobrevive.

**Parámetros:**
  - `trabajo_hecho` (array, requerido): Entregables/artefactos producidos hasta ahora (texto)
  - `horas_invertidas` (number, opcional): Horas totales invertidas

### `version_history`
Historial completo de versiones de la spec con sus diffs resumidos.

### `churn_alert`
Analiza el churn de spec: frecuencia de cambios y si el cambio reciente es patrón (tercera vez que se pide lo mismo).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "spec-diff-impact": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-spec-diff-impact/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/spec-diff-impact/. Guarda la spec viva (requisitos numerados), calcula diffs semánticos entre versiones y estima trabajo invalidado/reutilizable con su costo.

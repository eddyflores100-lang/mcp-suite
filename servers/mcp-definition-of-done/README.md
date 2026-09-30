# Definition of Done

> Checklists de completitud por tipo de entrega: código, análisis, documento, datos

**Categoría:** Especificación y Requisitos · **ID:** `mcp-definition-of-done`

**Dolor de agente que resuelve:** 'Ya está' significa cosas distintas para el agente y el humano: faltan tests, falta documentar, quedan TODOs. Sin checklist, el 90% se declara hecho al 70%.

> Estado persistente en `~/.mcp-suite/definition-of-done/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `get_templates`
Devuelve las plantillas de Definition of Done incorporadas (código, análisis, documento, datos, migración) para elegir.

### `set_active`
Activa una plantilla de DoD (opcionalmente con items extra propios de la entrega).

**Parámetros:**
  - `tipo` (enum, requerido): Tipo de entrega
  - `items_extra` (array, opcional): Items adicionales del contexto

### `evaluate`
Evalúa una entrega contra la DoD activa: marca items cumplidos y devuelve el % de done real.

**Parámetros:**
  - `cumplidos` (array, requerido): Números de items cumplidos (índices 1-based)
  - `notas` (string, opcional): Contexto de la evaluación

### `done_history`
Historial de honestidad: % de done declarado por entrega y tendencia (¿mejora la disciplina?).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "definition-of-done": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-definition-of-done/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/definition-of-done/. Plantillas de DoD por tipo de entrega + evaluación de entregas contra la plantilla activa.

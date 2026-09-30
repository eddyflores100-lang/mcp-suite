# Dry-Run Executor

> Ensayo el plan ANTES de ejecutarlo: detecta pasos fuera de orden, efectos sin deshacer y dependencias faltantes

**Categoría:** Pre-Vuelo · **ID:** `mcp-dry-run-executor`

**Dolor de agente que resuelve:** El plan del agente se ve bien en texto pero al ejecutarlo el paso 4 depende de un dato que el paso 7 produce: el agente descubre el error con la mitad del mundo ya modificada.

> Estado persistente en `~/.mcp-suite/dry-run-executor/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `define_plan`
Registra un plan como lista de pasos declarativos con lo que leen/escriben/destruyen/requieren.

**Parámetros:**
  - `plan` (string, requerido): Nombre del plan
  - `pasos` (array, requerido): Pasos {nombre, lee:[], escribe:[], destruye:[], requiere:[]}
  - `proposito` (string, opcional): Objetivo del plan

### `dry_run`
Ensaya el plan: verifica orden de datos, precondiciones, pasos destructivos sin compensación y variables huérfanas.

**Parámetros:**
  - `plan` (string, requerido): Plan a ensayar
  - `datos_iniciales` (array, opcional): Datos/recursos que existen antes de empezar

### `reorder_suggestion`
Sugiere un reordenamiento de pasos que resuelve dependencias de datos por orden topológico.

**Parámetros:**
  - `plan` (string, requerido): Plan a reordenar

### `post_execution_check`
Tras ejecutar: compara lo declarado en el ensayo con lo que realmente pasó (pasos saltados, efectos extra).

**Parámetros:**
  - `plan` (string, requerido): Plan ejecutado
  - `pasos_reales` (array, requerido): Nombres de pasos realmente ejecutados en orden
  - `efectos_extra` (array, opcional): Efectos observados no declarados {paso, detalle}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "dry-run-executor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-dry-run-executor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/dry-run-executor/. Modela pasos con: lee (inputs), escribe (outputs), destruye (irreversible), requiere (precondición). El motor valida orden, disponibilidad de datos y cobertura de deshacer.

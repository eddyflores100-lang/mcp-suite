# Regression Harness

> Regresión de comportamiento del agente: compara respuestas actuales vs históricas tras cualquier cambio

**Categoría:** Evaluación Continua · **ID:** `mcp-regression-harness`

**Dolor de agente que resuelve:** Cambias el system prompt 'inofensivamente' y el agente empieza a fallar de formas nuevas. Sin battery de regresión de comportamiento, el daño aparece días después cuando nadie relaciona el cambio con el fallo.

> Estado persistente en `~/.mcp-suite/regression-harness/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `set_probes`
Define las probes fijas (preguntas de sondeo) que se lanzarán en cada run para comparar comportamiento.

**Parámetros:**
  - `probes` (array, requerido): Lista de entradas de sondeo

### `record_run`
Registra un run: qué cambio se aplicó (prompt/modelo/tool) y las respuestas a las probes (mismo orden).

**Parámetros:**
  - `cambio` (string, requerido): Descripción del cambio aplicado
  - `respuestas` (array, requerido): Respuestas a las probes en orden
  - `marcar_baseline` (boolean, opcional): Establecer este run como baseline

### `compare_to_baseline`
Compara el último run contra el baseline: diffs por probe (semántico, longitud, formato) y score de regresión.

### `regression_history`
Historial de cambios vs estabilidad: qué cambio rompió qué (auditoría causa-efecto).

### `rebaseline`
Re-baselinea a un run concreto (el nuevo comportamiento aprobado pasa a ser la referencia).

**Parámetros:**
  - `run_n` (number, requerido): Número de run que pasa a ser baseline
  - `motivo` (string, requerido): Por qué se aprueba el nuevo comportamiento

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "regression-harness": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-regression-harness/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/regression-harness/. Registra runs (cambio aplicado + respuestas a probes fijas), compara contra baseline y detecta diffs semánticos y de comportamiento (tono, formato, longitud).

# Run Reporter

> Reportes de ejecución: pasos, duración, hallazgos y resultado final

**Categoría:** Observabilidad · **ID:** `mcp-run-reporter`

**Dolor de agente que resuelve:** Al terminar una tarea no queda reporte de qué se hizo: el conocimiento de la ejecución se evapora.

> Estado persistente en `~/.mcp-suite/run-reporter/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `start_run`
Inicia una ejecución con objetivo y contexto. Devuelve run_id.

**Parámetros:**
  - `objetivo` (string, requerido): Objetivo de la ejecución
  - `contexto` (string, opcional): Contexto

### `add_step`
Añade un paso a la ejecución: descripción, resultado, duración y artefactos.

**Parámetros:**
  - `run_id` (string, requerido): ID de la ejecución
  - `paso` (string, requerido): Descripción del paso
  - `resultado` (string, opcional): Resultado
  - `duracion_ms` (number, opcional): Duración
  - `artefactos` (array, opcional): Archivos/deliverables generados

### `finish_run`
Cierra la ejecución con éxito/fallo y genera el reporte completo (markdown).

**Parámetros:**
  - `run_id` (string, requerido): ID de la ejecución
  - `exito` (boolean, requerido): Resultado global
  - `resumen` (string, opcional): Resumen final

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "run-reporter": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-run-reporter/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

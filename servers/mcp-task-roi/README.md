# Task ROI

> ROI por tarea: valor generado vs costo en tokens/dinero/tiempo — qué trabajo vale la pena

**Categoría:** Economía del Agente · **ID:** `mcp-task-roi`

**Dolor de agente que resuelve:** El agente no sabe cuánto cuesta su trabajo ni cuánto vale: optimiza completar tareas, no el retorno de completarlas. Tareas de bajo valor consumen el mismo presupuesto que las críticas.

> Estado persistente en `~/.mcp-suite/task-roi/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `log_task`
Registra una tarea completada: valor estimado, costo en USD, tokens y minutos.

**Parámetros:**
  - `tarea` (string, requerido): Descripción de la tarea
  - `valor_usd` (number, requerido): Valor estimado generado (USD)
  - `costo_usd` (number, requerido): Costo total (USD)
  - `tokens` (number, opcional): Tokens consumidos
  - `minutos` (number, opcional): Tiempo invertido
  - `categoria` (string, opcional): Categoría del trabajo

### `roi_report`
Reporte ROI global y por categoría: retorno medio, tareas de valor negativo y mejor/peor inversión.

### `prioritize`
Prioriza trabajo pendiente por valor/costo (ROI esperado) con desempate por urgencia.

**Parámetros:**
  - `pendientes` (array, requerido): Tareas {tarea, valor_usd, costo_usd, urgencia}

### `cost_per_output`
Costo por unidad de salida (documento, análisis, línea de código): métrica de eficiencia comparativa.

**Parámetros:**
  - `tareas` (array, requerido): Tareas {tarea, costo_usd, unidades}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "task-roi": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-task-roi/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/task-roi/. Cada tarea registra valor estimado (USD o puntos) y costo real (tokens, USD, minutos); calcula ROI, prioriza por valor/costo y detecta tareas de valor negativo.

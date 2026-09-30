# Time Horizon Planner

> Planificación por horizontes (hoy / semana / mes) con recalendización explícita

**Categoría:** Objetivos y Largo Plazo · **ID:** `mcp-time-horizon-planner`

**Dolor de agente que resuelve:** El agente planifica todo como si fuera 'ahora': mezcla lo urgente con lo de dentro de tres semanas, y cuando algo se retrasa, recalendizar a mano es tan caro que no se hace.

> Estado persistente en `~/.mcp-suite/time-horizon-planner/state.json` (local, privado, tuya la data).

## Tools (7 incl. health_check)

### `plan_task`
Añade una tarea al plan con horizonte, esfuerzo estimado y dependencias.

**Parámetros:**
  - `tarea` (string, requerido): Descripción de la tarea
  - `horizonte` (enum, requerido): Horizonte temporal
  - `esfuerzo_horas` (number, opcional): Esfuerzo estimado
  - `depende_de` (array, opcional): IDs de tareas previas
  - `fecha_objetivo` (string, opcional): Fecha ISO objetivo (opcional)

### `horizon_view`
Vista por horizontes: carga de hoy vs semana vs mes, y alerta de sobrecarga de un horizonte.

### `promote`
Promueve una tarea al horizonte inmediato superior (trimestre→mes→semana→hoy) validando dependencias.

**Parámetros:**
  - `tarea_id` (string, requerido): ID de la tarea

### `complete`
Marca una tarea como hecha y desbloquea dependientes (devuelve qué se liberó).

**Parámetros:**
  - `tarea_id` (string, requerido): ID de la tarea

### `reschedule_cascade`
Mueve una tarea de fecha y recalendiza en cascada todo lo que depende de ella (efecto dominó calculado).

**Parámetros:**
  - `tarea_id` (string, requerido): ID de la tarea que se retrasa
  - `desplazar_dias` (number, requerido): Días de retraso (positivo)

### `plan_stats`
Estadísticas del plan: throughput, precisión de estimación (esfuerzo vs real) y horizonte más congestionado.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "time-horizon-planner": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-time-horizon-planner/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.m/my-project... ~/.mcp-suite/time-horizon-planner/. Tareas con horizonte (hoy/semana/mes/trimestre), dependencias simples, detección de colisión de fechas y replanificación en cascada.

# Task Tracker

> Tareas del agente con estados, prioridades y bloqueos

**Categoría:** Cognición y Planificación · **ID:** `mcp-task-tracker`

**Dolor de agente que resuelve:** Sin tracker de tareas el agente pierde el hilo entre sesiones y no sabe qué está bloqueado.

> Estado persistente en `~/.mcp-suite/task-tracker/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `add`
Añade una tarea: título, detalle, prioridad y etiquetas. Devuelve ID.

**Parámetros:**
  - `titulo` (string, requerido): Título de la tarea
  - `detalle` (string, opcional): Detalle
  - `prioridad` (enum, opcional): Prioridad
  - `etiquetas` (array, opcional): Tags

### `update_status`
Actualiza el estado de una tarea: pendiente → en_progreso → done | bloqueada (con motivo).

**Parámetros:**
  - `id` (string, requerido): ID de la tarea
  - `estado` (enum, requerido): Nuevo estado
  - `motivo` (string, opcional): Motivo (para bloqueos)

### `pending`
Lista tareas pendientes/en progreso ordenadas por prioridad, con bloqueadas destacadas.

**Parámetros:**
  - `etiqueta` (string, opcional): Filtrar por etiqueta

### `summary`
Resumen de productividad: completadas hoy/semana, tasa de finalización y tareas estancadas.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "task-tracker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-task-tracker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

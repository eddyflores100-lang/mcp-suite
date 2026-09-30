# Job Queue

> Cola de trabajos durable: encola, procesa y nunca pierde una tarea

**Categoría:** Resiliencia de Tools · **ID:** `mcp-queue-mcp`

**Dolor de agente que resuelve:** Sin cola, un crash pierde las tareas en vuelo: el agente necesita encolar trabajos con reintentos y prioridad.

> Estado persistente en `~/.mcp-suite/queue-mcp/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `enqueue`
Encola un trabajo {tipo, payload, prioridad}: devuelve posición e ID para seguimiento.

**Parámetros:**
  - `tipo` (string, requerido): Tipo de trabajo
  - `payload` (any, requerido): Datos del trabajo
  - `prioridad` (number, opcional): Prioridad (mayor = antes)

### `dequeue`
Saca el siguiente trabajo pendiente (mayor prioridad, FIFO entre iguales) y lo marca en_progreso.

### `complete`
Marca un trabajo como completado (o fallido: vuelve a pendiente si le quedan reintentos).

**Parámetros:**
  - `job_id` (string, requerido): ID del trabajo
  - `exito` (boolean, requerido): Resultado
  - `resultado` (string, opcional): Detalle del resultado
  - `max_reintentos` (number, opcional): Reintentos permitidos

### `stats`
Estadísticas de la cola: pendientes, en progreso, completados, fallidos y oldest pendiente.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "queue-mcp": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-queue-mcp/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

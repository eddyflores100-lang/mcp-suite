# Deadline Engine

> Deadlines con prioridad dinámica: el antídoto contra la procrastinación estructural del agente

**Categoría:** Frescura del Conocimiento · **ID:** `mcp-deadline-engine`

**Dolor de agente que resuelve:** El agente trabaja en orden de llegada, no de urgencia: descubre el deadline vencido cuando pregunta '¿qué hago ahora?' y ya no hay tiempo. La urgencia tiene que calcularse, no recordarse.

> Estado persistente en `~/.mcp-suite/deadline-engine/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `add_deadline`
Añade un item con deadline, peso y esfuerzo estimado: la prioridad se recalcula sola.

**Parámetros:**
  - `item` (string, requerido): Tarea/entrega con plazo
  - `deadline` (string, requerido): Fecha ISO o 'en Xh'/'en Xd'
  - `peso` (enum, opcional): Importancia
  - `esfuerzo_horas` (number, opcional): Esfuerzo estimado

### `priority_queue`
Cola priorizada dinámicamente: urgencia por cercanía x peso, con slack (tiempo libre antes del deadline).

### `feasibility_check`
Comprueba si todo lo pendiente cabe en el tiempo disponible: detecta deadlines imposibles.

**Parámetros:**
  - `horas_disponibles` (number, opcional): Horas de trabajo disponibles hasta el deadline más lejano

### `complete`
Marca un item como completado y mide si se cumplió a tiempo.

**Parámetros:**
  - `id` (string, requerido): ID del item

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "deadline-engine": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-deadline-engine/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/deadline-engine/. Items con deadline y peso; prioridad dinámica = cercanía x peso x tamaño (slack); detecta deadlines imposibles y agenda de trabajo óptima.

# Scratchpad

> Pizarra temporal por tarea: lo que el agente piensa sin ensuciar el contexto

**Categoría:** Memoria y Contexto · **ID:** `mcp-scratchpad`

**Dolor de agente que resuelve:** El agente mezcla razonamiento intermedio con contexto durable: necesita una pizarra de trabajo desechable y aislada por tarea.

> Estado persistente en `~/.mcp-suite/scratchpad/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `write`
Escribe en la pizarra de la tarea activa (anexar o reemplazar por etiqueta).

**Parámetros:**
  - `etiqueta` (string, requerido): Etiqueta de la nota (ej: hipotesis-1)
  - `contenido` (string, requerido): Contenido
  - `tarea` (string, opcional): Tarea activa

### `read`
Lee la pizarra completa de la tarea (o una etiqueta específica).

**Parámetros:**
  - `tarea` (string, opcional): Tarea
  - `etiqueta` (string, opcional): Etiqueta específica

### `clear`
Limpia la pizarra de una tarea (el razonamiento intermedio no debe persistir).

**Parámetros:**
  - `tarea` (string, opcional): Tarea a limpiar

### `list_tasks`
Lista las tareas con pizarra activa y cuántas notas tienen cada una.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "scratchpad": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-scratchpad/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

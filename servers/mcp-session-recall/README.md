# Session Recall

> Contexto de sesión: guarda al cerrar, restaura al abrir

**Categoría:** Memoria y Contexto · **ID:** `mcp-session-recall`

**Dolor de agente que resuelve:** Cada sesión nueva pierde el hilo: el agente necesita guardar un resumen de contexto al cerrar y restaurarlo al abrir.

> Estado persistente en `~/.mcp-suite/session-recall/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `save_context`
Guarda el contexto de cierre de sesión: objetivo actual, estado, próximos pasos y claves de memoria a restaurar.

**Parámetros:**
  - `objetivo` (string, requerido): Objetivo de la sesión
  - `estado_actual` (string, requerido): Dónde quedaste
  - `proximos_pasos` (array, requerido): Próximos pasos
  - `claves` (array, opcional): Claves de memoria relevantes

### `restore_last`
Restaura el contexto de la última sesión guardada: objetivo, estado y próximos pasos listos para continuar.

### `list_sessions`
Lista las sesiones guardadas (objetivo y fecha) para elegir cuál restaurar.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "session-recall": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-session-recall/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# Working State Store

> Estado de trabajo versionado con historial: checkpoints del agente

**Categoría:** Memoria y Contexto · **ID:** `mcp-working-state-store`

**Dolor de agente que resuelve:** El estado intermedio de una tarea se pierde en un crash: sin checkpoints, el agente vuelve a empezar.

> Estado persistente en `~/.mcp-suite/working-state-store/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `save_state`
Guarda el estado actual de una tarea como nueva versión (checkpoint numerado).

**Parámetros:**
  - `tarea` (string, requerido): Nombre de la tarea
  - `estado` (any, requerido): Estado (JSON)
  - `nota` (string, opcional): Nota del checkpoint

### `load_state`
Carga la última versión del estado de una tarea (o una versión específica).

**Parámetros:**
  - `tarea` (string, requerido): Tarea
  - `version` (number, opcional): Versión específica

### `diff_versions`
Compara dos versiones del estado de una tarea: claves añadidas, eliminadas y cambiadas.

**Parámetros:**
  - `tarea` (string, requerido): Tarea
  - `v1` (number, requerido): Versión base
  - `v2` (number, requerido): Versión a comparar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "working-state-store": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-working-state-store/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

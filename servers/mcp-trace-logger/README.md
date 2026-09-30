# Trace Logger

> Logs estructurados con niveles y correlación por trace-id

**Categoría:** Observabilidad · **ID:** `mcp-trace-logger`

**Dolor de agente que resuelve:** console.log plano sin niveles ni correlación: imposible reconstruir una ejecución fallida.

> Estado persistente en `~/.mcp-suite/trace-logger/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `log`
Registra un log estructurado: nivel (debug/info/warn/error), mensaje, trace_id y datos JSON.

**Parámetros:**
  - `nivel` (enum, requerido): Nivel
  - `mensaje` (string, requerido): Mensaje
  - `trace_id` (string, opcional): ID de correlación
  - `datos` (any, opcional): Datos estructurados

### `tail`
Devuelve los últimos N logs, filtrables por nivel y trace_id.

**Parámetros:**
  - `nivel` (enum, opcional): Filtrar nivel
  - `trace_id` (string, opcional): Filtrar por trace
  - `n` (number, opcional): Cuántos

### `search`
Busca logs por texto en mensaje (con ventana de horas opcional).

**Parámetros:**
  - `texto` (string, requerido): Texto a buscar
  - `horas` (number, opcional): Últimas N horas

### `new_trace`
Genera un nuevo trace-id para correlacionar una ejecución completa.

**Parámetros:**
  - `etiqueta` (string, opcional): Etiqueta del trace

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "trace-logger": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-trace-logger/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# Agent Episodic Log

> Bitácora cronológica de episodios: qué pasó, cuándo y con qué resultado

**Categoría:** Memoria y Contexto · **ID:** `mcp-agent-episodic-log`

**Dolor de agente que resuelve:** Sin bitácora temporal el agente no puede reconstruir qué hizo ni cuándo: debugging y auditoría imposibles.

> Estado persistente en `~/.mcp-suite/agent-episodic-log/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `log_event`
Registra un episodio con timestamp: acción, resultado, contexto y severidad.

**Parámetros:**
  - `accion` (string, requerido): Qué se hizo
  - `resultado` (string, requerido): Resultado (éxito/fallo/detalle)
  - `contexto` (string, opcional): Contexto adicional
  - `severidad` (enum, opcional): Severidad

### `timeline`
Devuelve la línea de tiempo de eventos (filtrable por severidad y ventana de tiempo en horas).

**Parámetros:**
  - `severidad` (enum, opcional): Filtrar severidad
  - `horas` (number, opcional): Solo últimas N horas
  - `limite` (number, opcional): Máx eventos

### `search_events`
Busca eventos por texto (en acción, resultado o contexto).

**Parámetros:**
  - `texto` (string, requerido): Texto a buscar
  - `limite` (number, opcional): Máx resultados

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "agent-episodic-log": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-agent-episodic-log/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

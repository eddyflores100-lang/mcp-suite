# Latency Tracker

> Latencias por tool y paso: p50/p95/p99 para encontrar los cuellos de botella

**Categoría:** Observabilidad · **ID:** `mcp-latency-tracker`

**Dolor de agente que resuelve:** El agente tarda pero nadie sabe dónde: sin latencias por paso, la optimización es adivinanza.

> Estado persistente en `~/.mcp-suite/latency-tracker/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `start`
Inicia un timer para una operación. Devuelve el timer_id.

**Parámetros:**
  - `operacion` (string, requerido): Nombre de la operación

### `end`
Termina el timer y registra la duración en el historial de la operación.

**Parámetros:**
  - `timer_id` (string, requerido): ID del timer

### `percentiles`
Percentiles p50/p95/p99 por operación + ranking de operaciones más lentas.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "latency-tracker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-latency-tracker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

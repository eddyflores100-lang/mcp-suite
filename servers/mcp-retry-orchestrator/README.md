# Retry Orchestrator

> Política de reintentos con backoff exponencial y jitter: calcula cuándo y si reintentar

**Categoría:** Resiliencia de Tools · **ID:** `mcp-retry-orchestrator`

**Dolor de agente que resuelve:** Las tools fallan transitoriamente y el agente o abandona o spamea: falta una política de reintentos inteligente.

> Estado persistente en `~/.mcp-suite/retry-orchestrator/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `plan_retries`
Calcula el plan de reintentos para una operación fallida: intentos, delays con backoff exponencial + jitter y timeout total.

**Parámetros:**
  - `intento_actual` (number, requerido): En qué intento vas (empezando en 1)
  - `max_intentos` (number, opcional): Máximo de intentos
  - `base_ms` (number, opcional): Delay base

### `should_retry`
Decide si un error es reintentable: clasifica por tipo (red= sí, 4xx= no, 429= sí con espera, 5xx= sí).

**Parámetros:**
  - `error` (string, requerido): Mensaje o código de error

### `record_attempt`
Registra el resultado de un intento (éxito/fallo) para aprender qué operaciones suelen necesitar reintentos.

**Parámetros:**
  - `operacion` (string, requerido): Nombre de la operación
  - `exito` (boolean, requerido): Resultado
  - `intento` (number, opcional): Número de intento

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "retry-orchestrator": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-retry-orchestrator/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

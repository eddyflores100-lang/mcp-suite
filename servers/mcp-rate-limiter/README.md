# Rate Limiter

> Límite de llamadas por ventana deslizante: respeta cuotas de APIs

**Categoría:** Resiliencia de Tools · **ID:** `mcp-rate-limiter`

**Dolor de agente que resuelve:** Las APIs te tiran 429 y bannean: el agente necesita respetar rate limits por servicio sin pensarlo.

> Estado persistente en `~/.mcp-suite/rate-limiter/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `configure`
Configura el límite de un servicio: N llamadas por ventana (ms).

**Parámetros:**
  - `servicio` (string, requerido): Servicio/API
  - `max_llamadas` (number, requerido): Máx llamadas
  - `ventana_ms` (number, opcional): Ventana en ms

### `acquire`
Pide un slot: devuelve permitido=true y cuánto esperar si no (ventana deslizante real).

**Parámetros:**
  - `servicio` (string, requerido): Servicio

### `status`
Estado actual de uso de todos los límites configurados.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "rate-limiter": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-rate-limiter/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

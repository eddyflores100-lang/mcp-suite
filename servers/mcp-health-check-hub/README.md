# Health Check Hub

> Monitorea la salud de tus servicios MCP/HTTP con pings periódicos

**Categoría:** Resiliencia de Tools · **ID:** `mcp-health-check-hub`

**Dolor de agente que resuelve:** Las dependencias caen silenciosamente: el agente se entera cuando ya falló la cadena completa.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

> Estado persistente en `~/.mcp-suite/health-check-hub/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `register_target`
Registra un endpoint a vigilar: nombre, URL y método esperado.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del target
  - `url` (string, requerido): URL a vigilar

### `check`
Ejecuta un health check en vivo de un target (HTTP GET) y guarda el resultado en historial.

**Parámetros:**
  - `nombre` (string, requerido): Target a chequear
  - `timeout_ms` (number, opcional): Timeout

### `report`
Reporte de todos los targets: último estado, uptime estimado (últimos 50 checks) y latencia media.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "health-check-hub": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-health-check-hub/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

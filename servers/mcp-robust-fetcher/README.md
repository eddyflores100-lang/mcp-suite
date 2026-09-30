# Robust Fetcher

> Fetch HTTP resiliente: timeouts, reintentos, headers y respuestas truncadas seguras

**Categoría:** Datos y Extracción · **ID:** `mcp-robust-fetcher`

**Dolor de agente que resuelve:** fetch() plano se cuelga o muere en la primera sin conexión: las tools necesitan un fetch con retries y control.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (4 incl. health_check)

### `fetch_text`
Fetch robusto de una URL: timeout configurable, hasta 3 reintentos con backoff y captura de status/headers relevantes.

**Parámetros:**
  - `url` (string, requerido): URL a descargar
  - `timeout_ms` (number, opcional): Timeout
  - `reintentos` (number, opcional): Reintentos

### `fetch_json`
Fetch que parsea JSON directamente (con error claro si la respuesta no es JSON).

**Parámetros:**
  - `url` (string, requerido): URL del JSON
  - `timeout_ms` (number, opcional): Timeout

### `head`
Petición HEAD rápida: existe la URL, tamaño declarado y tipo de contenido, sin descargar el cuerpo.

**Parámetros:**
  - `url` (string, requerido): URL a chequear

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "robust-fetcher": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-robust-fetcher/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

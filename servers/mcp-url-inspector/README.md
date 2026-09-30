# URL Inspector

> Anatomía de URLs: parse, normalización, redirecciones en vivo y clasificación

**Categoría:** Datos y Extracción · **ID:** `mcp-url-inspector`

**Dolor de agente que resuelve:** URLs malformadas rompen flujos enteros: falta inspección previa (parámetros UTM, redirects, esquemas).

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (4 incl. health_check)

### `inspect`
Analiza una URL estáticamente: esquema, host, puerto, path, query params completos, fragmento, UTMs y riesgo.

**Parámetros:**
  - `url` (string, requerido): URL a inspeccionar

### `normalize`
Normaliza la URL: baja el host, elimina UTMs/trackers, default port, trailing slash controlado y fragmentos.

**Parámetros:**
  - `url` (string, requerido): URL a normalizar
  - `conservar_query` (boolean, opcional): Conservar query no-tracking

### `redirect_chain`
Sigue la cadena de redirecciones en vivo (máx 5 saltos) y reporta cada hop con status.

**Parámetros:**
  - `url` (string, requerido): URL inicial

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "url-inspector": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-url-inspector/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

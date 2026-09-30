# Poll Watcher

> Vigila cambios de cualquier URL: detecta diffs entre visitas

**Categoría:** Resiliencia de Tools · **ID:** `mcp-poll-watcher`

**Dolor de agente que resuelve:** El agente necesita saber cuándo cambia una página/API pero los webhooks no existen en la mayoría de sitios: falta polling con diff.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

> Estado persistente en `~/.mcp-suite/poll-watcher/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `watch`
Visita una URL y compara su hash con la última visita: detecta cambios (nuevo/actualizado/sin cambios) y guarda el snapshot.

**Parámetros:**
  - `nombre` (string, requerido): Alias del watch
  - `url` (string, requerido): URL a vigilar
  - `timeout_ms` (number, opcional): Timeout

### `list_watches`
Lista todos los watches con su estado (hash, tamaño, última visita, cambios detectados).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "poll-watcher": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-poll-watcher/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

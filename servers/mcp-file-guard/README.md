# File Guard

> Guardián de rutas: el agente solo toca lo permitido, sin escapes de directorio

**Categoría:** Seguridad · **ID:** `mcp-file-guard`

**Dolor de agente que resuelve:** Una tool con acceso a archivos puede leer ~/.ssh o escapar del workspace con ../: faltan guardas de rutas.

## Tools (3 incl. health_check)

### `resolve_path`
Resuelve una ruta contra una raíz permitida y detecta escapes (../), symlinks evidentes y rutas absolutas fuera de la raíz.

**Parámetros:**
  - `ruta` (string, requerido): Ruta solicitada (relativa o absoluta)
  - `raiz` (string, opcional): Raíz permitida

### `check_access`
Verifica si una operación de archivo (leer/escribir/borrar/ejecutar) está permitida por política para esa ruta.

**Parámetros:**
  - `ruta` (string, requerido): Ruta objetivo
  - `operacion` (enum, requerido): Operación

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "file-guard": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-file-guard/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

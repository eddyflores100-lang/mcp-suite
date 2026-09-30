# Output Diff

> Diffs de JSON y texto: qué cambió entre dos versiones de una salida

**Categoría:** Calidad de Salida · **ID:** `mcp-output-diff`

**Dolor de agente que resuelve:** Regenerar una respuesta y no saber qué cambió respecto a la anterior: imposible evaluar mejoras.

## Tools (3 incl. health_check)

### `diff_json`
Diff estructural de dos JSON: rutas añadidas, eliminadas y con valor cambiado.

**Parámetros:**
  - `a` (any, requerido): JSON base
  - `b` (any, requerido): JSON nuevo

### `diff_text`
Diff línea a línea de dos textos (LCS simple): añadidas, eliminadas y contexto.

**Parámetros:**
  - `a` (string, requerido): Texto base
  - `b` (string, requerido): Texto nuevo

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "output-diff": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-output-diff/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# Context Compressor

> Comprime contextos largos: extrae lo esencial antes de desbordar la ventana

**Categoría:** Memoria y Contexto · **ID:** `mcp-context-compressor`

**Dolor de agente que resuelve:** El contexto crece hasta desbordar la ventana: falta compresión extractiva determinista antes de gastar tokens en reintentos.

## Tools (4 incl. health_check)

### `compress`
Compresión extractiva de un texto largo: selecciona las oraciones más informativas (frecuencia de términos) reduciendo a ~40% del original.

**Parámetros:**
  - `texto` (string, requerido): Texto largo a comprimir
  - `ratio` (number, opcional): Fracción a conservar (0.1-0.9)

### `key_points`
Extrae los N puntos clave de un texto (oraciones top por informatividad), sin reordenar el original.

**Parámetros:**
  - `texto` (string, requerido): Texto a analizar
  - `n` (number, opcional): Cuántos puntos

### `stats`
Estadísticas del texto: caracteres, palabras, oraciones, tokens estimados y densidad informativa.

**Parámetros:**
  - `texto` (string, requerido): Texto a medir

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "context-compressor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-context-compressor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# Input Sanitizer

> Sanea entradas antes de que lleguen a tools: control chars, null bytes, tamaño y forma

**Categoría:** Seguridad · **ID:** `mcp-input-sanitizer`

**Dolor de agente que resuelve:** Las tools reciben inputs hostiles (null bytes, Unicode invisible, payloads gigantes) que rompen downstream.

## Tools (3 incl. health_check)

### `sanitize`
Sanea un string: elimina null bytes y controles, Unicode invisible (Bidi/zero-width), recorta a máximo y normaliza saltos.

**Parámetros:**
  - `texto` (string, requerido): Entrada a sanear
  - `max_caracteres` (number, opcional): Límite de tamaño

### `validate_shape`
Valida la forma de un objeto de entrada: campos permitidos, prohibidos detectados, tipos básicos y profundidad máxima.

**Parámetros:**
  - `data` (any, requerido): Objeto de entrada
  - `campos_permitidos` (array, opcional): Lista blanca de campos de primer nivel

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "input-sanitizer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-input-sanitizer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

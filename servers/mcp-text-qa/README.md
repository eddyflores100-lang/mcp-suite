# Text QA

> QA de texto: palabras duplicadas, placeholders, encoding roto y espaciado

**Categoría:** Calidad de Salida · **ID:** `mcp-text-qa`

**Dolor de agente que resuelve:** Salidas con errores tipográficos obvios (palabras duplicadas, caracteres mojibake, doble espacio) erosionan la confianza.

## Tools (3 incl. health_check)

### `check`
Ejecuta 10+ reglas de QA tipográfico: duplicadas, mojibake, doble espacio, espacios antes de puntuación, minúscula tras punto, lorem, URLs rotas.

**Parámetros:**
  - `texto` (string, requerido): Texto a revisar

### `fix_common`
Corrige automáticamente los problemas tipográficos seguros: duplicadas, dobles espacios, espacios antes de puntuación, trailing spaces.

**Parámetros:**
  - `texto` (string, requerido): Texto a corregir

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "text-qa": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-text-qa/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

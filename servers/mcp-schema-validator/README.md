# Schema Validator

> Valida cualquier JSON contra un JSON Schema (subconjunto potente): tipos, requeridos, anidados

**Categoría:** Calidad de Salida · **ID:** `mcp-schema-validator`

**Dolor de agente que resuelve:** La salida estructurada de un LLM se acepta sin validar: los campos faltantes explotan río abajo.

## Tools (3 incl. health_check)

### `validate`
Valida un JSON contra un schema {tipo, requeridos:[], propiedades:{campo:tipo}, items, min/max}. Devuelve errores con ruta exacta.

**Parámetros:**
  - `data` (any, requerido): JSON a validar
  - `schema` (any, requerido): Schema de validación

### `common_schemas`
Devuelve schemas listos para usar: producto, usuario, artículo, respuesta-tool-MCP, evento.

**Parámetros:**
  - `cual` (enum, requerido): Schema a obtener

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "schema-validator": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-schema-validator/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

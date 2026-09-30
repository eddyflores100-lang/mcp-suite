# JCS Canonicalizer

> JSON canónico RFC 8785 (JCS): misma firma para el mismo JSON, siempre

**Categoría:** MarketNow Trust · **ID:** `mcp-jcs-canonicalizer`

**Dolor de agente que resuelve:** Firmar JSON es frágil: espacios u orden de claves distintos rompen la firma. RFC 8785 lo resuelve con serialización canónica.

## Tools (4 incl. health_check)

### `canonicalize`
Convierte un objeto JSON arbitrario a su forma canónica RFC 8785 (JCS) — string determinista listo para firmar.

**Parámetros:**
  - `data` (any, requerido): Objeto JSON a canonizar

### `fingerprint`
Hash SHA-256 de la forma canónica JCS: identificador determinista del contenido (útil para deduplicar y comparar credenciales).

**Parámetros:**
  - `data` (any, requerido): Objeto JSON

### `compare`
Compara dos JSON semánticamente: si sus formas canónicas JCS son idénticas, son equivalentes byte a byte para firmas.

**Parámetros:**
  - `a` (any, requerido): Primer JSON
  - `b` (any, requerido): Segundo JSON

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "jcs-canonicalizer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-jcs-canonicalizer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Implementa el subconjunto práctico de RFC 8785: claves ordenadas por código UTF-16, sin whitespace, números según ECMAScript toString, strings con escape mínimo JSON. Rechaza NaN/Infinity/-0.

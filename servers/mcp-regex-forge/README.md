# Regex Forge

> Construye, prueba y explica regex: patrones comunes + riesgo ReDoS

**Categoría:** Utilidades · **ID:** `mcp-regex-forge`

**Dolor de agente que resuelve:** El LLM escribe regex sin testear y a veces catastróficas (ReDoS): forja con validación previa.

## Tools (4 incl. health_check)

### `build`
Genera regex probadas para casos comunes: email, teléfono EC, slug, fecha ISO, hex color, URL, número, cédula.

**Parámetros:**
  - `patron` (enum, requerido): Tipo de patrón

### `test`
Prueba una regex contra un texto: coincidencias, grupos y posiciones.

**Parámetros:**
  - `regex` (string, requerido): La regex (sin delimitadores)
  - `flags` (string, opcional): Flags (g, i, m...)
  - `texto` (string, requerido): Texto de prueba

### `redos_check`
Heurística de riesgo ReDoS: detecta cuantificadores anidados y alternancias superpuestas catastróficas.

**Parámetros:**
  - `regex` (string, requerido): Regex a auditar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "regex-forge": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-regex-forge/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# Context Rot Detector

> Detecta información podrida en el contexto: datos viejos, contradicciones y duplicados

**Categoría:** Memoria y Contexto · **ID:** `mcp-context-rot-detector`

**Dolor de agente que resuelve:** El contexto se pudre: datos desactualizados y contradictorios acumulados degradan la calidad de las respuestas (context rot).

## Tools (4 incl. health_check)

### `detect_stale`
Detecta entradas viejas en una lista de items {texto, ts}: flaggea las que superan la frescura máxima por tipo de dato.

**Parámetros:**
  - `items` (array, requerido): Items [{texto, ts ISO}]
  - `max_horas` (number, opcional): Frescura máxima en horas

### `detect_contradictions`
Detecta contradicciones simples entre afirmaciones: números distintos sobre el mismo sujeto o negaciones opuestas.

**Parámetros:**
  - `afirmaciones` (array, requerido): Lista de afirmaciones (strings)

### `dedupe_context`
Elimina entradas duplicadas/casi-duplicadas de una lista de textos (similitud Jaccard sobre palabras).

**Parámetros:**
  - `textos` (array, requerido): Lista de textos
  - `umbral` (number, opcional): Similitud umbral (0-1)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "context-rot-detector": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-context-rot-detector/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

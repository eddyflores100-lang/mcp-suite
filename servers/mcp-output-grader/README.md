# Output Grader

> Autoevalúa salidas del agente: completitud, especificidad y estructura

**Categoría:** Calidad de Salida · **ID:** `mcp-output-grader`

**Dolor de agente que resuelve:** El agente entrega sin autoevaluar: respuestas vagas, sin cifras y con placeholders pasan como válidas.

## Tools (3 incl. health_check)

### `grade`
Califica una salida (0-100) por heurísticas: completitud (placeholders/lorem), especificidad (números/fechas), estructura (longitud, listas) y acciones ejecutables.

**Parámetros:**
  - `salida` (string, requerido): Texto de la salida a evaluar
  - `tipo_esperado` (enum, opcional): Tipo de salida

### `improve_hints`
Dada una salida, devuelve instrucciones concretas para mejorarla (feedback accionable).

**Parámetros:**
  - `salida` (string, requerido): Salida original

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "output-grader": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-output-grader/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

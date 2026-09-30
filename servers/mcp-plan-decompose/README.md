# Plan Decompose

> Descompone objetivos en planes ejecutables: pasos, dependencias y estimaciones

**Categoría:** Cognición y Planificación · **ID:** `mcp-plan-decompose`

**Dolor de agente que resuelve:** El agente ataca objetivos gigantes sin descomponer: pasos desordenados, sin dependencias ni criterios de salida.

## Tools (3 incl. health_check)

### `decompose`
Descompone un objetivo en pasos estructurados: extrae verbos de acción, ordena por dependencia lógica y añade criterios de terminación.

**Parámetros:**
  - `objetivo` (string, requerido): Objetivo a descomponer
  - `max_pasos` (number, opcional): Máximo pasos

### `estimate_complexity`
Estima la complejidad de un objetivo (baja/media/alta) por señales: alcance, dominios involucrados, incertidumbre y dependencias externas.

**Parámetros:**
  - `objetivo` (string, requerido): Objetivo
  - `contexto` (string, opcional): Contexto adicional

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "plan-decompose": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-plan-decompose/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

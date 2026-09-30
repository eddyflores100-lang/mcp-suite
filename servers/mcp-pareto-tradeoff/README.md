# Pareto Tradeoff

> Frontera de Pareto para decisiones multi-objetivo: qué opciones son dominadas y cuál es el punto de equilibrio

**Categoría:** Razonamiento · **ID:** `mcp-pareto-tradeoff`

**Dolor de agente que resuelve:** El agente elige 'la mejor opción' cuando había 3 incomparables: sin calcular la frontera de Pareto no distingue las opciones dominadas de las trade-off reales, y recomienda la que más le gusta narrativamente.

> Estado persistente en `~/.mcp-suite/pareto-tradeoff/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `add_option`
Añade una opción al problema de decisión con sus valores en cada objetivo.

**Parámetros:**
  - `decision` (string, requerido): Nombre de la decisión
  - `opcion` (string, requerido): Nombre de la opción
  - `objetivos` (any, requerido): Valores {objetivo: valor numérico}
  - `direccion` (any, opcional): Por objetivo: 'max' o 'min' {objetivo: 'max'} (default max)

### `compute_frontier`
Calcula la frontera de Pareto: opciones dominadas fuera, incomparables dentro, con ranking por cobertura.

**Parámetros:**
  - `decision` (string, requerido): Decisión

### `knee_point`
Encuentra el punto rodilla de la frontera: la opción con mejor equilibrio sin normalizar al respecto.

**Parámetros:**
  - `decision` (string, requerido): Decisión

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "pareto-tradeoff": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-pareto-tradeoff/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/pareto-tradeoff/. Opciones con vectores de objetivos (todos maximizar o minimizar normalizados); cálculo de dominancia, frontera de Pareto y punto rodilla (knee) por distancia normalizada.

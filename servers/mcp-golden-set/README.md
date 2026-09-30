# Golden Set

> Conjuntos de casos dorados con scoring: el estándar contra el que se mide cada cambio del agente

**Categoría:** Evaluación Continua · **ID:** `mcp-golden-set`

**Dolor de agente que resuelve:** Cada cambio (prompt, modelo, tool) se valida 'a ojo' con 2-3 ejemplos que salieron bien: no hay golden set con expected outputs, así que las regresiones se detectan en producción.

> Estado persistente en `~/.mcp-suite/golden-set/state.json` (local, privado, tuya la data).

## Tools (7 incl. health_check)

### `create_suite`
Crea una suite de evaluación con nombre y descripción del criterio global de calidad.

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la suite
  - `descripcion` (string, requerido): Qué mide esta suite

### `add_case`
Añade un caso dorado: input, salida esperada, método de match y categoría.

**Parámetros:**
  - `suite` (string, requerido): Nombre de la suite
  - `input` (string, requerido): Entrada del caso
  - `expected` (string, requerido): Salida esperada (dorado)
  - `metodo` (enum, opcional): Método de match
  - `categoria` (string, opcional): Categoría (ej: edge-case, happy-path)
  - `tolerancia` (number, opcional): Solo numerico: tolerancia +/-

### `run_suite`
Corre la suite contra las salidas actuales del agente (lista de outputs en el mismo orden) y puntúa.

**Parámetros:**
  - `suite` (string, requerido): Nombre de la suite
  - `outputs` (array, requerido): Salidas obtenidas (mismo orden que los casos)

### `suite_history`
Historial de corridas de una suite: tendencia del score y detección de regresión entre corridas.

**Parámetros:**
  - `suite` (string, requerido): Nombre de la suite

### `list_suites`
Lista todas las suites con su estado (casos, última corrida, score).

### `export_cases`
Exporta los casos de una suite (input/expected) para compartir o versionar el golden set.

**Parámetros:**
  - `suite` (string, requerido): Nombre de la suite

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "golden-set": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-golden-set/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/golden-set/. Suites de casos {input, expected, criterio} con métricas de match (exacto, contiene, semántico-lexical, numérico con tolerancia) y puntuación por suite y por categoría.

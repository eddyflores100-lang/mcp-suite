# Prompt A/B Test

> Experimentos A/B de prompts con métricas objetivas: deja de afinar prompts por intuición

**Categoría:** Evaluación Continua · **ID:** `mcp-prompt-ab-test`

**Dolor de agente que resuelve:** Se afina el prompt por intuición y 'se siente mejor': sin A/B con métricas, la mitad de los cambios de prompt empeoran y nadie lo sabe.

> Estado persistente en `~/.mcp-suite/prompt-ab-test/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `create_experiment`
Crea un experimento A/B: nombre, qué se está probando y métrica de éxito.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del experimento
  - `hipotesis` (string, requerido): Qué crees que mejorará y por qué
  - `metrica` (enum, opcional): Métrica principal
  - `clave` (string, opcional): Palabra/frase clave esperada en la salida (para contiene_clave)

### `add_variant`
Añade una variante (A, B, C...) con el texto del prompt o configuración a comparar.

**Parámetros:**
  - `experimento` (string, requerido): Nombre del experimento
  - `etiqueta` (string, requerido): Etiqueta de la variante (A, B...)
  - `contenido` (string, requerido): Texto/cambio concreto de la variante

### `record_result`
Registra el resultado de una variante en un caso: salida obtenida (+costo en tokens opcional).

**Parámetros:**
  - `experimento` (string, requerido): Nombre del experimento
  - `variante` (string, requerido): Etiqueta de la variante
  - `caso` (string, requerido): Identificador del caso de prueba
  - `salida` (string, requerido): Salida obtenida
  - `exito_manual` (boolean, opcional): Para metrica=manual: ¿fue buena?
  - `tokens` (number, opcional): Costo en tokens de la salida

### `analyze`
Analiza el experimento: tasa de éxito por variante según la métrica, longitud media y recomendación de ganador.

**Parámetros:**
  - `experimento` (string, requerido): Nombre del experimento

### `close_experiment`
Cierra el experimento archivando el veredicto (qué variante se adoptó y qué se aprendió).

**Parámetros:**
  - `experimento` (string, requerido): Nombre del experimento
  - `ganador` (string, requerido): Variante adoptada
  - `aprendizaje` (string, requerido): Qué se aprendió (para el futuro)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "prompt-ab-test": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-prompt-ab-test/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/prompt-ab-test/. Experimentos con variantes A/B aplicadas a los mismos casos; scoring configurable (longitud, contiene-clave, sigue-formato, coste estimado) y significancia aproximada.

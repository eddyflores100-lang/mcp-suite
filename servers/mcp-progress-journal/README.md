# Progress Journal

> Diario de progreso con narrativa continua: qué se hizo, qué se intentó y falló, y dónde quedó

**Categoría:** Objetivos y Largo Plazo · **ID:** `mcp-progress-journal`

**Dolor de agente que resuelve:** Tras horas de trabajo el agente no puede responder '¿qué has hecho?': los intentos fallidos no se registran y el contexto se comprime perdiendo el rastro de lo ya intentado.

> Estado persistente en `~/.mcp-suite/progress-journal/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `add_entry`
Añade una entrada al diario: tipo (progreso, experimento, decision, bloqueo, hallazgo) y narrativa.

**Parámetros:**
  - `tipo` (enum, requerido): Tipo de entrada
  - `titulo` (string, requerido): Título corto
  - `detalle` (string, requerido): Narrativa completa: qué, cómo, resultado
  - `etiquetas` (array, opcional): Etiquetas
  - `exito` (boolean, opcional): Solo experimentos: ¿funcionó?

### `recent`
Últimas N entradas con filtro por tipo; incluye el resumen ejecutivo del estado.

**Parámetros:**
  - `n` (number, opcional): Cuántas entradas
  - `tipo` (string, opcional): Filtrar por tipo

### `stall_detector`
Detecta estancamiento: mismo tipo de bloqueo repetido o días sin entradas de progreso.

**Parámetros:**
  - `dias_umbral` (number, opcional): Días sin progreso para alertar

### `narrative`
Genera la narrativa continua del trabajo (para handoffs o reportes): cronología comprimida agrupada por día.

**Parámetros:**
  - `desde_entrada` (number, opcional): Número de entrada inicial

### `experiments_recap`
Balance de experimentos: qué se probó, qué funcionó y tasa de acierto global.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "progress-journal": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-progress-journal/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/progress-journal/. Entradas cronológicas tipo entrada/experimento/decisión/bloqueo con resumen ejecutivo dinámico y detección de estancamiento (mismo bloqueo repetido).

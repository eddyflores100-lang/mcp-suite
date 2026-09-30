# Temporal Reasoner

> Razonamiento temporal: antes/después, solapamientos, duraciones y secuencias consistentes

**Categoría:** Frescura del Conocimiento · **ID:** `mcp-temporal-reasoner`

**Dolor de agente que resuelve:** El agente dice cosas temporalmente imposibles: 'el despliegue del lunes usó el bug corregido el miércoles', cita eventos solapados como secuenciales y nadie verifica la coherencia temporal.

## Tools (5 incl. health_check)

### `check_sequence`
Valida que una secuencia de eventos fechados es cronológicamente posible.

**Parámetros:**
  - `eventos` (array, requerido): Lista {etiqueta, fecha} en el orden narrado

### `overlap_check`
Comprueba si dos intervalos temporales se solapan, contienen o son disjuntos.

**Parámetros:**
  - `a_inicio` (string, requerido): Inicio intervalo A (ISO)
  - `a_fin` (string, requerido): Fin intervalo A
  - `b_inicio` (string, requerido): Inicio intervalo B
  - `b_fin` (string, requerido): Fin intervalo B

### `relative_time`
Convierte lenguaje temporal relativo a absoluto y viceversa (hace N días, la semana pasada...).

**Parámetros:**
  - `expresion` (string, requerido): Expresión temporal ('hace 3 dias', 'en 2 semanas', ISO)

### `consistency_scan`
Escanea un texto en busca de afirmaciones temporales inconsistentes (fechas imposibles entre sí).

**Parámetros:**
  - `texto` (string, requerido): Texto a auditar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "temporal-reasoner": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-temporal-reasoner/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Sin persistencia. Intervalos {inicio, fin, etiqueta}: orden, solapamiento, contención, duración y validación de afirmaciones secuenciales.

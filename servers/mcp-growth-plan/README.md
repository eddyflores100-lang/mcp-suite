# Growth Plan

> Plan de práctica deliberada del agente: debilidades convertidas en ejercicios con progresión y revisión

**Categoría:** Auto-Mejora · **ID:** `mcp-growth-plan`

**Dolor de agente que resuelve:** El agente 'aprende' de sus errores en el sentido de que los vuelve a cometer distinto. Sin convertir debilidades en ejercicios con progresión, la experiencia se acumula como edad, no como habilidad.

> Estado persistente en `~/.mcp-suite/growth-plan/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `add_weakness`
Añade una debilidad detectada (con origen trazable).

**Parámetros:**
  - `debilidad` (string, requerido): La debilidad en una frase accionable
  - `origen` (string, requerido): Dónde se detectó (familia de errores, reflexión, incidente)
  - `frecuencia` (number, opcional): Cuántas veces ha pasado

### `plan_practice`
Diseña una unidad de práctica deliberada para una debilidad.

**Parámetros:**
  - `debilidad_id` (string, requerido): Id de la debilidad (deb_001)
  - `ejercicio` (string, requerido): El ejercicio concreto y reproducible
  - `criterio_exito` (string, requerido): Cómo se sabe que se superó (medible)
  - `repeticiones_objetivo` (number, opcional): Éxitos consecutivos para cerrar

### `log_practice`
Registra un intento de práctica con su resultado contra el criterio.

**Parámetros:**
  - `debilidad_id` (string, requerido): Debilidad
  - `ejercicio_idx` (number, requerido): Índice del ejercicio (1-based)
  - `exito` (boolean, requerido): ¿Superó el criterio?
  - `observacion` (string, opcional): Qué pasó exactamente

### `progress_review`
Revisión global del plan de crecimiento: qué se cerró, qué se estancó, qué se ignora.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "growth-plan": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-growth-plan/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/growth-plan/. Debilidades (de error-taxonomy/reflection-journal) convertidas en unidades de práctica con criterio de éxito; registro de práctica y revisión de progresión.

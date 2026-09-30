# Reflection Journal

> Diario de reflexión del agente: qué funcionó, qué no, qué sorprendió — y las lecciones destiladas al final del período

**Categoría:** Auto-Mejora · **ID:** `mcp-reflection-journal`

**Dolor de agente que resuelve:** El agente termina 30 tareas y no extrae NADA: las sorpresas de la semana pasada se repiten esta semana porque nunca hubo un momento estructurado de mirar atrás. Sin reflexión, la experiencia no se convierte en aprendizaje.

> Estado persistente en `~/.mcp-suite/reflection-journal/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `new_reflection`
Registra una reflexión post-tarea: lo que funcionó, lo que falló y lo que sorprendió.

**Parámetros:**
  - `tarea` (string, requerido): Tarea/Contexto de la reflexión
  - `funciono` (string, requerido): Qué táctica/decisión funcionó y por qué crees que sí
  - `fallo` (string, requerido): Qué falló o costó de más
  - `sorpresa` (string, opcional): Qué te sorprendió (lo no anticipado)
  - `leccion_candidata` (string, opcional): Regla extraíble de esta experiencia

### `review_period`
Revisa el período: patrones entre reflexiones y lecciones candidatas que se repiten.

**Parámetros:**
  - `dias` (number, opcional): Ventana hacia atrás

### `extract_lessons`
Extrae las lecciones confirmables: candidatas que aparecen 2+ veces o con sorpresa fuerte.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "reflection-journal": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-reflection-journal/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/reflection-journal/. Entradas de reflexión (funcionó/falló/sorpresa/lección candidata); revisión de período que cruza entradas y promueve lecciones candidatas con ≥2 apariciones a lecciones confirmadas.

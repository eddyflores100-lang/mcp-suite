# Lesson Library

> Biblioteca de lecciones recuperables por situación: el agente recuerda lo que ya aprendió

**Categoría:** Aprendizaje de Habilidades · **ID:** `mcp-lesson-library`

**Dolor de agente que resuelve:** El conocimiento aprendido ('con ese proveedor, valida el JSON antes de parsear') no sobrevive la sesión: cada instancia del agente vuelve a cometer el error porque no hay biblioteca consultable.

> Estado persistente en `~/.mcp-suite/lesson-library/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `add_lesson`
Añade una lección: situación en que aplica, la regla y etiquetas para recuperación.

**Parámetros:**
  - `situacion` (string, requerido): Cuándo aplica (situación observable)
  - `regla` (string, requerido): Qué hacer (accionable)
  - `etiquetas` (array, opcional): Etiquetas temáticas
  - `origen` (string, opcional): De dónde viene (postmortem, humano, manual)

### `recall_lessons`
Recupera lecciones relevantes para la situación actual (match lexical + etiquetas) con score.

**Parámetros:**
  - `situacion_actual` (string, requerido): Qué está a punto de hacer el agente
  - `max` (number, opcional): Máximo a devolver

### `most_used`
Lecciones más reutilizadas: cuáles están demostrando valor real.

### `retire_lesson`
Retira una lección obsoleta (ya no aplica porque cambió el entorno), con motivo.

**Parámetros:**
  - `leccion_id` (string, requerido): ID de la lección
  - `motivo` (string, requerido): Por qué ya no aplica

### `library_stats`
Salud de la biblioteca: tamaño, tasa de uso, cobertura por etiqueta y antigüedad.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "lesson-library": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-lesson-library/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/lesson-library/. Lecciones situación→regla con etiquetas y contador de reutilización; búsqueda lexical por situación y recordatorio proactivo.

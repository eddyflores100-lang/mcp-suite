# Postmortem Engine

> Postmortems estructurados que se convierten en lecciones: convierte cada fallo en activo permanente

**Categoría:** Aprendizaje de Habilidades · **ID:** `mcp-postmortem-engine`

**Dolor de agente que resuelve:** Cada fallo del agente genera conversación pero no activo: la lección muere con la sesión y el mismo error vuelve la semana siguiente. Nadie escribe el postmortem porque 'no hay tiempo'.

> Estado persistente en `~/.mcp-suite/postmortem-engine/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `start_postmortem`
Abre un postmortem por un incidente con el borrador de las 5 secciones obligatorias.

**Parámetros:**
  - `titulo` (string, requerido): Título del incidente
  - `severidad` (enum, requerido): Severidad
  - `que_paso` (string, requerido): Narrativa factual de lo ocurrido

### `fill_section`
Completa una sección del postmortem (causa_raiz, impacto, lo_evitaba, accion_preventiva).

**Parámetros:**
  - `postmortem_id` (string, requerido): ID del postmortem
  - `seccion` (enum, requerido): Sección a completar
  - `contenido` (string, requerido): Contenido de la sección

### `review_postmortem`
Audita la calidad del postmortem: completitud, especificidad y accionabilidad de la causa raíz.

**Parámetros:**
  - `postmortem_id` (string, requerido): ID del postmortem

### `convert_to_lesson`
Convierte el postmortem en lección (formato situación→regla) lista para lesson-library.

**Parámetros:**
  - `postmortem_id` (string, requerido): ID del postmortem
  - `aplicable_cuando` (string, requerido): Situación futura en que aplica la lección

### `postmortem_stats`
Estadísticas: incidentes documentados, tasa de conversión a lección y severidad dominante.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "postmortem-engine": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-postmortem-engine/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/postmortem-engine/. Postmortems 5-secciones (qué pasó, causa raíz, impacto, qué lo evitaba, acción preventiva) con verificación de completitud y tasa de conversión a lección.

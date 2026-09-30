# Source Timeline

> Línea de tiempo de fuentes: cuándo se supo qué y qué fuente dijo primero cada cosa

**Categoría:** Frescura del Conocimiento · **ID:** `mcp-source-timeline`

**Dolor de agente que resuelve:** El agente funde información de fuentes de distinta época en un solo presente: dice 'según los informes' mezclando 2019 con 2026 sin poder reconstruir qué se sabía en qué momento.

> Estado persistente en `~/.mcp-suite/source-timeline/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `add_event`
Añade un evento de conocimiento: fuente, fecha, afirmación y tema.

**Parámetros:**
  - `fuente` (string, requerido): Nombre de la fuente
  - `fecha` (string, requerido): Fecha ISO de la publicación/observación
  - `afirmacion` (string, requerido): Qué afirmó
  - `tema` (string, opcional): Tema (para agrupar)

### `timeline`
Devuelve la línea de tiempo cronológica (global o por tema) con edad de cada afirmación.

**Parámetros:**
  - `tema` (string, opcional): Filtrar por tema

### `contradiction_scan`
Escanea contradicciones cronológicas: fuentes posteriores que afirman lo opuesto sobre el mismo tema.

### `who_said_first`
Para un tema/afirmación: qué fuente lo dijo primero y quién lo replicó después.

**Parámetros:**
  - `consulta` (string, requerido): Tema o palabra clave

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "source-timeline": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-source-timeline/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/source-timeline/. Eventos de conocimiento {fuente, fecha, afirmación}; timeline cronológico, contradicciones cronológicas (una fuente posterior contradice) y quién dijo primero.

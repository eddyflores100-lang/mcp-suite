# Competency Tracker

> Matriz de competencias del agente: en qué es fiable, en qué necesita supervisión humana

**Categoría:** Aprendizaje de Habilidades · **ID:** `mcp-competency-tracker`

**Dolor de agente que resuelve:** No se sabe en qué es bueno el agente: se le delega tareas donde falla sistemáticamente y se le supervisa tareas que ya domina. Sin matriz de competencias, la delegación es a ciegas.

> Estado persistente en `~/.mcp-suite/competency-tracker/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `define_competency`
Define una competencia rastreable (área, descripción, cómo se mide).

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la competencia
  - `area` (string, requerido): Área (datos, código, redacción, análisis...)
  - `como_se_mide` (string, requerido): Evidencia de éxito (qué cuenta como acierto)

### `record_outcome`
Registra un resultado (éxito/fallo) de la competencia en una tarea concreta.

**Parámetros:**
  - `nombre` (string, requerido): Competencia
  - `exito` (boolean, requerido): ¿La tarea salió bien?
  - `tarea` (string, opcional): Tarea concreta

### `competency_matrix`
Matriz completa: nivel por competencia (novato/competente/experto) y qué necesita supervisión.

### `learning_progress`
Progreso de aprendizaje por competencia: ¿la tasa de éxito mejora con la práctica?

**Parámetros:**
  - `nombre` (string, requerido): Competencia

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "competency-tracker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-competency-tracker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/competency-tracker/. Competencias con evidencia de éxito/fallo acumulada; nivel derivado (novato→competente→experto) y recomendación de supervisión por área.

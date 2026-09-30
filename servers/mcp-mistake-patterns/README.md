# Mistake Patterns

> Detecta patrones recurrentes de error: la tercera vez que fallas igual ya no es mala suerte

**Categoría:** Aprendizaje de Habilidades · **ID:** `mcp-mistake-patterns`

**Dolor de agente que resuelve:** Los errores se registran individualmente y nunca se cruzan: el agente falla igual 5 veces en contextos distintos y nadie conecta los puntos porque cada incidente parece distinto.

> Estado persistente en `~/.mcp-suite/mistake-patterns/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `log_mistake`
Registra un error cometido (contexto + descripción) para el análisis de patrones.

**Parámetros:**
  - `contexto` (string, requerido): Qué tarea/situación
  - `descripcion` (string, requerido): Qué se hizo mal exactamente
  - `costo` (string, opcional): Costo del error (tokens, tiempo, daño)

### `detect_patterns`
Agrupa errores similares (clustering lexical) y devuelve patrones con recurrencia y daño.

**Parámetros:**
  - `umbral_similitud` (number, opcional): Similitud Jaccard para agrupar (0-1)

### `same_mistake_check`
Antes de actuar: ¿ya fallé haciendo exactamente esto? Devuelve el historial similar.

**Parámetros:**
  - `accion_prevista` (string, requerido): Lo que estás a punto de hacer

### `mistake_stats`
Estadísticas de errores: frecuencia temporal, contexto más propenso y mejora (errores/semana).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "mistake-patterns": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-mistake-patterns/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/mistake-patterns/. Registra errores {contexto, descripción}; clustering lexical agrupa errores similares y detecta recurrencia con umbral configurable.

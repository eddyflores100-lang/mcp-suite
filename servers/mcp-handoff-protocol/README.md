# Handoff Protocol

> Transferencias estructuradas entre agentes con checklist de comprensión y score de calidad

**Categoría:** Multi-Agente y Coordinación · **ID:** `mcp-handoff-protocol`

**Dolor de agente que resuelve:** Los handoffs entre agentes pierden estado: el receptor reinventa el contexto, repite trabajo ya hecho y descubre los riesgos tarde. 'Coordination gaps' es causa raíz de fallo multi-agente.

> Estado persistente en `~/.mcp-suite/handoff-protocol/state.json` (local, privado, tuya la data).

## Tools (8 incl. health_check)

### `create_handoff`
Crea un handoff estructurado: resumen de contexto, estado actual, pendientes priorizados, riesgos conocidos y artefactos clave.

**Parámetros:**
  - `de` (string, requerido): Agent_id que transfiere
  - `para` (string, requerido): Agent_id que recibe
  - `contexto` (string, requerido): Resumen del contexto esencial (objetivo, decisiones tomadas)
  - `estado_actual` (string, requerido): En qué punto exacto está el trabajo
  - `pendientes` (array, opcional): Tareas pendientes
  - `riesgos` (array, opcional): Riesgos conocidos y trampas
  - `artefactos` (array, opcional): Rutas/IDs de artefactos relevantes

### `get_handoff`
Handoff completo con checklist de recepción sugerida.

**Parámetros:**
  - `handoff_id` (string, requerido): ID del handoff

### `acknowledge`
El receptor confirma recepción, declara qué entendió y qué preguntas tiene; devuelve los gaps detectados.

**Parámetros:**
  - `handoff_id` (string, requerido): ID del handoff
  - `entendido` (string, requerido): Qué entendió el receptor (sus palabras)
  - `preguntas` (array, opcional): Preguntas o ambigüedades detectadas
  - `acepta` (boolean, opcional): false = rechaza el handoff por incompleto

### `list_handoffs`
Lista handoffs por dirección, estado o agente; marca los huérfanos (sin acknowledge).

**Parámetros:**
  - `agente` (string, opcional): Filtrar de/para este agente
  - `estado` (string, opcional): creado, aceptado, rechazado, cerrado

### `complete_task`
Marca un pendiente del handoff como hecho (quien recibe avanza sin perder rastro).

**Parámetros:**
  - `handoff_id` (string, requerido): ID del handoff
  - `n` (number, requerido): Número del pendiente

### `handoff_quality`
Audita un handoff: completitud de secciones, densidad de contexto, riesgos declarados y resultado del acknowledge.

**Parámetros:**
  - `handoff_id` (string, requerido): ID del handoff

### `handoff_stats`
Estadísticas de transferencias: ratio de aceptación, preguntas medias, huérfanos y tiempo hasta acknowledge.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "handoff-protocol": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-handoff-protocol/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/handoff-protocol/. Handoff = contexto + estado + pendientes + riesgos. El receptor hace acknowledge con preguntas; se mide la calidad (completitud de secciones) y cuántos handoffs quedaron huérfanos.

# Explain Decision

> Explica decisiones post-hoc con evidencia: qué sabía, qué opciones descartó y por qué eligió

**Categoría:** Humano en el Bucle · **ID:** `mcp-explain-decision`

**Dolor de agente que resuelve:** El agente no puede explicar por qué hizo algo: no conserva qué información tenía, qué alternativas consideró ni qué criterio aplicó. Sin explicación, no hay confianza ni auditoría posible.

> Estado persistente en `~/.mcp-suite/explain-decision/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `record_decision`
Registra una decisión con su contexto completo (evidencia, opciones, criterio, elegida).

**Parámetros:**
  - `decision` (string, requerido): Decisión tomada
  - `situacion` (string, requerido): Situación que la motivó
  - `evidencia` (array, requerido): Datos/hechos en los que se basó
  - `opciones_consideradas` (array, requerido): Alternativas evaluadas
  - `criterio` (string, requerido): Criterio de elección
  - `elegida_porque` (string, requerido): Por qué ganó la elegida
  - `resultado_esperado` (string, requerido): Qué se espera que ocurra

### `explain`
Reconstruye la explicación completa de una decisión (para auditoría o pregunta del humano).

**Parámetros:**
  - `decision_id` (string, requerido): ID de la decisión

### `record_outcome`
Registra el resultado real de la decisión y califica el criterio (acertó o no).

**Parámetros:**
  - `decision_id` (string, requerido): ID de la decisión
  - `resultado_real` (string, requerido): Qué pasó realmente
  - `acierto` (boolean, requerido): ¿El criterio acertó?

### `decision_audit`
Auditoría de decisiones: tasa de acierto del criterio y patrones de decisiones mal soportadas.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "explain-decision": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-explain-decision/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/explain-decision/. Decisión = situación + evidencia disponible + opciones consideradas + criterio + elegida + resultado esperado; reconstructible a posteriori.

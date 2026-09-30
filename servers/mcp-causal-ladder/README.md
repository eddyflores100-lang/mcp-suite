# Causal Ladder

> Escalera de Pearl aplicada: clasifica tu pregunta (asociación/intervención/contrafactual) y exige el método que le corresponde

**Categoría:** Razonamiento · **ID:** `mcp-causal-ladder`

**Dolor de agente que resuelve:** El agente responde '¿qué pasa si intervenimos?' con datos observacionales: mezcla los peldaños de la escalera causal y entrega correlación disfrazada de causalidad. Nadie le exige el método que cada pregunta merece.

> Estado persistente en `~/.mcp-suite/causal-ladder/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `classify_question`
Clasifica una pregunta en el peldaño correcto de la escalera causal.

**Parámetros:**
  - `pregunta` (string, requerido): La pregunta analítica

### `check_method`
Verifica que el método elegido puede responder la pregunta clasificada.

**Parámetros:**
  - `pregunta` (string, requerido): La pregunta
  - `metodo` (string, requerido): El método con el que piensas responderla

### `ladder_report`
Auditoría de un análisis completo: qué peldaños cubre y dónde salta sin permiso.

**Parámetros:**
  - `analisis` (string, requerido): Descripción del análisis (pregunta + método + conclusión)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "causal-ladder": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-causal-ladder/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/causal-ladder/. Clasifica preguntas por peldaño (1 asociación, 2 intervención, 3 contrafactual); valida que el método propuesto pertenece al peldaño correcto y sugiere el método adecuado.

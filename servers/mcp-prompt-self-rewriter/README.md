# Prompt Self-Rewriter

> Auto-edición de prompts con guardarrailes: el agente propone su propia mejora pero no puede debilitar sus restricciones

**Categoría:** Auto-Mejora · **ID:** `mcp-prompt-self-rewriter`

**Dolor de agente que resuelve:** El agente 'optimiza' su propio prompt y sin querer borra la línea que prohibía exfiltrar datos: la auto-mejora sin candados es la vía rápida a la auto-anulación de las normas.

> Estado persistente en `~/.mcp-suite/prompt-self-rewriter/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `register_prompt`
Registra el prompt actual con su intención y la lista de restricciones intocables.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del prompt
  - `contenido` (string, requerido): Texto completo actual
  - `intencion` (string, requerido): Qué debe lograr el prompt
  - `restricciones` (array, requerido): Restricciones que NUNCA pueden debilitarse (texto o resumen por línea)

### `propose_edit`
Propón una edición concreta del prompt con justificación basada en evidencia.

**Parámetros:**
  - `nombre` (string, requerido): Prompt
  - `tipo` (enum, requerido): Naturaleza de la edición
  - `edicion` (string, requerido): El cambio concreto (texto a añadir/quitar/reordenar)
  - `porque` (string, requerido): Evidencia de que mejora: qué fallo concreto corrige

### `guardrail_check`
Valida una edición propuesta contra las restricciones intocables y la intención del prompt.

**Parámetros:**
  - `nombre` (string, requerido): Prompt
  - `indice` (number, requerido): Índice de la edición propuesta (1-based)

### `commit_eval`
Puerta de evaluación: adoptar una edición exige evidencia de mejora medida, no opinión.

**Parámetros:**
  - `nombre` (string, requerido): Prompt
  - `indice` (number, requerido): Edición aprobada
  - `evidencia_mejora` (string, requerido): Medición de la mejora (A/B, score antes/después)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "prompt-self-rewriter": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-prompt-self-rewriter/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/prompt-self-rewriter/. Prompt actual + intención + restricciones; las ediciones propuestas pasan guardarrailes (no eliminar restricciones, no ampliar alcance) y exigen puerta de evaluación antes de adoptarse.

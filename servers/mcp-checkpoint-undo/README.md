# Checkpoint Undo

> Checkpoints antes de acciones destructivas + rollback: el botón de 'deshacer' para agentes

**Categoría:** Computer Use · **ID:** `mcp-checkpoint-undo`

**Dolor de agente que resuelve:** El agente borra una fila, envía un email o confirma un pago por error y no hay Ctrl+Z: el daño es irreversible porque ninguna acción destructiva fue precedida de checkpoint.

> Estado persistente en `~/.mcp-suite/checkpoint-undo/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `gate_action`
Evalúa una acción ANTES de ejecutarla: nivel de riesgo y si exige checkpoint o confirmación humana.

**Parámetros:**
  - `accion` (string, requerido): Acción contemplada
  - `contexto` (string, opcional): Dónde/sobre qué

### `save_checkpoint`
Graba un checkpoint de estado pre-acción: qué se va a tocar, estado previo y cómo deshacerlo.

**Parámetros:**
  - `etiqueta` (string, requerido): Etiqueta del checkpoint
  - `accion_planned` (string, requerido): Acción destructiva que sigue
  - `estado_previo` (any, requerido): Estado serializable ANTES de actuar (valores, texto, flags)
  - `plan_rollback` (string, requerido): Cómo restaurar el estado_previo manualmente

### `restore`
Marca un checkpoint como restaurado y devuelve el estado previo + plan de rollback a ejecutar.

**Parámetros:**
  - `n` (number, requerido): Número del checkpoint
  - `motivo` (string, opcional): Por qué se revierte

### `undo_stack`
Pila de checkpoints recientes (los no restaurados primero): el historial de puntos de retorno.

### `risk_stats`
Estadísticas de riesgo: acciones destructivas emprendidas, rollbacks necesarios y tasa de arrepentimiento.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "checkpoint-undo": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-checkpoint-undo/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/checkpoint-undo/. Checkpoints de estado antes de acciones riesgosas con nivel de destructividad; gateo pre-acción y plan de rollback estructurado.

# Interruption Broker

> Gestiona interrupciones del humano: pausa limpia, preserva estado y replanifica al reanudar

**Categoría:** Humano en el Bucle · **ID:** `mcp-interruption-broker`

**Dolor de agente que resuelve:** El humano interrumpe al agente a mitad de tarea y el agente o ignora la interrupción o pierde todo el estado: no hay protocolo de pausa que preserve qué estaba haciendo y por dónde iba.

> Estado persistente en `~/.mcp-suite/interruption-broker/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `interrupt`
El humano interrumpe: graba snapshot del estado actual del agente y prioriza el nuevo pedido.

**Parámetros:**
  - `razon` (string, requerido): Por qué interrumpe el humano
  - `tarea_en_curso` (string, requerido): Qué estaba haciendo el agente
  - `paso_actual` (string, requerido): Por dónde iba exactamente
  - `siguiente_accion_prevista` (string, requerido): Qué iba a hacer a continuación
  - `nuevo_pedido` (string, opcional): Lo que el humano quiere ahora

### `resume`
Reanuda tras la interrupción: devuelve el snapshot y sugiere replanificación si el contexto cambió.

**Parámetros:**
  - `interrupcion_n` (number, opcional): Número de la interrupción a reanudar
  - `contexto_cambio` (string, opcional): Qué cambió durante la interrupción (si algo)

### `pending_interruptions`
Lista interrupciones activas (sin reanudar) con su antigüedad.

### `interruption_stats`
Estadísticas: frecuencia de interrupciones por sesión y motivo dominante.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "interruption-broker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-interruption-broker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/interruption-broker/. Interrupciones con snapshot de estado (tarea, paso, siguiente acción); al reanudar devuelve el contexto + replanificación sugerida si la interrupción cambió algo.

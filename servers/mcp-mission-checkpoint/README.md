# Mission Checkpoint

> Checkpoints verificables de misiones largas: pausa, reanuda y recupera sin repetir trabajo

**Categoría:** Objetivos y Largo Plazo · **ID:** `mcp-mission-checkpoint`

**Dolor de agente que resuelve:** Las misiones largas mueren al reiniciarse: no hay checkpoints, así que el agente rehace horas de trabajo ya validado o pierde el hilo de lo que faltaba exactamente.

> Estado persistente en `~/.mcp-suite/mission-checkpoint/state.json` (local, privado, tuya la data).

## Tools (7 incl. health_check)

### `start_mission`
Abre una misión de largo aliento con fases esperadas y plan de checkpoints.

**Parámetros:**
  - `mision` (string, requerido): Nombre de la misión
  - `fases` (array, requerido): Fases esperadas en orden

### `checkpoint`
Graba un checkpoint: fase actual, estado completo, criterios validados y puntero de reanudación.

**Parámetros:**
  - `mision_id` (string, requerido): ID de la misión
  - `fase` (string, requerido): Fase completada o en curso
  - `estado` (any, requerido): Estado serializable (JSON) para reanudar
  - `reanudar_en` (string, requerido): Instrucción exacta de por dónde seguir
  - `criterios_validados` (array, opcional): Criterios ya verificados

### `resume`
Reanuda desde el último checkpoint: devuelve estado, instrucción de continuación y trabajo ya validado (no repetir).

**Parámetros:**
  - `mision_id` (string, requerido): ID de la misión

### `rollback_checkpoint`
Vuelve a un checkpoint anterior: descarta el trabajo posterior documentando qué se pierde.

**Parámetros:**
  - `mision_id` (string, requerido): ID de la misión
  - `checkpoint_n` (number, requerido): Número del checkpoint destino
  - `motivo` (string, requerido): Por qué se vuelve atrás

### `mission_report`
Reporte de la misión: fases, checkpoints, rollbacks y ahorro estimado por no repetir trabajo.

**Parámetros:**
  - `mision_id` (string, requerido): ID de la misión

### `close_mission`
Cierra la misión (completada o abandonada) archivando el rastro completo.

**Parámetros:**
  - `mision_id` (string, requerido): ID de la misión
  - `resultado` (enum, requerido): Desenlace
  - `notas` (string, opcional): Cierre

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "mission-checkpoint": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-mission-checkpoint/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/mission-checkpoint/. Checkpoints con estado serializable, criterios ya validados y puntero de reanudación. Estimación de ahorro (trabajo no repetido).

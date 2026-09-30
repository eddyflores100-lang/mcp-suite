# Requirements Matrix

> Trazabilidad requisito → tarea → evidencia: nada se pierde entre lo pedido y lo entregado

**Categoría:** Especificación y Requisitos · **ID:** `mcp-requirements-matrix`

**Dolor de agente que resuelve:** Sin trazabilidad, requisitos se pierden en el camino: el agente los olvida, las tareas derivan y al final nadie puede demostrar que cada requisito pedido tiene evidencia de cumplimiento.

> Estado persistente en `~/.mcp-suite/requirements-matrix/state.json` (local, privado, tuya la data).

## Tools (7 incl. health_check)

### `add_requirement`
Añade un requisito rastrible al backlog de la misión.

**Parámetros:**
  - `requisito` (string, requerido): Texto del requisito
  - `fuente` (string, opcional): Quién lo pidió y cuándo

### `link_task`
Liga una tarea a un requisito (la tarea sirve a ese requisito).

**Parámetros:**
  - `requisito_id` (string, requerido): ID del requisito (R001)
  - `tarea` (string, requerido): Descripción de la tarea

### `complete_task`
Marca una tarea ligada como hecha; avanza el estado del requisito.

**Parámetros:**
  - `requisito_id` (string, requerido): ID del requisito
  - `tarea` (string, requerido): Texto (prefijo) de la tarea a cerrar

### `attach_evidence`
Adjunta evidencia de cumplimiento a un requisito y márcalo cubierto.

**Parámetros:**
  - `requisito_id` (string, requerido): ID del requisito
  - `evidencia` (string, requerido): Evidencia (test, URL, salida, revisión)

### `trace_report`
Reporte de trazabilidad: cobertura, huérfanos (requisito sin tarea, tarea sin requisito) y % verificado.

### `audit_question`
Responde la pregunta de auditoría: '¿dónde está la evidencia del requisito X?'.

**Parámetros:**
  - `requisito_id` (string, requerido): ID o texto parcial del requisito

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "requirements-matrix": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-requirements-matrix/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/requirements-matrix/. Matriz R-T-E: requisito ↔ tareas ligadas ↔ evidencia de cumplimiento. Detecta requisitos huérfanos, tareas sin requisito y cobertura global.

# Compliance Report

> Reportes de cumplimiento por marco (HIPAA/GDPR/SOX-like): evidencia estructurada para el auditor

**Categoría:** Cumplimiento · **ID:** `mcp-compliance-report`

**Dolor de agente que resuelve:** Cuando llega la auditoría no hay nada que entregar: los controles existieron 'en teoría' pero no hay evidencia estructurada de qué control aplicó cuándo y con qué resultado.

> Estado persistente en `~/.mcp-suite/compliance-report/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `define_control`
Define un control de cumplimiento para un marco: qué exige y cómo se satisface.

**Parámetros:**
  - `marco` (enum, requerido): Marco de referencia
  - `control_id` (string, requerido): Identificador del control (ej: Art.32)
  - `exige` (string, requerido): Qué exige el control
  - `como_se_cumple` (string, requerido): Cómo lo cubre el agente/sistema

### `attach_evidence`
Adjunta evidencia a un control (prueba de que se aplicó) y actualiza su estado.

**Parámetros:**
  - `marco` (string, requerido): Marco
  - `control_id` (string, requerido): Control
  - `evidencia` (string, requerido): Evidencia (log, artefacto, test)
  - `estado` (enum, opcional): Estado resultante

### `generate_report`
Genera el reporte de cumplimiento de un marco: cobertura, controles sin evidencia y brechas.

**Parámetros:**
  - `marco` (string, requerido): Marco a reportar (o 'todos')

### `gap_plan`
Plan de cierre de brechas: qué controlar primero según criticidad del control.

**Parámetros:**
  - `marco` (string, opcional): Marco

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "compliance-report": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-compliance-report/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/compliance-report/. Controles por marco con estado (implementado/parcial/faltante) y evidencia ligada; genera reporte ejecutable por marco.

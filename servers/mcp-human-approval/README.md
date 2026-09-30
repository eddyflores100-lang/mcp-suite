# Human Approval

> Flujo de aprobación humana: solicitudes, vencimientos y registro

**Categoría:** Comunicación y Humano · **ID:** `mcp-human-approval`

**Dolor de agente que resuelve:** Las acciones críticas se ejecutan sin visto bueno: human-in-the-loop es promesa, no práctica.

> Estado persistente en `~/.mcp-suite/human-approval/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `request_approval`
Solicita aprobación para una acción: contexto, riesgo y qué pasa si no se aprueba. Vence en N horas.

**Parámetros:**
  - `accion` (string, requerido): Acción que requiere aprobación
  - `contexto` (string, requerido): Por qué se propone
  - `riesgo_si_rechaza` (string, opcional): Riesgo de NO aprobar
  - `vence_horas` (number, opcional): Vencimiento en horas

### `respond_approval`
Resuelve una aprobación: aprobar, rechazar (con motivo) o pedir más info.

**Parámetros:**
  - `id` (string, requerido): ID de aprobación
  - `decision` (enum, requerido): Decisión
  - `motivo` (string, opcional): Motivo

### `pending_approvals`
Lista aprobaciones pendientes con sus vencimientos (marca las vencidas).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "human-approval": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-human-approval/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

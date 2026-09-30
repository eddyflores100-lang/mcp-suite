# Milestone Checker

> Hitos con checkpoints de calidad: mide progreso real contra el plan

**Categoría:** Cognición y Planificación · **ID:** `mcp-milestone-checker`

**Dolor de agente que resuelve:** El '90% listo' del agente es mentira estadística: sin hitos verificables no hay progreso medible.

> Estado persistente en `~/.mcp-suite/milestone-checker/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `define_milestones`
Define los hitos de un proyecto: nombre, criterio verificable y peso relativo.

**Parámetros:**
  - `proyecto` (string, requerido): Proyecto
  - `hitos` (array, requerido): Lista de {nombre, criterio, peso}

### `evaluate`
Marca un hito como cumplido (o lo revierte) evaluando su criterio.

**Parámetros:**
  - `proyecto` (string, requerido): Proyecto
  - `hito` (number, requerido): Número de hito
  - `cumplido` (boolean, opcional): ¿Cumplido?
  - `evidencia` (string, opcional): Evidencia del cumplimiento

### `progress`
Reporte de progreso del proyecto: hitos cumplidos/pendientes, próximos y estancados.

**Parámetros:**
  - `proyecto` (string, requerido): Proyecto

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "milestone-checker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-milestone-checker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

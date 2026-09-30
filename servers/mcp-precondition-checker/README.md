# Precondition Checker

> Puerta de arranque: todas las precondiciones del plan verificadas con evidencia antes de gastar un solo token

**Categoría:** Pre-Vuelo · **ID:** `mcp-precondition-checker`

**Dolor de agente que resuelve:** El agente arranca una tarea de 40 pasos y en el 35 descubre que le faltaba una credencial que se pide en el paso 1: media hora y un montón de tokens tirados a la basura por no chequear antes.

> Estado persistente en `~/.mcp-suite/precondition-checker/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `define_checks`
Declara las precondiciones de una tarea: qué verificar y cómo se comprueba.

**Parámetros:**
  - `tarea` (string, requerido): Tarea/plan que quieres ejecutar
  - `checks` (array, requerido): Checks {nombre, tipo: estado|permiso|dato|conexion|tiempo, como_verificar}

### `check_all`
Evalúa cada check con tu observación real y emite el veredicto de arranque (GO/NO-GO/GO-CON-RIESGO).

**Parámetros:**
  - `tarea` (string, requerido): Tarea a evaluar
  - `resultados` (array, requerido): Resultados {nombre, observado, cumple: true|false|desconocido}

### `gate_report`
Último gate de una tarea: estado consolidado y qué camino tomar.

**Parámetros:**
  - `tarea` (string, requerido): Tarea

### `fail_stats`
Estadística de qué precondiciones fallan más: dónde poner automatización.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "precondition-checker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-precondition-checker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/precondition-checker/. Cada tarea declara checks (estado, permiso, dato, conexión); el gate evalúa cada uno con evidencia y emite GO / NO-GO / GO-CON-RIESGO.

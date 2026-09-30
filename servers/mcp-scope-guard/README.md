# Scope Guard

> Detecta scope creep del agente: trabajo fuera del alcance acordado antes de gastar tokens en él

**Categoría:** Objetivos y Largo Plazo · **ID:** `mcp-scope-guard`

**Dolor de agente que resuelve:** El agente 'ayuda de más': pide validar un formulario y termina refactorizando la app entera. El scope creep quema presupuesto y introduce riesgo sin que nadie lo autorizara.

> Estado persistente en `~/.mcp-suite/scope-guard/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `define_scope`
Define el alcance del encargo: qué incluye y qué queda EXPLÍCITAMENTE fuera (lo segundo es lo que importa).

**Parámetros:**
  - `incluye` (array, requerido): Ámbitos incluidos
  - `excluye` (array, requerido): Ámbitos explícitamente fuera de alcance
  - `presupuesto_tokens` (number, opcional): Presupuesto total del encargo

### `check_task`
Clasifica una tarea contra el alcance: dentro / borde / fuera, con el ámbito excluido que pisa (si aplica).

**Parámetros:**
  - `tarea` (string, requerido): Tarea o sub-tarea a clasificar

### `log_out_of_scope`
Registra trabajo fuera de alcance ya realizado (confesión) con tokens gastados: deuda de scope.

**Parámetros:**
  - `tarea` (string, requerido): Qué se hizo fuera de alcance
  - `tokens_gastados` (number, opcional): Tokens quemados
  - `resultado_util` (boolean, opcional): ¿Produjo algo aprovechable?

### `scope_report`
Reporte de disciplina de alcance: tareas clasificadas, deuda acumulada y % de presupuesto desperdiciado.

### `amend_scope`
Enmienda el alcance formalmente (nuevo incluye/excluye) con motivo: crecer alcance con permiso, no de contrabando.

**Parámetros:**
  - `incluye_extra` (array, opcional): Nuevos ámbitos incluidos
  - `excluye_extra` (array, opcional): Nuevos ámbitos excluidos
  - `motivo` (string, requerido): Quién autoriza y por qué

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "scope-guard": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-scope-guard/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/scope-guard/. Define el alcance incluido/explícito-excluido; clasifica tareas (dentro, borde, fuera) y acumula deuda de scope con costo estimado.

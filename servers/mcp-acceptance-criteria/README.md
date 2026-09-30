# Acceptance Criteria

> Convierte requests en criterios GIVEN/WHEN/THEN verificables con prioridad y trazabilidad

**Categoría:** Especificación y Requisitos · **ID:** `mcp-acceptance-criteria`

**Dolor de agente que resuelve:** Los 'definition of done' del agente son difusos: dice 'listo' cuando compiló, no cuando cumple criterios verificables que el humano podría auditar.

> Estado persistente en `~/.mcp-suite/acceptance-criteria/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `add_requirement`
Registra un requerimiento y genera su borrador de criterios de aceptación GIVEN/WHEN/THEN.

**Parámetros:**
  - `requerimiento` (string, requerido): Texto del requerimiento
  - `prioridad` (enum, opcional): MoSCoW
  - `contexto` (string, opcional): Contexto adicional

### `refine_criterion`
Refina un criterio concreto (GIVEN/WHEN/THEN exactos) para hacerlo objetivamente verificable.

**Parámetros:**
  - `requerimiento_id` (string, requerido): ID del requerimiento
  - `n` (number, requerido): Número del criterio
  - `given` (string, requerido): Contexto previo exacto
  - `when` (string, requerido): Acción concreta
  - `then` (string, requerido): Resultado observable y medible

### `verify_criterion`
Marca un criterio como verificado (o fallido) con evidencia: la definición objetiva de 'listo'.

**Parámetros:**
  - `requerimiento_id` (string, requerido): ID del requerimiento
  - `n` (number, requerido): Número del criterio
  - `pasado` (boolean, requerido): ¿Verificado?
  - `evidencia` (string, requerido): Cómo se verificó (test, revisión, salida)

### `ready_check`
¿Se puede declarar 'listo'? Solo si todos los must están verificados; lista lo que falta.

### `coverage_matrix`
Matriz requerimiento × criterios con estado, para auditoría rápida del avance.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "acceptance-criteria": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-acceptance-criteria/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/acceptance-criteria/. Convierte cada requerimiento en criterios GIVEN/WHEN/THEN priorizados (MoSCoW) con estado de verificación y evidencia.

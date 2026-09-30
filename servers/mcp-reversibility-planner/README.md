# Reversibility Planner

> Clasifica cada acción del plan en reversible / compensable / irreversible y decide dónde poner checkpoints

**Categoría:** Pre-Vuelo · **ID:** `mcp-reversibility-planner`

**Dolor de agente que resuelve:** El agente encadena 20 acciones sin darse cuenta de que la número 7 era irreversible: cuando el resultado final no gusta, ya no hay vuelta atrás. Nadie le enseñó a clasificar reversibilidad ANTES de empezar.

> Estado persistente en `~/.mcp-suite/reversibility-planner/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `classify_action`
Clasifica una acción por reglas (verbos, recursos, cantidad de afectados) en reversible/compensable/irreversible con explicación.

**Parámetros:**
  - `accion` (string, requerido): Descripción de la acción a clasificar
  - `recurso` (string, opcional): Recurso principal que toca
  - `afectados` (number, opcional): Número de registros/usuarios afectados

### `teach_rule`
Enseña una regla de clasificación permanente (persiste entre sesiones).

**Parámetros:**
  - `patron` (string, requerido): Patrón (texto o verbo) que dispara la regla
  - `clase` (enum, requerido): Clase de reversibilidad
  - `porque` (string, requerido): Razón de la regla

### `compensation_plan`
Para acciones compensables/irreversibles: genera esqueleto de plan de compensación con partes obligatorias.

**Parámetros:**
  - `accion` (string, requerido): Acción a compensar
  - `afectados` (string, opcional): Quién/qué resultó afectado
  - `canal` (string, opcional): Canal del daño (email, público, datos, dinero)

### `checkpoint_decision`
Dado un plan (lista de clases de acción), decide en qué puntos capturar snapshots: solo antes de puntos de no-retorno.

**Parámetros:**
  - `plan` (string, requerido): Nombre del plan
  - `secuencia` (array, requerido): Acciones del plan en orden (texto libre)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "reversibility-planner": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-reversibility-planner/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/reversibility-planner/. Reglas configurables por verbo/recurso; genera planes de compensación (en vez de reversión) para lo irreversible-compensable y decide dónde capturar snapshots.

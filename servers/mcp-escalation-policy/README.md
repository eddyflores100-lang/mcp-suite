# Escalation Policy

> Política de escalamiento: cuándo molestar al humano y con qué paquete — ni spam ni silencio

**Categoría:** Humano en el Bucle · **ID:** `mcp-escalation-policy`

**Dolor de agente que resuelve:** Sin política de escalamiento el agente o molesta al humano cada 5 minutos (spam) o se calla problemas hasta el desastre. Decidir cuándo escalar es LA política que ningún agente trae.

> Estado persistente en `~/.mcp-suite/escalation-policy/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `add_rule`
Añade una regla de escalamiento: condición evaluable y acción a tomar.

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la regla
  - `condicion` (string, requerido): Condición observable (ej: 'error 3 veces seguidas')
  - `accion` (enum, requerido): Qué hacer
  - `cooldown_minutos` (number, opcional): Minutos mínimos entre escalos de esta regla

### `evaluate`
Evalúa una situación contra las reglas: devuelve la acción a tomar respetando cooldowns.

**Parámetros:**
  - `situacion` (string, requerido): Descripción de la situación actual
  - `intentos_fallidos` (number, opcional): Intentos fallidos consecutivos

### `interruption_budget`
Presupuesto de interrupciones al humano hoy: respétalo o serás silenciado.

**Parámetros:**
  - `max_por_dia` (number, opcional): Máximo de interrupciones diarias acordado

### `count_interruption`
Consume una interrupción del presupuesto diario (llámalo solo al preguntar de verdad al humano).

**Parámetros:**
  - `motivo` (string, requerido): Por qué interrumpiste

### `policy_report`
Reporte de la política: reglas, disparos y motivos de interrupción del período.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "escalation-policy": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-escalation-policy/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/escalation-policy/. Reglas (condición → acción: continuar, log, preguntar, abortar) con ventana anti-spam (cooldown) y presupuesto de interrupciones por día.

# Agent Supervisor

> Supervisión de sub-agentes: liveness, presupuesto, rendimiento y decisión de reinicio/escalamiento

**Categoría:** Multi-Agente y Coordinación · **ID:** `mcp-agent-supervisor`

**Dolor de agente que resuelve:** Los orquestadores lanzan sub-agentes y los olvidan: sin heartbeat ni presupuesto, un sub-agente bucle infinito quema tokens toda la noche y nadie lo mata.

> Estado persistente en `~/.mcp-suite/agent-supervisor/state.json` (local, privado, tuya la data).

## Tools (7 incl. health_check)

### `spawn_registration`
Registra un sub-agente lanzado con sus límites: presupuesto de tokens, deadline y máximos reintentos.

**Parámetros:**
  - `sub_agente` (string, requerido): ID del sub-agente
  - `tarea` (string, requerido): Tarea asignada
  - `presupuesto_tokens` (number, opcional): Límite de tokens
  - `deadline_minutos` (number, opcional): Minutos de plazo
  - `max_reintentos` (number, opcional): Reintentos permitidos

### `check_in`
El sub-agente reporta progreso y tokens consumidos; el supervisor evalúa límites y devuelve directiva (seguir, parar, escalar).

**Parámetros:**
  - `sub_agente` (string, requerido): ID del sub-agente
  - `progreso_pct` (number, requerido): Avance 0-100
  - `tokens_delta` (number, opcional): Tokens consumidos desde el último check-in
  - `nota` (string, opcional): Qué está pasando

### `report_result`
El sub-agente entrega resultado final; el supervisor cierra su registro y archiva métricas.

**Parámetros:**
  - `sub_agente` (string, requerido): ID del sub-agente
  - `exito` (boolean, requerido): ¿Completó la tarea?
  - `resultado` (string, opcional): Resumen del resultado

### `kill`
Detiene formalmente un sub-agente (bucle, desviación o presupuesto) y registra el motivo.

**Parámetros:**
  - `sub_agente` (string, requerido): ID del sub-agente
  - `motivo` (string, requerido): Por qué se detiene

### `supervision_dashboard`
Panel de supervisión: quién corre, quién excede presupuesto, quién no reporta y tasas de éxito.

### `retry_policy`
Consulta la política de reintento para un sub-agente fallido: cuántos quedan y con qué ajustes relanzar.

**Parámetros:**
  - `sub_agente` (string, requerido): ID del sub-agente

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "agent-supervisor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-agent-supervisor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/agent-supervisor/. Registra sub-agentes con límites (tiempo, tokens, reintentos), recibe check-ins y decide matar/reintentar/escalar según política.

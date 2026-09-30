# Agent Org Chart

> Registro vivo del equipo de agentes: roles, capacidades, autonomía y estado

**Categoría:** Multi-Agente y Coordinación · **ID:** `mcp-agent-org-chart`

**Dolor de agente que resuelve:** Cuando varios agentes colaboran, nadie sabe quién es quién: se duplican roles, se delega a quien no tiene la capacidad y no hay jerarquía de escalamiento.

> Estado persistente en `~/.mcp-suite/agent-org-chart/state.json` (local, privado, tuya la data).

## Tools (8 incl. health_check)

### `register_agent`
Registra o actualiza un agente en el equipo: rol, capacidades, nivel de autonomía (0=ninguna,1=sugerir,2=ejecutar con aprobación,3=autónomo) y supervisor.

**Parámetros:**
  - `agent_id` (string, requerido): Identificador único del agente
  - `nombre` (string, requerido): Nombre legible
  - `rol` (string, requerido): Rol en el equipo (ej: researcher, coder, reviewer)
  - `capacidades` (array, opcional): Lista de capacidades declaradas
  - `nivel_autonomia` (number, opcional): 0-3: 0 ninguna, 1 sugerir, 2 ejecutar con aprobación, 3 autónomo
  - `supervisor` (string, opcional): Agent_id del supervisor (null = raíz)

### `get_agent`
Devuelve la ficha completa de un agente: capacidades, autonomía, cadena de supervisión y carga actual.

**Parámetros:**
  - `agent_id` (string, requerido): ID del agente

### `list_agents`
Roster del equipo con filtros por rol, estado y autonomía; incluye contadores resumen.

**Parámetros:**
  - `rol` (string, opcional): Filtrar por rol exacto
  - `estado` (string, opcional): Filtrar por estado (activo, pausado, retirado)
  - `min_autonomia` (number, opcional): Autonomía mínima 0-3

### `find_by_capability`
Busca agentes capaces de X: matching por capacidad exacta y capacidades relacionadas (similitud de tokens).

**Parámetros:**
  - `capacidad` (string, requerido): Capacidad buscada (ej: pdf, sql, navegador)
  - `solo_activos` (boolean, opcional): Excluir agentes pausados/retirados

### `update_status`
Cambia el estado operativo de un agente (activo, pausado, saturado, retirado) con nota opcional.

**Parámetros:**
  - `agent_id` (string, requerido): ID del agente
  - `estado` (enum, requerido): Nuevo estado
  - `nota` (string, opcional): Motivo del cambio

### `capability_matrix`
Matriz capacidades × agentes: detecta capacidades huérfanas (nadie las cubre) y redundancias excesivas.

### `org_snapshot`
Fotografía de salud del equipo: profundidad jerárquica, autonomía media, agentes sin supervisor y balance de carga.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "agent-org-chart": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-agent-org-chart/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/agent-org-chart/. Registro de agentes con rol, capacidades declaradas, nivel de autonomía (0-3) y estado operativo. Incluye matriz de capacidades y búsqueda por habilidad.

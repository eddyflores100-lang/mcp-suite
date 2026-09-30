# Quorum Coordinator

> Votaciones distribuidas con quórum, pesos y timeouts: decisiones de equipo sin dictador

**Categoría:** Multi-Agente y Coordinación · **ID:** `mcp-quorum-coordinator`

**Dolor de agente que resuelve:** En equipos de agentes las decisiones críticas las toma el primero que llega, sin quórum ni pesos: minorías ruidosas ganan y no queda rastro de quién votó qué.

> Estado persistente en `~/.mcp-suite/quorum-coordinator/state.json` (local, privado, tuya la data).

## Tools (7 incl. health_check)

### `open_vote`
Abre una votación: pregunta, opciones, quórum mínimo y timeout. Devuelve el acta de apertura.

**Parámetros:**
  - `pregunta` (string, requerido): Pregunta a decidir
  - `opciones` (array, requerido): Opciones votables
  - `quorum` (number, opcional): Votos mínimos para validar
  - `timeout_minutos` (number, opcional): Minutos antes de cerrar por timeout
  - `pesos` (any, opcional): Mapa {agente: peso} opcional

### `cast_vote`
Un agente emite su voto (opción o ranking preferencial). Un agente = un voto reemplazable.

**Parámetros:**
  - `votacion_id` (string, requerido): ID de la votación
  - `agente` (string, requerido): Agent_id votante
  - `opcion` (string, requerido): Opción elegida (o la primera del ranking)
  - `ranking` (array, opcional): Ranking preferencial completo (Borda)
  - `razon` (string, opcional): Justificación breve

### `tally`
Escruta: mayoría simple, ponderada por pesos y Borda si hay rankings. Indica si se alcanzó quórum.

**Parámetros:**
  - `votacion_id` (string, requerido): ID de la votación

### `close_vote`
Cierra la votación con veredicto oficial y acta (quién votó qué queda auditado).

**Parámetros:**
  - `votacion_id` (string, requerido): ID de la votación
  - `criterio` (enum, opcional): Criterio de desempate final

### `default_on_timeout`
Cierra votaciones vencidas aplicando veredicto por defecto documentado (evita decisiones zombis eternas).

**Parámetros:**
  - `politica_defecto` (enum, opcional): Qué hacer al expirar

### `vote_history`
Historial de votaciones del equipo con desenlaces y participación media.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "quorum-coordinator": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-quorum-coordinator/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/quorum-coordinator/. Votaciones N-de-M con quórum configurable, pesos por agente, opciones preferenciales (Borda) y timeout con veredicto por defecto.

# Blackboard Shared

> Pizarra compartida con locks con TTL para coordinar agentes sin duplicar trabajo

**Categoría:** Multi-Agente y Coordinación · **ID:** `mcp-blackboard-shared`

**Dolor de agente que resuelve:** Varios agentes trabajando en paralelo pisan el mismo dato, duplican búsquedas costosas y se pisan entre ellos por ausencia de un espacio de coordinación compartido con exclusión.

> Estado persistente en `~/.mcp-suite/blackboard-shared/state.json` (local, privado, tuya la data).

## Tools (9 incl. health_check)

### `post`
Publica una entrada en la pizarra bajo una clave con etiquetas y visibilidad. Idempotente por versión.

**Parámetros:**
  - `clave` (string, requerido): Clave de la entrada (ej: research/competidores)
  - `contenido` (any, requerido): Contenido (texto o JSON)
  - `autor` (string, requerido): Agent_id autor
  - `etiquetas` (array, opcional): Etiquetas para búsqueda

### `read`
Lee entradas por clave exacta o etiqueta; registra lecturas (quién consumió qué).

**Parámetros:**
  - `clave` (string, opcional): Clave exacta
  - `etiqueta` (string, opcional): Buscar por etiqueta
  - `lector` (string, opcional): Agent_id que lee

### `claim`
Reclama exclusividad sobre una clave por un agente con TTL (segundos). Devuelve conflicto si ya está reclamada.

**Parámetros:**
  - `clave` (string, requerido): Clave a reclamar
  - `agente` (string, requerido): Agent_id que reclama
  - `ttl_segundos` (number, opcional): Vigencia del reclamo

### `release`
Libera el reclamo de una clave (solo el dueño o un supervisor con forzar).

**Parámetros:**
  - `clave` (string, requerido): Clave a liberar
  - `agente` (string, requerido): Agent_id que libera
  - `forzar` (boolean, opcional): Forzar aunque no sea dueño (supervisor)

### `append`
Añade contenido a una entrada existente de forma atómica (para resultados acumulativos de varios agentes).

**Parámetros:**
  - `clave` (string, requerido): Clave de la entrada
  - `contenido` (any, requerido): Contenido a añadir
  - `autor` (string, requerido): Agent_id que aporta

### `list_locks`
Locks activos con dueño y expiración; señala los próximos a caducar.

### `board_stats`
Salud de la pizarra: entradas, conflictos de escritura evitados, duplicación de lectura y agentes más activos.

### `purge`
Limpia entradas antiguas o locks muertos; devuelve espacio liberado.

**Parámetros:**
  - `max_edad_dias` (number, opcional): Eliminar entradas más viejas que esto
  - `solo_locks_muertos` (boolean, opcional): Solo purgar locks expirados

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "blackboard-shared": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-blackboard-shared/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/blackboard-shared/. Patrón blackboard: entradas etiquetadas + claim/release con TTL (evita locks muertos si un agente cae). Mide duplicación evitada.

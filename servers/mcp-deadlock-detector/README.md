# Deadlock Detector

> Detecta esperas circulares y contentión de recursos entre agentes antes de que se congelen

**Categoría:** Multi-Agente y Coordinación · **ID:** `mcp-deadlock-detector`

**Dolor de agente que resuelve:** Los agentes se bloquean en silencio: A espera a B, B espera a C y C espera a A. Nadie detecta el ciclo y la misión muere congelada sin error visible.

> Estado persistente en `~/.mcp-suite/deadlock-detector/state.json` (local, privado, tuya la data).

## Tools (7 incl. health_check)

### `declare_state`
Un agente declara qué recursos retiene y en quién espera. Reemplaza el estado previo del agente.

**Parámetros:**
  - `agente` (string, requerido): Agent_id
  - `retiene` (array, opcional): Recursos que retiene (IDs)
  - `espera_a` (array, opcional): Agent_ids o recursos a los que espera
  - `tarea` (string, opcional): Qué está haciendo (para diagnóstico)

### `detect`
Analiza el grafo de esperas y detecta ciclos (deadlocks) y cadenas de espera largas (livelock risk).

### `resolve`
Resuelve un deadlock eligiendo una víctima (la más barata de reiniciar) y genera el plan de desbloqueo.

**Parámetros:**
  - `ciclo` (array, opcional): Agentes del ciclo (del detect), opcional si solo hay uno
  - `victima_manual` (string, opcional): Forzar víctima concreta

### `stale_agents`
Detecta agentes cuyo último reporte supera un umbral: posibles procesos muertos que retienen recursos.

**Parámetros:**
  - `umbral_minutos` (number, opcional): Minutos sin reporte para considerarlo rancio

### `wait_graph`
Exporta el grafo de esperas en formato legible (aristas agente→espera_a) para diagnóstico o visualización.

### `clear`
Limpia el estado de un agente (terminó o fue reiniciado) liberando sus declaraciones.

**Parámetros:**
  - `agente` (string, requerido): Agent_id a limpiar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "deadlock-detector": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-deadlock-detector/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/deadlock-detector/. Grafo esperando-a: los agentes declaran 'wait_for' y 'hold'; se detectan ciclos (DFS) y se sugiere la víctima a cancelar.

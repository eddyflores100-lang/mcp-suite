# Blast Radius Estimator

> Antes de ejecutar una acción: estima cuántos sistemas, datos y usuarios quedan dentro del radio de impacto

**Categoría:** Pre-Vuelo · **ID:** `mcp-blast-radius-estimator`

**Dolor de agente que resuelve:** El agente borra una tabla 'inocente' y descubre que alimentaba 3 servicios: nadie le dijo que estimara el radio de explosión de sus acciones antes de pulsar el botón.

> Estado persistente en `~/.mcp-suite/blast-radius-estimator/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `register_system`
Registra un sistema/recurso del entorno con criticidad y dependientes directos.

**Parámetros:**
  - `sistema` (string, requerido): Nombre del sistema/recurso (ej: db-usuarios)
  - `criticidad` (enum, requerido): Criticidad del sistema
  - `descripcion` (string, opcional): Qué es y para qué sirve
  - `dependientes` (array, opcional): Sistemas que dependen de este {sistema, porque}

### `add_dependency`
Añade una dependencia: 'consumidor' depende de 'proveedor'. Alimenta la propagación del radio.

**Parámetros:**
  - `proveedor` (string, requerido): Sistema del que se depende
  - `consumidor` (string, requerido): Sistema que depende del proveedor
  - `porque` (string, requerido): Por qué depende (dato, servicio, colateral)

### `estimate`
Calcula el blast radius de una acción: propagación transitiva por el grafo con pesos y veredicto de aprobación.

**Parámetros:**
  - `accion` (string, requerido): Acción a evaluar (ej: DROP TABLE usuarios)
  - `objetivos` (array, requerido): Sistemas/recursos que la acción toca directamente
  - `modo` (enum, requerido): Modo de acceso

### `blast_history`
Historial de estimaciones: qué acciones tuvieron mayor radio estimado.

**Parámetros:**
  - `limite` (number, opcional): Máximo a mostrar

### `coverage_report`
Qué parte del entorno real está modelado en el grafo (anti-puntos-ciegos).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "blast-radius-estimator": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-blast-radius-estimator/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/blast-radius-estimator/. Grafo de sistemas con dependencias y criticidad; la propagación transitiva calcula el radio de impacto real de una acción.

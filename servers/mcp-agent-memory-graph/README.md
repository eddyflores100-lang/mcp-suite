# Agent Memory Graph

> Memoria de entidades y relaciones: el grafo de conocimiento del agente

**Categoría:** Memoria y Contexto · **ID:** `mcp-agent-memory-graph`

**Dolor de agente que resuelve:** La memoria plana pierde las RELACIONES (quién trabaja con quién, qué depende de qué): los agentes necesitan memoria estructural.

> Estado persistente en `~/.mcp-suite/agent-memory-graph/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `add_entity`
Añade una entidad al grafo de memoria (persona, proyecto, concepto, herramienta...).

**Parámetros:**
  - `id` (string, requerido): Identificador único
  - `tipo` (string, requerido): Tipo (persona/proyecto/concepto)
  - `props` (any, opcional): Propiedades adicionales

### `link`
Crea una relación dirigida entre dos entidades (ej: alice -> trabaja_en -> proyecto-x).

**Parámetros:**
  - `desde` (string, requerido): Entidad origen
  - `hacia` (string, requerido): Entidad destino
  - `relacion` (string, requerido): Nombre de la relación

### `neighbors`
Devuelve vecinos de una entidad: relaciones entrantes y salientes con nombres.

**Parámetros:**
  - `entidad` (string, requerido): Entidad a consultar

### `query_path`
Encuentra caminos de hasta 2 saltos entre dos entidades (quién conecta con quién).

**Parámetros:**
  - `origen` (string, requerido): Entidad origen
  - `destino` (string, requerido): Entidad destino

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "agent-memory-graph": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-agent-memory-graph/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Grafo dirigido etiquetado persistente: nodos {id, tipo, props} y aristas {desde, hacia, relación}. Consulta de vecinos y caminos de longitud 2.

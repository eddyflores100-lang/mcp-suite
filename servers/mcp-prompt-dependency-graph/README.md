# Prompt Dependency Graph

> Grafo de dependencias entre prompts, tools y datos: cambia X sabiendo exactamente qué se rompe

**Categoría:** Agent CI/CD · **ID:** `mcp-prompt-dependency-graph`

**Dolor de agente que resuelve:** Se edita el prompt de resumen y silenciosamente se rompe el pipeline de reportes que lo consumía: nadie mantiene el mapa de qué-prompt-usa-qué-tool-usa-qué-dato. El impacto de un cambio se descubre por el colapso.

> Estado persistente en `~/.mcp-suite/prompt-dependency-graph/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `add_dependency`
Declara que un nodo depende de otro (prompt→tool, tool→dato, prompt→prompt...).

**Parámetros:**
  - `nodo` (string, requerido): Nodo dependiente (ej: prompt:resumen-daily)
  - `depende_de` (string, requerido): Nodo del que depende (ej: tool:pdf-extractor)
  - `tipo` (string, opcional): Naturaleza de la dependencia (invoca, lee, hereda)

### `impact_analysis`
Análisis de impacto: si cambio/rompo X, ¿qué se ve afectado hacia arriba (dependientes transitivos)?

**Parámetros:**
  - `objetivo` (string, requerido): Nodo que va a cambiar

### `topological_order`
Orden de arranque/carga: qué inicializar primero para que ninguna dependencia esté ausente.

### `orphan_check`
Detecta nodos huérfanos (nadie los usa) y nodos fantasma (dependen de algo que no existe).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "prompt-dependency-graph": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-prompt-dependency-graph/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/prompt-dependency-graph/. Nodos (prompt/tool/dato) y aristas 'depende de'; análisis de impacto transitivo, orden topológico de arranque y detección de ciclos y huérfanos.

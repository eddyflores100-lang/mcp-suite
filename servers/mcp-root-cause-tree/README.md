# Root Cause Tree

> Cinco porqués disciplinados: cada porqué debe responder al anterior o el árbol se corta antes de la raíz

**Categoría:** Auto-Mejora · **ID:** `mcp-root-cause-tree`

**Dolor de agente que resuelve:** El agente hace 'análisis de causa raíz' en un párrafo: los porqués no se encadenan, saltan de tema y la 'raíz' es en realidad el tercer síntoma. Sin disciplina estructural, el RCA es literatura.

> Estado persistente en `~/.mcp-suite/root-cause-tree/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `start_tree`
Abre un árbol de análisis con el problema observable.

**Parámetros:**
  - `problema` (string, requerido): El problema visible (síntoma, no causa)

### `add_why`
Añade un nivel de porqué respondiendo al nivel anterior.

**Parámetros:**
  - `id` (string, requerido): Id del árbol
  - `respuesta` (string, requerido): Respuesta al porqué actual
  - `evidencia` (string, opcional): Qué te hace creer esa respuesta

### `validate_chain`
Valida que la cadena de porqués es coherente: cada respuesta trata sobre la anterior.

**Parámetros:**
  - `id` (string, requerido): Árbol

### `declare_root`
Declara la causa raíz (con validación de profundidad y factores contribuyentes).

**Parámetros:**
  - `id` (string, requerido): Árbol
  - `causa_raiz` (string, requerido): La causa raíz identificada
  - `tipo_causa` (enum, requerido): Naturaleza de la raíz
  - `factores_contribuyentes` (array, opcional): Factores que empeoraron sin causar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "root-cause-tree": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-root-cause-tree/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/root-cause-tree/. Árboles de porqués encadenados; valida que cada respuesta responda a la pregunta anterior (coherencia textual), detecta paradas prematuras y separa causa raíz de factores contribuyentes.

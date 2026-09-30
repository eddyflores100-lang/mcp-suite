# Selector Healer

> Repara selectores rotos por similitud: encuentra el elemento renombrado sin reescribir el flujo

**Categoría:** Computer Use · **ID:** `mcp-selector-healer`

**Dolor de agente que resuelve:** Un botón cambió de id (#btn-submit → #submit-btn) y el flujo entero muere: el agente no tiene forma de mapear 'el botón de antes' al elemento nuevo sin rehacer todo.

> Estado persistente en `~/.mcp-suite/selector-healer/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `register_selector`
Registra un selector con metadatos ricos para poder curarlo después (texto, ordinal, atributos, página).

**Parámetros:**
  - `nombre` (string, requerido): Nombre lógico (ej: boton_enviar)
  - `selector` (string, requerido): Selector CSS/XPath actual
  - `texto_visible` (string, opcional): Texto del elemento
  - `pagina` (string, opcional): Página/flujo
  - `atributos` (any, opcional): Atributos relevantes {id, class, name...}

### `heal`
Dado un selector roto y los candidatos actuales del DOM, devuelve el mejor match con score de confianza.

**Parámetros:**
  - `nombre` (string, requerido): Nombre lógico del selector roto
  - `candidatos` (array, requerido): Candidatos actuales {selector, texto, atributos}

### `fragility_report`
Qué selectores se rompen más y con qué patrón (ids dinámicos, clases hash, textos volátiles).

### `export_map`
Exporta el mapa lógico→selector actual (para el orquestador de navegador).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "selector-healer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-selector-healer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/selector-healer/. Guarda selectores con metadatos (texto visible, posición ordinal, atributos); ante un fallo propone el candidato más similar del DOM actual con score.

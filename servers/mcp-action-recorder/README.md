# Action Recorder

> Graba y reproduce secuencias de acciones con verificación de cada paso: flujos deterministas, no improvisados

**Categoría:** Computer Use · **ID:** `mcp-action-recorder`

**Dolor de agente que resuelve:** Cada corrida del agente de navegador improvisa el camino: hoy hace click en A→B→C, mañana prueba A→C. Sin grabación verificable, los fallos no se reproducen y nadie sabe qué hizo exactamente.

> Estado persistente en `~/.mcp-suite/action-recorder/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `create_flow`
Crea un flujo grabado (nombre + descripción del objetivo de negocio).

**Parámetros:**
  - `nombre` (string, requerido): Nombre del flujo
  - `objetivo` (string, requerido): Qué logra el flujo

### `record_step`
Añade un paso al flujo: acción, objetivo (selector/coords) y verificación esperada tras el paso.

**Parámetros:**
  - `flujo` (string, requerido): Nombre del flujo
  - `accion` (enum, requerido): Tipo de acción
  - `objetivo` (string, requerido): Sobre qué (url, selector, texto a escribir)
  - `verificacion` (string, requerido): Qué debe ser cierto DESPUÉS del paso (observable)

### `replay_report`
Registra el resultado de un replay: cada paso verificado, fallido o desviado; devuelve salud del flujo.

**Parámetros:**
  - `flujo` (string, requerido): Nombre del flujo
  - `resultados_pasos` (array, requerido): Resultado por paso: true/false/otro

### `flow_health`
Salud histórica del flujo: tasa de éxito por replay y paso más frágil acumulado.

**Parámetros:**
  - `flujo` (string, requerido): Nombre del flujo

### `list_flows`
Lista los flujos grabados con su salud agregada.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "action-recorder": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-action-recorder/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/action-recorder/. Flujos = lista de pasos {accion, objetivo, verificacion}; cada replay valida la verificación de cada paso y registra desviaciones.

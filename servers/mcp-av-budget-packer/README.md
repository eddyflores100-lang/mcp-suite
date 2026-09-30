# AV Budget Packer

> Mochila de contexto multimodal: qué audios, imágenes y videos caben en el presupuesto con prioridad declarada

**Categoría:** Multimodal & Voz · **ID:** `mcp-av-budget-packer`

**Dolor de agente que resuelve:** El agente multimodal mete 6 imágenes y 3 audios 'porque caben' y revienta el contexto a los 4 turnos: no existe la disciplina de presupuestar assets por prioridad como se presupuestan tokens.

> Estado persistente en `~/.mcp-suite/av-budget-packer/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `register_asset`
Registra un asset multimodal con coste estimado en tokens y prioridad.

**Parámetros:**
  - `asset` (string, requerido): Identificador del asset
  - `tipo` (enum, requerido): Tipo
  - `tokens_estimados` (number, requerido): Coste en tokens (imagen ~ (ancho*alto)/750, audio ~ 25 por segundo)
  - `prioridad` (number, requerido): Prioridad 1 (imprescindible) a 10 (prescindible)
  - `valor` (string, opcional): Qué aporta este asset a la tarea

### `pack`
Resuelve la mochila: qué assets entran en el presupuesto de tokens, por densidad de valor.

**Parámetros:**
  - `presupuesto_tokens` (number, requerido): Tokens disponibles para assets
  - `filtrar` (array, opcional): Restrictir a ciertos ids de asset

### `suggest_downsample`
Para los assets que no cupieron: cuánto reducirlos para que entren (o por qué no merece la pena).

**Parámetros:**
  - `asset` (string, requerido): Asset a reducir
  - `presupuesto_tokens` (number, requerido): Tokens disponibles para él

### `pack_report`
Informe de coste acumulado de assets por tarea y detección de pesos repetidos.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "av-budget-packer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-av-budget-packer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/av-budget-packer/. Registro de assets con coste en tokens estimado (por resolución/duración); el packer resuelve la mochila por prioridad×densidad de valor y sugiere downsampleo del resto.

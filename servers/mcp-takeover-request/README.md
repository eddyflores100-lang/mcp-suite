# Takeover Request

> Solicita toma de control humano con el contexto mínimo suficiente: sin volcar todo el historial

**Categoría:** Humano en el Bucle · **ID:** `mcp-takeover-request`

**Dolor de agente que resuelve:** Cuando el agente se atasca pide ayuda volcando todo el historial o no pide nada y decide solo. El punto medio —un paquete de takeover con lo justo— no existe.

> Estado persistente en `~/.mcp-suite/takeover-request/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `request_takeover`
Construye un paquete de takeover: contexto mínimo, opciones con trade-offs y la pregunta concreta al humano.

**Parámetros:**
  - `situacion` (string, requerido): Situación en 2-3 frases
  - `intentado` (array, requerido): Lo que ya se intentó y falló
  - `punto_decision` (string, requerido): La decisión exacta que no puede tomar solo
  - `opciones` (array, requerido): Opciones viables con trade-offs
  - `pregunta_al_humano` (string, requerido): La pregunta concreta y cerrada
  - `urgencia` (enum, opcional): Urgencia

### `respond`
Registra la respuesta del humano y mide el tiempo que tomó.

**Parámetros:**
  - `takeover_id` (string, requerido): ID de la solicitud
  - `decision` (string, requerido): Qué decidió el humano (opción o instrucción)
  - `notas` (string, opcional): Matices del humano

### `pending_requests`
Solicitudes pendientes ordenadas por urgencia y antigüedad.

### `takeover_stats`
Estadísticas: cuánto decide el humano, tiempo medio de respuesta y decisiones que más se repiten.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "takeover-request": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-takeover-request/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/takeover-request/. Paquetes de takeover: situación, lo intentado, el punto exacto de decisión, opciones con trade-offs y qué se necesita del humano. Mide tiempo de respuesta.

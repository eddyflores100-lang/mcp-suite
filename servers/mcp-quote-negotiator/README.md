# Quote Negotiator

> Protocolo de oferta y contraoferta con precio de reserva, BATNA y concesiones decrecientes

**Categoría:** Comercio A2A · **ID:** `mcp-quote-negotiator`

**Dolor de agente que resuelve:** Dos agentes 'negocian' intercambiando números sin estructura: sin precio de reserva, sin alternativa de respaldo, sin estrategia de concesión. Uno acaba aceptando cualquier cosa o los dos en bucle infinito.

> Estado persistente en `~/.mcp-suite/quote-negotiator/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `create_negotiation`
Crea una negociación sobre un asunto con tus límites y tu alternativa (BATNA).

**Parámetros:**
  - `asunto` (string, requerido): Qué se negocia (precio, plazo, SLA, alcance)
  - `mi_reserva` (number, requerido): Tu límite: peor valor que aceptarías
  - `mi_objetivo` (number, requerido): Valor ideal que buscas
  - `batna` (string, opcional): Tu mejor alternativa si no hay acuerdo
  - `direccion` (enum, requerido): Compras (prefieres BAJO) o vendes (prefieres ALTO)

### `submit_offer`
Registra la oferta recibida de la contraparte.

**Parámetros:**
  - `id` (string, requerido): Id de la negociación
  - `valor` (number, requerido): Valor ofrecido
  - `condiciones` (string, opcional): Condiciones adjuntas (plazo, garantías...)

### `evaluate_offer`
Evalúa la oferta contraria contra tu reserva, tu objetivo y tu BATNA con veredicto claro.

**Parámetros:**
  - `id` (string, requerido): Id de la negociación

### `counter_offer`
Genera tu contraoferta con concesión decreciente según la ronda (estrategia estándar de negociación).

**Parámetros:**
  - `id` (string, requerido): Id de la negociación
  - `ajuste_manual` (number, opcional): Si prefieres fijar tú el valor, ignora la estrategia

### `close_negotiation`
Cierra la negociación con acuerdo (valor final) o ruptura (a BATNA).

**Parámetros:**
  - `id` (string, requerido): Id de la negociación
  - `resultado` (enum, requerido): Resultado
  - `valor_final` (number, opcional): Valor acordado (si acuerdo)
  - `nota` (string, opcional): Nota de cierre

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "quote-negotiator": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-quote-negotiator/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/quote-negotiator/. Modela cada parte con reserva, objetivo y BATNA; valida ofertas contra límites, propone contraofertas con concesión decreciente y detecta zona de acuerdo posible (ZOPA).

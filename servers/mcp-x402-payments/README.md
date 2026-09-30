# x402 Payments

> Helpers del protocolo x402: pagos HTTP 402 para comercio entre agentes

**Categoría:** MarketNow Trust · **ID:** `mcp-x402-payments`

**Dolor de agente que resuelve:** Los agentes no pueden pagar por recursos: HTTP 402 Payment Required existe pero falta tooling para offers/deliveries entre agentes.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

> Estado persistente en `~/.mcp-suite/x402-payments/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `parse_402_response`
Interpreta una respuesta HTTP 402: extrae el challenge de pago (accepts, scheme, maxAmount, resource) y explica cómo responder.

**Parámetros:**
  - `status` (number, requerido): Código HTTP recibido
  - `body` (string, opcional): Cuerpo de la respuesta (texto)

### `build_payment_offer`
Construye el header Payment (offer) para responder a un challenge 402: esquema, monto, asset y referencia.

**Parámetros:**
  - `esquema` (string, requerido): Esquema de pago (ej: x402/erc20, x402/near)
  - `monto` (string, requerido): Monto con unidad (ej: 0.05 USDC)
  - `asset` (string, opcional): Asset de pago
  - `referencia` (string, opcional): Referencia/recurso que se paga

### `validate_delivery`
Valida el delivery de pago recibido tras una offer: estructura, firma de settlement y unicidad (anti-replay por nonce).

**Parámetros:**
  - `delivery` (any, requerido): Delivery JSON recibido del servidor

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "x402-payments": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-x402-payments/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Implementa helpers del flujo x402: respuesta 402 con challenge → offer del cliente → delivery verificado. Registra intentos y estado local.

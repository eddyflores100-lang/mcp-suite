# Metering Station

> Medición facturable del consumo entre agentes: eventos de uso → agregación → tarifa → borrador de factura

**Categoría:** Comercio A2A · **ID:** `mcp-metering-station`

**Dolor de agente que resuelve:** El agente sirve 12.000 llamadas a otros agentes y no tiene NADA que facturar: sin eventos medidos, sin tarifa por tramos, sin borrador de factura, la economía agéntica se queda en 'confía en mí'.

> Estado persistente en `~/.mcp-suite/metering-station/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `set_tariff`
Define la tarifa por tramos para un recurso medible.

**Parámetros:**
  - `recurso` (string, requerido): Recurso a tarifar (llamada_api, token_procesado, mb_datos...)
  - `unidad` (string, requerido): Unidad de medida (invocación, token, MB)
  - `tramos` (array, requerido): Tramos {hasta: cantidad o 'inf', precio_unitario} en orden
  - `divisa` (string, opcional): Divisa
  - `cliente` (string, opcional): Cliente concreto (si la tarifa es privada)

### `record_usage`
Registra un evento de uso medible.

**Parámetros:**
  - `cliente` (string, requerido): Agente/cliente consumidor
  - `recurso` (string, requerido): Recurso consumido
  - `cantidad` (number, requerido): Cantidad consumida en la unidad del recurso
  - `operacion` (string, opcional): Operación concreta
  - `ref` (string, opcional): Referencia externa (request id)

### `aggregate`
Agrega el consumo por cliente y recurso para un período, con tarifa aplicada.

**Parámetros:**
  - `dias` (number, opcional): Ventana hacia atrás en días
  - `cliente` (string, opcional): Filtrar por cliente

### `detect_anomalies`
Detecta consumos anómalos: picos por cliente/recurso frente a su propia historia.

**Parámetros:**
  - `dias` (number, opcional): Ventana de análisis

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "metering-station": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-metering-station/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/metering-station/. Eventos de uso con dimensiones (cliente, recurso, cantidad, unidad); tarifas por tramos (tiered); agregación por período y detección de anomalías de consumo.

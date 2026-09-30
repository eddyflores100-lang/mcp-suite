# Currency Convert

> Conversión de monedas: tasas en vivo (API abierta) + tabla de respaldo offline

**Categoría:** Utilidades · **ID:** `mcp-currency-convert`

**Dolor de agente que resuelve:** El LLM no conoce la tasa del dólar HOY: convertir precios con tasas 'recordadas' da cifras falsas.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

> Estado persistente en `~/.mcp-suite/currency-convert/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `convert`
Convierte un monto entre monedas usando tasas en vivo (open.er-api.com, gratis) con cache de 6h; si no hay red usa tabla de respaldo aproximada.

**Parámetros:**
  - `monto` (number, requerido): Monto a convertir
  - `de` (string, requerido): Moneda origen (ej: USD)
  - `a` (string, requerido): Moneda destino (ej: EUR)

### `cross_table`
Tabla cruzada de conversión de un monto base contra varias monedas a la vez.

**Parámetros:**
  - `monto` (number, requerido): Monto base
  - `de` (string, opcional): Moneda base
  - `monedas` (array, opcional): Monedas destino

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "currency-convert": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-currency-convert/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

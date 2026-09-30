# Settlement Ledger

> Libro de liquidaciones entre agentes: pagos registrados, conciliación contra factura y saldos por contraparte

**Categoría:** Comercio A2A · **ID:** `mcp-settlement-ledger`

**Dolor de agente que resuelve:** El agente pagó, el otro agente dice que no; hay dos facturas por el mismo servicio y nadie concilia nada. Sin libro de liquidaciones con conciliación, la contabilidad entre agentes es una novela.

> Estado persistente en `~/.mcp-suite/settlement-ledger/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `record_settlement`
Registra una liquidación real (pago emitido o recibido) con su referencia.

**Parámetros:**
  - `contraparte` (string, requerido): Agente contraparte
  - `direccion` (enum, requerido): Sentido del pago
  - `monto` (number, requerido): Monto liquidado
  - `divisa` (string, opcional): Divisa
  - `concepto` (string, requerido): Concepto (qué se liquida)
  - `factura_ref` (string, opcional): Referencia de la factura/charge que cubre
  - `tx_ref` (string, opcional): Referencia de la transacción (hash, id de pago)

### `reconcile`
Concilia liquidaciones contra facturas declaradas: match exacto, parcial o descuadre.

**Parámetros:**
  - `facturas` (array, requerido): Facturas externas a conciliar {contraparte, factura_ref, monto, direccion_esperada}

### `balances`
Saldos netos por contraparte: pagado vs recibido vs pendiente de conciliar.

### `aging_report`
Antigüedad de lo no conciliado: qué lleva días esperando match (riesgo de olvido).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "settlement-ledger": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-settlement-ledger/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/settlement-ledger/. Asientos de liquidación con referencia; conciliación match-factura-a-pago; saldos por contraparte e informe de antigüedad de lo no conciliado.

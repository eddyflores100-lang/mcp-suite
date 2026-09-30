# Cost Attribution

> Atribuye cada dólar a cliente/proyecto/agente: el gasto deja de ser un agujero negro global

**Categoría:** Economía del Agente · **ID:** `mcp-cost-attribution`

**Dolor de agente que resuelve:** El costo de agentes se contabiliza como una sola línea global: ningún cliente/proyecto sabe cuánto consume realmente, así que nadie optimiza y el margen se evapora sin responsable.

> Estado persistente en `~/.mcp-suite/cost-attribution/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `tag_spend`
Registra un gasto atribuido: cliente, proyecto, agente, concepto e importe.

**Parámetros:**
  - `cliente` (string, requerido): Cliente o 'interno'
  - `proyecto` (string, requerido): Proyecto
  - `agente` (string, requerido): Agente que gastó
  - `concepto` (string, requerido): Concepto (llm, tool, api)
  - `usd` (number, requerido): Importe
  - `entregable` (string, opcional): Entregable al que contribuye

### `attribution_report`
Reparto del gasto por cliente, proyecto y agente con top consumidores.

**Parámetros:**
  - `desde` (string, opcional): Fecha ISO de inicio (opcional)

### `margin_check`
Compara costo atribuido contra ingresos por cliente: ¿a quién le estás perdiendo dinero?

**Parámetros:**
  - `ingresos` (any, requerido): Mapa {cliente: ingreso_usd}

### `cost_per_deliverable`
Costo total por entregable (suma de gastos etiquetados) para precio y estimación futura.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "cost-attribution": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-cost-attribution/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/cost-attribution/. Gastos etiquetados por cliente/proyecto/agente con reparto, ranking de consumidores y costo por entregable.

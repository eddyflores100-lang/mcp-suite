# Cost Tracker

> Sigue el gasto por llamada y modelo: presupuestos con alertas

**Categoría:** Observabilidad · **ID:** `mcp-cost-tracker`

**Dolor de agente que resuelve:** El coste de tokens es invisible hasta la factura: sin tracking por tarea no se puede optimizar nada.

> Estado persistente en `~/.mcp-suite/cost-tracker/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `record`
Registra un gasto: modelo, tokens entrada/salida y coste calculado con tabla de precios editable.

**Parámetros:**
  - `tarea` (string, requerido): Tarea/proyecto a imputar
  - `modelo` (string, requerido): Modelo usado (ej: gpt-4o, claude-sonnet)
  - `tokens_entrada` (number, opcional): Tokens de entrada
  - `tokens_salida` (number, opcional): Tokens de salida

### `report`
Reporte de gastos: total, por tarea, por modelo y alerta si supera el presupuesto configurado.

### `set_budget`
Define el presupuesto máximo en USD y precios custom por modelo.

**Parámetros:**
  - `presupuesto_usd` (number, requerido): Presupuesto máximo
  - `precios_custom` (any, opcional): {modelo: [precio_entrada, precio_salida] por 1k tokens}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "cost-tracker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-cost-tracker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

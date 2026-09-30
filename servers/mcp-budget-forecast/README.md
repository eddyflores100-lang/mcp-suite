# Budget Forecast

> Proyección de gasto futuro basada en histórico: sabe cuánto costará el mes antes de gastarlo

**Categoría:** Economía del Agente · **ID:** `mcp-budget-forecast`

**Dolor de agente que resuelve:** El gasto de agentes es imprevisible: el equipo descubre a mitad de mes que al ritmo actual el presupuesto vuela, cuando ya es tarde para ajustar el mix de trabajo.

> Estado persistente en `~/.mcp-suite/budget-forecast/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `log_daily_spend`
Registra el gasto acumulado de un día (USD).

**Parámetros:**
  - `usd` (number, requerido): Gasto del día
  - `dia` (string, opcional): Fecha ISO (default: hoy)

### `burn_rate`
Burn-rate actual: gasto diario medio (últimos 7 y 30 días) y tendencia.

### `forecast_month`
Proyección de cierre de mes: gasto acumulado + proyección, contra presupuesto objetivo.

**Parámetros:**
  - `presupuesto_mensual` (number, opcional): Presupuesto del mes (USD)

### `anomaly_spend`
Detecta días de gasto anómalo (picos) y los asocia a la actividad de ese día.

**Parámetros:**
  - `umbral_x` (number, opcional): Múltiplo de la media que cuenta como pico

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "budget-forecast": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-budget-forecast/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/budget-forecast/. Serie diaria de gasto; proyección lineal y con estacionalidad semanal simple, burn-rate y fecha estimada de agotamiento del presupuesto mensual.

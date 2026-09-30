# Batch Runner

> Divide y vencerás: lotes y chunks con control de concurrencia

**Categoría:** Resiliencia de Tools · **ID:** `mcp-batch-runner`

**Dolor de agente que resuelve:** Procesar 1000 items de golpe revienta rate limits y memoria: falta división en lotes con concurrencia limitada.

## Tools (3 incl. health_check)

### `make_batches`
Divide una lista de items en lotes de tamaño N con opciones de stride/interleaved.

**Parámetros:**
  - `items` (array, requerido): Items a dividir
  - `tamano` (number, opcional): Items por lote
  - `intercalado` (boolean, opcional): Reparto round-robin entre lotes

### `concurrency_plan`
Calcula plan de concurrencia: dado N items, costo por item y rate limit, cuántos en paralelo y cuánto tarda.

**Parámetros:**
  - `total_items` (number, requerido): Total de items
  - `ms_por_item` (number, requerido): Duración de un item (ms)
  - `max_concurrencia` (number, opcional): Límite de paralelismo
  - `rate_por_minuto` (number, opcional): Límite de llamadas/min

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "batch-runner": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-batch-runner/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

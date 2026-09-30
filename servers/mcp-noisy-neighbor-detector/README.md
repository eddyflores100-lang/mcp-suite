# Noisy Neighbor Detector

> Detecta al inquilino ruidoso: quién consume más de lo justo y degrada la experiencia de los demás

**Categoría:** Multi-Tenant · **ID:** `mcp-noisy-neighbor-detector`

**Dolor de agente que resuelve:** Todos los tenants ven 'el agente va lento' pero nadie ve quién lo causa: sin medición de consumo relativo por inquilino, el vecino ruidoso es invisible y la degradación se achaca al sistema.

> Estado persistente en `~/.mcp-suite/noisy-neighbor-detector/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `record_usage_event`
Registra un evento de uso con su coste para atribución por tenant.

**Parámetros:**
  - `tenant` (string, requerido): Tenant
  - `tokens` (number, opcional): Tokens consumidos
  - `latencia_ms` (number, opcional): Latencia añadida al sistema
  - `operacion` (string, opcional): Operación

### `analyze_fairness`
Índice de equidad del consumo (Gini) y ranking de contribución al coste total.

**Parámetros:**
  - `ventana_minutos` (number, opcional): Ventana de análisis

### `flag_noisy`
Marca a los tenants ruidosos: consumo desproporcionado frente a su cuota o frente a la mediana.

**Parámetros:**
  - `umbral_x_mediana` (number, opcional): Veces la mediana para ser ruidoso

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "noisy-neighbor-detector": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-noisy-neighbor-detector/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/noisy-neighbor-detector/. Eventos de uso por tenant con coste (tokens/ms); índice de desequilibrio tipo Gini sobre el consumo; flaggeo de tenants por encima del umbral de su cuota relativa.

# Experiment Log

> A/B de prompts y configs: variantes, resultados y conclusión estadística ligera

**Categoría:** Observabilidad · **ID:** `mcp-experiment-log`

**Dolor de agente que resuelve:** Se cambian prompts sin medir: sin experimentos registrados, la mejora es anécdota.

> Estado persistente en `~/.mcp-suite/experiment-log/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `start`
Inicia un experimento: hipótesis, métrica y variantes (con config).

**Parámetros:**
  - `nombre` (string, requerido): Nombre del experimento
  - `hipotesis` (string, requerido): Qué crees que mejorará
  - `metrica` (string, requerido): Métrica a comparar (ej: tasa_exito, score)
  - `variantes` (array, requerido): Nombres de variantes (ej: [control, prompt-v2])

### `variant_result`
Registra el resultado de una variante (valor de la métrica). Acumula muestras.

**Parámetros:**
  - `experimento` (string, requerido): Nombre del experimento
  - `variante` (string, requerido): Variante
  - `valor` (number, requerido): Valor observado

### `conclude`
Concluye el experimento: medias por variante, diferencia relativa y ganadora preliminar.

**Parámetros:**
  - `experimento` (string, requerido): Nombre del experimento

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "experiment-log": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-experiment-log/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

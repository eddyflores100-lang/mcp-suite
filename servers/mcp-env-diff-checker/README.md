# Env Diff Checker

> Caza el drift de configuración: snapshot de entorno dev vs prod y qué claves divergen antes de desplegar

**Categoría:** Agent CI/CD · **ID:** `mcp-env-diff-checker`

**Dolor de agente que resuelve:** El agente funciona perfecto en desarrollo y falla en producción: 3 claves distintas, 1 ausente y un timeout que solo existe en un lado. El drift de entorno es el bug más caro de diagnosticar y el más fácil de prevenir.

> Estado persistente en `~/.mcp-suite/env-diff-checker/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `capture_env`
Captura un entorno nombrado (config aplanada; los valores sensibles se ofuscan automáticamente).

**Parámetros:**
  - `nombre` (string, requerido): Nombre del entorno (dev, staging, prod)
  - `config` (any, requerido): Objeto de configuración {clave: valor}

### `diff_envs`
Diferencia dos entornos: claves divergentes, ausentes y con riesgo clasificado.

**Parámetros:**
  - `origen` (string, requerido): Entorno base (ej: dev)
  - `destino` (string, requerido): Entorno a comparar (ej: prod)

### `watch_drift`
Compara la última captura de cada entorno y vigila el empeoramiento del drift.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "env-diff-checker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-env-diff-checker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/env-diff-checker/. Captura entornos nombrados (dicts de config aplanados con valores ofuscables); diff profundo con clasificación de riesgo por clave y monitoreo de drift acumulado.

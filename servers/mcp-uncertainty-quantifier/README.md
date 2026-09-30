# Uncertainty Quantifier

> Cuantifica la confianza del agente: estimaciones con rangos y calibración Brier

**Categoría:** Cognición y Planificación · **ID:** `mcp-uncertainty-quantifier`

**Dolor de agente que resuelve:** El agente expresa certeza binaria (sí/no) en vez de probabilidades: sin calibración, la confianza no significa nada.

> Estado persistente en `~/.mcp-suite/uncertainty-quantifier/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `estimate_confidence`
Convierte una creencia verbal (seguro/probable/quizás) en probabilidad con rango, y valida coherencia.

**Parámetros:**
  - `afirmacion` (string, requerido): La afirmación a cuantificar
  - `nivel_verbal` (enum, requerido): Nivel verbal de confianza
  - `evidencia_items` (number, opcional): Cuántas evidencias independientes tienes

### `calibrate`
Calibra tu confianza histórica: registra predicciones con probabilidad y outcomes; calcula score de Brier (menor = mejor).

**Parámetros:**
  - `prediccion` (string, opcional): La predicción
  - `probabilidad` (number, opcional): Probabilidad estimada 0-1
  - `ocurrio` (boolean, opcional): ¿Ocurrió? (para resolver una predicción previa)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "uncertainty-quantifier": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-uncertainty-quantifier/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

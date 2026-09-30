# Hypothesis Tracker

> Hipótesis científicas del agente: enuncia, prueba y concluye

**Categoría:** Cognición y Planificación · **ID:** `mcp-hypothesis-tracker`

**Dolor de agente que resuelve:** El agente asume en vez de hipotetizar: sin registro de hipótesis testeables, los supuestos se vuelven 'verdades'.

> Estado persistente en `~/.mcp-suite/hypothesis-tracker/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `add`
Registra una hipótesis: enunciado, predicción falsable y cómo testearla.

**Parámetros:**
  - `enunciado` (string, requerido): Hipótesis (ej: X mejorará Y)
  - `prediccion` (string, requerido): Predicción falsable
  - `test` (string, opcional): Cómo testear

### `record_result`
Registra el resultado de un test de hipótesis: confirmada, refutada o inconclusa (con datos).

**Parámetros:**
  - `id` (string, requerido): ID de hipótesis
  - `resultado` (enum, requerido): Resultado
  - `evidencia` (string, opcional): Evidencia observada

### `report`
Reporte de hipótesis: cuántas confirmadas/refutadas/sin testear y ratio de acierto (calibración del agente).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "hypothesis-tracker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-hypothesis-tracker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

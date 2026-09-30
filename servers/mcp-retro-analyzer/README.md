# Retro Analyzer

> Retrospectivas: qué salió bien, qué no y acciones concretas

**Categoría:** Cognición y Planificación · **ID:** `mcp-retro-analyzer`

**Dolor de agente que resuelve:** Sin retros el agente repite los mismos errores: el aprendizaje de la ejecución se pierde.

> Estado persistente en `~/.mcp-suite/retro-analyzer/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `log_event`
Registra un evento de la ejecución para la retrospectiva: tipo (logro/fallo/bloqueo/sorpresa) y detalle.

**Parámetros:**
  - `tipo` (enum, requerido): Tipo de evento
  - `detalle` (string, requerido): Qué pasó
  - `causa` (string, opcional): Causa raíz (para fallos)

### `analyze`
Genera la retrospectiva: patrones por tipo de evento, causas recurrentes y acciones concretas priorizadas.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "retro-analyzer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-retro-analyzer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

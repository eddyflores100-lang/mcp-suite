# Error Triage

> Clasifica errores, sugiere acción y registra patrón: la sala de emergencias del agente

**Categoría:** Observabilidad · **ID:** `mcp-error-triage`

**Dolor de agente que resuelve:** Los errores se acumulan sin clasificar: sin triage no se sabe qué es transitorio, qué es bug y qué es configuración.

> Estado persistente en `~/.mcp-suite/error-triage/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `classify`
Clasifica un error en taxonomía (red/auth/validación/límite/bug/datos) y sugiere la acción inmediata.

**Parámetros:**
  - `error` (string, requerido): Mensaje de error
  - `contexto` (string, opcional): Qué tool/operación lo produjo

### `pattern_report`
Reporte de patrones de error acumulados: qué categorías dominan (para atacar la causa raíz).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "error-triage": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-error-triage/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

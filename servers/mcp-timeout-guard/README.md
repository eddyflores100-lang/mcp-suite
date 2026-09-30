# Timeout Guard

> Deadlines y escalada: ninguna llamada sin reloj

**Categoría:** Resiliencia de Tools · **ID:** `mcp-timeout-guard`

**Dolor de agente que resuelve:** Las tools lentas congelan al agente: falta gestión de deadlines, timeouts por clase de operación y escalada.

## Tools (3 incl. health_check)

### `suggest_timeout`
Sugiere timeout por clase de operación (lectura local, API rápida, scrapeo, LLM, batch) con justificación.

**Parámetros:**
  - `clase` (enum, requerido): Clase de operación

### `deadline_plan`
Dado un presupuesto total de tiempo y una lista de pasos, reparte deadlines proporcionales y detecta pasos imposibles.

**Parámetros:**
  - `presupuesto_ms` (number, requerido): Tiempo total disponible
  - `pasos` (array, requerido): Lista de {nombre, peso (relativo)}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "timeout-guard": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-timeout-guard/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

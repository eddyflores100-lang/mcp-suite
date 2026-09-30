# Fallback Chain

> Cadenas de respaldo: si A falla prueba B, luego C — con registro

**Categoría:** Resiliencia de Tools · **ID:** `mcp-fallback-chain`

**Dolor de agente que resuelve:** Cuando la tool primaria falla no hay plan B estructurado: el agente improvisa en vez de seguir una cadena de fallbacks.

> Estado persistente en `~/.mcp-suite/fallback-chain/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `build_chain`
Define una cadena de fallback para una capacidad: lista ordenada de herramientas/métodos alternativos.

**Parámetros:**
  - `capacidad` (string, requerido): Capacidad (ej: busqueda-web)
  - `herramientas` (array, requerido): Tools alternativas en orden de preferencia

### `next_fallback`
Devuelve el siguiente paso a probar en la cadena dado el que falló (y registra el fallo para estadística).

**Parámetros:**
  - `capacidad` (string, requerido): Capacidad
  - `fallo_en` (string, requerido): Herramienta que falló

### `report`
Reporte de fallos por capacidad: qué eslabones fallan más (para reordenar cadenas).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "fallback-chain": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-fallback-chain/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

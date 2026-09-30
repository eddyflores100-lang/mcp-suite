# MarketNow · Install Planner

> Planifica instalaciones de skills MCP: comandos, orden, riesgos y validación previa

**Categoría:** MarketNow · **ID:** `mcp-marketnow-install-planner`

**Dolor de agente que resuelve:** Instalar skills MCP a ciegas rompe entornos: el agente necesita un plan con comandos exactos, riesgo por skill y orden de instalación.

> Este servidor incluye datos embebidos en `data/` (no requiere conexión para operar).

## Tools (4 incl. health_check)

### `plan_install`
Dada una lista de skills (ids o nombres del snapshot), genera un plan: comando de instalación exacto, tier de riesgo, dependencias de orden y checklist previo.

**Parámetros:**
  - `skills` (array, requerido): Lista de ids o nombres de skills a instalar

### `validate_install_command`
Valida un comando de instalación (npx/npm install/pip): detecta flags peligrosos, versiones no fijadas, curl|sh y uso de sudo.

**Parámetros:**
  - `comando` (string, requerido): Comando a validar

### `prerequisitos`
Checklist de prerrequisitos antes de instalar skills MCP: runtime, config del cliente, variables de entorno y espacio.

**Parámetros:**
  - `cliente` (enum, opcional): Cliente MCP objetivo

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-install-planner": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-install-planner/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

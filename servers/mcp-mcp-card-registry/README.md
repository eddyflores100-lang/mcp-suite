# MCP Card Registry

> Genera y valida MCP server cards (mcp.json / .well-known/mcp.json) para discovery estándar

**Categoría:** MarketNow Ops · **ID:** `mcp-mcp-card-registry`

**Dolor de agente que resuelve:** Cada servidor MCP se describe distinto: la MCP Card (mcp.json) estandariza el discovery pero nadie la genera/valida.

> Estado persistente en `~/.mcp-suite/mcp-card-registry/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `generate_card`
Genera una MCP Card para tu servidor: nombre, transporte, tools expuestas, versión y requirements.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del servidor MCP
  - `version` (string, opcional): Versión
  - `descripcion` (string, opcional): Descripción
  - `tools` (array, requerido): Nombres de tools expuestas
  - `transporte` (enum, opcional): Transporte

### `validate_card`
Valida una MCP Card: schema, transporte bien definido, tools con nombre y versiones.

**Parámetros:**
  - `card` (any, requerido): MCP Card a validar

### `register_locally`
Registra una MCP Card en tu registro local de confianza para consulta futura de otros agentes.

**Parámetros:**
  - `card` (any, requerido): Card a registrar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "mcp-card-registry": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-mcp-card-registry/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

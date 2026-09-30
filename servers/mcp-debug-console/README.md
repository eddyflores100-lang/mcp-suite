# Debug Console

> Introspección del entorno del agente: capacidades, variables y salud del runtime

**Categoría:** Observabilidad · **ID:** `mcp-debug-console`

**Dolor de agente que resuelve:** Debuggear a ciegas: el agente no sabe qué runtime, variables o versiones tiene debajo.

## Tools (3 incl. health_check)

### `env_probe`
Sondea el entorno: versión de node, plataforma, CPUs, memoria y variables de entorno RELEVANTES (solo whitelist, nunca valores secretos).

### `capabilities`
Reporta las capacidades de este runtime MCP: transporte, tools disponibles y features del entorno.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "debug-console": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-debug-console/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

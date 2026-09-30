# OWASP MCP Matrix

> Matriz de cumplimiento del OWASP MCP Cheat Sheet: 12 controles, auto-evaluación y reporte

**Categoría:** MarketNow Ops · **ID:** `mcp-owasp-mcp-matrix`

**Dolor de agente que resuelve:** Construir MCP servers sin checklist de seguridad OWASP: faltan controles estandarizados (authz, secrets, sandbox, logging).

## Tools (3 incl. health_check)

### `get_controls`
Los 12 controles del OWASP MCP Cheat Sheet con estado recomendado y cómo implementarlos.

### `self_assess`
Auto-evaluación: marca qué controles cumples (lista de IDs) y obtiene score de cumplimiento + brechas críticas.

**Parámetros:**
  - `cumplidos` (array, requerido): IDs cumplidos (ej: ['MC-1','MC-3'])

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "owasp-mcp-matrix": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-owasp-mcp-matrix/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# Response Size Guard

> Guardián del tamaño de respuesta: nada revienta el contexto del cliente (issue #58 de MCP)

**Categoría:** Calidad de Salida · **ID:** `mcp-response-size-guard`

**Dolor de agente que resuelve:** Respuestas MCP gigantes desbordan el contexto del cliente: el spec pide truncado inteligente (GitHub modelcontextprotocol#58).

## Tools (3 incl. health_check)

### `measure`
Mide una respuesta MCP {content:[{type,text}]}: tokens estimados, caracteres y si excede límites recomendados.

**Parámetros:**
  - `respuesta` (any, requerido): Respuesta MCP a medir
  - `limite_tokens` (number, opcional): Límite recomendado

### `truncate_safe`
Trunca una respuesta de forma segura: conserva JSON válido (elide arrays), corta texto por oraciones y añade aviso.

**Parámetros:**
  - `data` (any, requerido): Datos a truncar
  - `max_tokens` (number, opcional): Presupuesto de tokens

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "response-size-guard": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-response-size-guard/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

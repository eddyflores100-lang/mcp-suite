# Tool Registry

> Registro local de herramientas: catálogo, tags y búsqueda semántica ligera

**Categoría:** Resiliencia de Tools · **ID:** `mcp-tool-registry`

**Dolor de agente que resuelve:** Con decenas de MCP instalados el agente no sabe qué tools existen ni qué hacen: falta un registro consultable.

> Estado persistente en `~/.mcp-suite/tool-registry/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `register`
Registra una herramienta: nombre, servidor MCP, descripción, tags y coste estimado por llamada.

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la tool
  - `servidor` (string, requerido): Servidor MCP dueño
  - `descripcion` (string, requerido): Qué hace
  - `tags` (array, opcional): Tags para búsqueda
  - `costo_llamada` (string, opcional): Coste/latencia estimada (ej: $0.001, 800ms)

### `search`
Busca tools por texto (nombre/desc/tags) y devuelve las mejores coincidencias con su servidor.

**Parámetros:**
  - `consulta` (string, requerido): Qué necesitas hacer
  - `limite` (number, opcional): Máx resultados

### `list_all`
Lista todas las tools registradas agrupadas por servidor.

### `unregister`
Elimina una tool del registro (cuando desinstalas su servidor).

**Parámetros:**
  - `nombre` (string, requerido): Tool a eliminar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "tool-registry": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-tool-registry/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

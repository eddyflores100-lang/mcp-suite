# Tool Router

> Enruta cada intención a la mejor tool: menos decisiones erróneas del modelo

**Categoría:** Resiliencia de Tools · **ID:** `mcp-tool-router`

**Dolor de agente que resuelve:** Con 100+ tools disponibles el LLM elige mal o llama la incorrecta (dolor #1 reportado por merge.dev sobre MCP).

> Estado persistente en `~/.mcp-suite/tool-router/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `add_route`
Define una regla de ruteo: patrón de intención → tool concreta (con prioridad).

**Parámetros:**
  - `intencion` (string, requerido): Patrón de intención (ej: leer página web)
  - `tool` (string, requerido): Tool a enrutar
  - `prioridad` (number, opcional): Prioridad (mayor = primero)

### `route`
Dada una intención en texto, devuelve la tool recomendada (match por similitud de intención) y registra el uso.

**Parámetros:**
  - `intencion` (string, requerido): Qué se quiere hacer

### `stats`
Estadísticas de ruteo: qué rutas se usan más (para ajustar prioridades).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "tool-router": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-tool-router/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

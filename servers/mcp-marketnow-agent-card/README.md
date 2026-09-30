# MarketNow · Agent Card

> Lee la tarjeta machine-readable de marketnow.site y descubre sus capabilities MCP/A2A

**Categoría:** MarketNow · **ID:** `mcp-marketnow-agent-card`

**Dolor de agente que resuelve:** Los agentes no saben qué servicios ofrece un sitio ni cómo interactuar con él: falta descubrimiento estandarizado de capabilities.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (5 incl. health_check)

### `get_agent_card`
Descarga en vivo la tarjeta de agente de marketnow.site (GET /api/agent.json): nombre, descripción, versión, URL y capabilities soportadas.

### `list_remote_mcp_tools`
Lista las herramientas MCP que expone MarketNow remotamente (search_skills, get_skill, get_categories, health) según su agent card, con descripción de cada una.

### `get_discovery_endpoints`
Devuelve los endpoints de discovery estándar de marketnow.site: .well-known/mcp.json, .well-known/agent.json, sitemap.xml y robots.txt.

### `check_marketplace_health`
Ping de salud del marketplace: verifica que /api/agent.json responde y devuelve estadísticas básicas del catálogo.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-agent-card": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-agent-card/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Hace fetch en vivo de https://marketnow.site/api/agent.json (7KB) y expone sus capabilities: protocolos MCP (SSE/WebSocket/JSON-RPC), herramientas (search_skills, get_skill, get_categories, health), A2A agent card, ATC y endpoints de discovery.

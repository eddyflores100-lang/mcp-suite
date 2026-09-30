# A2A Agent Card

> Genera y valida agent cards (agent.json / .well-known) para el protocolo Agent2Agent

**Categoría:** MarketNow Trust · **ID:** `mcp-a2a-agent-card`

**Dolor de agente que resuelve:** En A2A cada agente publica su card, pero las cards mal formadas rompen el descubrimiento: falta validación de schema y endpoints.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (4 incl. health_check)

### `create_card`
Genera una agent card A2A válida: nombre, descripción, capabilities, skills/servicios y URLs de endpoint.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del agente
  - `descripcion` (string, opcional): Descripción
  - `url_endpoint` (string, opcional): URL base del agente
  - `skills` (array, opcional): Skills/servicios que expone (strings)
  - `version` (string, opcional): Versión del agente

### `validate_card`
Valida una agent card A2A: campos obligatorios, tipos correctos, URLs bienformadas y skills bien definidas.

**Parámetros:**
  - `card` (any, requerido): Agent card a validar

### `check_wellknown`
Comprueba en vivo que una URL sirve su .well-known/agent.json y valida la card encontrada (para peers A2A).

**Parámetros:**
  - `base_url` (string, requerido): URL base del agente peer (ej: https://marketnow.site)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "a2a-agent-card": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-a2a-agent-card/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

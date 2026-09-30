# MarketNow · Skill Search

> Busca entre los 66.496 skills MCP del catálogo de MarketNow con índice local + modo en vivo

**Categoría:** MarketNow · **ID:** `mcp-marketnow-search`

**Dolor de agente que resuelve:** Descubrir skills MCP confiables es difícil: el registro MCP, Smithery y Glama resolvieron discovery, pero el agente necesita buscar/filtrar por score de seguridad y categoría.

> Este servidor incluye datos embebidos en `data/` (no requiere conexión para operar).

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

> Estado persistente en `~/.mcp-suite/marketnow-search/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `search_skills`
Busca skills en el snapshot local (instantáneo, offline): filtra por texto (nombre/desc/tags), categoría, sentinel_score mínimo y precio. Devuelve hasta 20 resultados con install command y score.

**Parámetros:**
  - `q` (string, opcional): Texto a buscar (nombre, descripción o tags)
  - `categoria` (string, opcional): Categoría exacta (ej: Developer Tools, Security, AI/ML)
  - `min_score` (number, opcional): Sentinel score mínimo (0-10)
  - `solo_gratis` (boolean, opcional): Solo skills gratuitas
  - `limite` (number, opcional): Máximo de resultados

### `get_skill`
Obtiene el detalle completo de una skill del snapshot local por id, slug o nombre: install, author, licencia, capacidades y source.

**Parámetros:**
  - `identificador` (string, requerido): id, slug o name de la skill

### `list_categories`
Lista las 16 categorías del catálogo de MarketNow con conteo real de skills por categoría (del snapshot + stats del catálogo completo).

### `search_live`
Búsqueda en vivo sobre el catálogo COMPLETO (66.496 skills): descarga ~94MB la primera vez, cachea 7 días en ~/.mcp-suite/ y luego filtra localmente. Úsalo cuando el snapshot no baste.

**Parámetros:**
  - `q` (string, requerido): Texto a buscar
  - `min_score` (number, opcional): Sentinel score mínimo
  - `limite` (number, opcional): Máximo resultados

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-search": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-search/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Funciona offline con un snapshot embebido de 500 skills top (generado del catálogo real de 66.496). El modo live (search_live) descarga el catálogo completo (~94MB) una vez y lo cachea 7 días en ~/.mcp-suite/marketnow-search/.

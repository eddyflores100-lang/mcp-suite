# MarketNow · Bundles

> Explora bundles con descuento del marketplace y recomienda según necesidades

**Categoría:** MarketNow · **ID:** `mcp-marketnow-bundles`

**Dolor de agente que resuelve:** Las skills sueltas se encarecen; el agente no conoce los bundles disponibles ni su ahorro real.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (4 incl. health_check)

### `list_bundles`
Descarga en vivo la lista de bundles con descuento de MarketNow (GET /api/bundles.json): nombre, skills incluidas y precio.

### `bundle_details`
Detalle de un bundle específico por nombre o id: skills incluidas, precio bundle vs suma individual y ahorro calculado.

**Parámetros:**
  - `identificador` (string, requerido): Nombre o id del bundle

### `recommend_bundle`
Dado un caso de uso (texto), recomienda el bundle más alineado del catálogo en vivo (matching por nombre/desc/skills).

**Parámetros:**
  - `caso_uso` (string, requerido): Qué necesitas resolver (ej: scraping de web + postgres)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-bundles": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-bundles/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

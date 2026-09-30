# MarketNow · Quickstart

> Guía al agente para operar el marketplace: instalar, buscar, publicar y cobrar

**Categoría:** MarketNow · **ID:** `mcp-marketnow-quickstart`

**Dolor de agente que resuelve:** El agente llega al marketplace sin manual: qué endpoints usar, cómo instalar, cómo publicar skill propia y cómo cobran las comisiones.

## Tools (4 incl. health_check)

### `how_to_install`
Cómo instalar skills del marketplace: instalador oficial, clientes soportados y flujo recomendado.

### `how_to_publish`
Cómo publicar tu skill en MarketNow: requisitos L1, auditoría Sentinel gratis y modelo económico (80/20).

### `marketplace_facts`
Cifras clave del marketplace MarketNow para decisiones rápidas: tamaño, scans, comisiones, licencia del sitio.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-quickstart": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-quickstart/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

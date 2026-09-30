# MarketNow · Certification

> Reportes de certificación L1/L2 del pipeline Sentinel: 10/10 checks y deep-scans

**Categoría:** MarketNow · **ID:** `mcp-marketnow-certification`

**Dolor de agente que resuelve:** Las certificaciones de skills viven en PDFs/portales: el agente no puede consultarlas programáticamente para decidir.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (4 incl. health_check)

### `get_certification`
Reporte de certificación en vivo (GET /api/certification.json): cuántas skills index-certified L1, deep-scan L2 y estado global.

### `get_scans`
Detalle de los deep-scans L2 (GET /api/certification-scans.json): tarballs escaneados, reglas Sentinel aplicadas y hallazgos.

### `l1_checklist`
Los 10 checks del nivel L1 de Sentinel (Repo Exists, Has README, Has Manifest, Has License, No Secrets, No Malicious Code, etc.) con explicación de cada uno para auto-evaluarte.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-certification": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-certification/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

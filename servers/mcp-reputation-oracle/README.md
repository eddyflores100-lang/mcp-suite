# Reputation Oracle

> Agrega señales heterogéneas en un score de reputación explicable para sellers y skills

**Categoría:** MarketNow Ops · **ID:** `mcp-reputation-oracle`

**Dolor de agente que resuelve:** Score = caja negra: el comprador no sabe cómo se compone la reputación de una skill ni qué señales pesan.

> Estado persistente en `~/.mcp-suite/reputation-oracle/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `score_from_signals`
Calcula score de reputación 0-100 desde señales: stars GitHub, downloads npm, sentinel score, antigüedad, tasa de issues. Pesos ajustables.

**Parámetros:**
  - `estrellas` (number, opcional): Estrellas GitHub
  - `downloads` (number, opcional): Descargas semanales npm
  - `sentinel` (number, opcional): Sentinel score 0-10
  - `issues_abiertos` (number, opcional): Issues abiertos
  - `antiguedad_meses` (number, opcional): Meses desde primer release

### `suspicious_patterns`
Detecta patrones de manipulación de reputación: reviews duplicadas, spikes de descargas, puntuaciones inconsistentes.

**Parámetros:**
  - `reviews` (array, requerido): Lista de reviews [{autor, texto, estrellas, fecha}]

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "reputation-oracle": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-reputation-oracle/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

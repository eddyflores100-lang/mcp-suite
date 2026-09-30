# Trust Gateway

> Toma decisiones de confianza centralizadas: políticas, scores y explicabilidad

**Categoría:** MarketNow Trust · **ID:** `mcp-trust-gateway`

**Dolor de agente que resuelve:** Cada tool decide confianza por su cuenta: faltan políticas centrales (score mínimo, scopes, deny-list) con decisiones explicables.

> Estado persistente en `~/.mcp-suite/trust-gateway/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `set_policy`
Define la política de confianza local: score mínimo, tiers permitidos, formatos aceptados y deny-list de emisores.

**Parámetros:**
  - `min_score` (number, opcional): Score mínimo global
  - `tiers_permitidos` (array, opcional): Tiers permitidos (safe/caution)
  - `deny_issuers` (array, opcional): Emisores prohibidos

### `decide`
Evalúa una skill/credencial contra la política local: ALLOW/DENY con razones. Si no hay política, usa defaults prudentes (score>=7).

**Parámetros:**
  - `identificador` (string, requerido): Identificador de la skill/credencial
  - `score` (number, opcional): Trust/sentinel score (0-10)
  - `issuer` (string, opcional): Emisor

### `decision_log`
Historial de decisiones tomadas por el gateway (últimas 50) para auditoría.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "trust-gateway": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-trust-gateway/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

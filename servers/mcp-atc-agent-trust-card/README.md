# ATC · Agent Trust Card

> Crea y verifica Agent Trust Cards firmadas (Ed25519 + JCS), el estándar de identidad del marketplace

**Categoría:** MarketNow Trust · **ID:** `mcp-atc-agent-trust-card`

**Dolor de agente que resuelve:** Un agente presenta identidad sin prueba criptográfica: hace falta una trust card firmada verificable (ATC de MarketNow).

> Estado persistente en `~/.mcp-suite/atc-agent-trust-card/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `create_card`
Crea una Agent Trust Card: genera (o reusa) par Ed25519, firma el payload canonizado con JCS y devuelve la card completa verificable.

**Parámetros:**
  - `subject` (string, requerido): Identidad del agente (ej: agente-scraping-01)
  - `issuer` (string, opcional): Emisor de la card
  - `trust_score` (number, opcional): Score de confianza 0-10
  - `capabilities` (array, opcional): Lista de capacidades declaradas
  - `horas_validez` (number, opcional): Vigencia en horas

### `verify_card`
Verifica una ATC: re-canoniza el payload (sin proof), valida la firma Ed25519, expiración y score. Devuelve veredicto por etapa.

**Parámetros:**
  - `card` (any, requerido): La Agent Trust Card completa (JSON)

### `list_cards`
Lista las cards creadas localmente (subject, fecha, score, expiración).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "atc-agent-trust-card": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-atc-agent-trust-card/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

ATC = payload (subject, issuer, trust_score, capabilities, vigencia) + proof Ed25519 sobre la forma canónica JCS. Guarda claves y cards en ~/.mcp-suite/atc-agent-trust-card/.

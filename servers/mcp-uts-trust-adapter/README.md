# UTS · Trust Adapter

> El USB-C de la confianza: traduce 8 formatos de credencial al Universal Trust Schema

**Categoría:** MarketNow Trust · **ID:** `mcp-uts-trust-adapter`

**Dolor de agente que resuelve:** Cada ecosistema usa su formato (W3C VC, OAuth, SPIFFE, MCP Card, A2A, ZTA, EAT-AI, ATC): los agentes no pueden comparar credenciales heterogéneas.

## Tools (4 incl. health_check)

### `list_adapters`
Lista los 8 adaptadores de formato soportados y qué campos mapea cada uno.

### `detect_format`
Detecta automáticamente el formato de una credencial JSON por sus campos característicos.

**Parámetros:**
  - `credential` (any, requerido): Credencial JSON a identificar

### `to_uts`
Convierte una credencial de cualquier formato soportado al Universal Trust Schema (UTS v2): campos normalizados comparables.

**Parámetros:**
  - `credential` (any, requerido): Credencial original
  - `formato` (enum, opcional): Formato origen

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "uts-trust-adapter": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-uts-trust-adapter/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

UTS = esquema canónico {subject, issuer, issued_at, expires_at, score, capabilities, format, proof_type}. Mapea desde/hacia los 8 formatos con adaptadores de campos.

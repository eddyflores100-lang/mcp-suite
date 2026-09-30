# Consent Ledger

> Libro mayor de consentimientos con propósito: cada uso de datos personales amparado por un consentimiento vivo

**Categoría:** Cumplimiento · **ID:** `mcp-consent-ledger`

**Dolor de agente que resuelve:** El agente usa datos personales sin saber si el titular consintió ese uso: no hay ledger de consentimientos con propósito, vigencia y alcance, así que el 'sí dijo que sí' es imaginario.

> Estado persistente en `~/.mcp-suite/consent-ledger/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `record_consent`
Registra un consentimiento: titular, propósitos autorizados, vigencia y base legal.

**Parámetros:**
  - `titular` (string, requerido): Identificador del titular (anonimizado)
  - `propositos` (array, requerido): Propósitos autorizados (analitica, soporte, marketing...)
  - `vigencia_meses` (number, opcional): Vigencia del consentimiento
  - `base_legal` (string, opcional): Base legal (consentimiento, contrato...)

### `verify_use`
Verifica que un uso de datos concreto está amparado: titular + propósito dentro de la vigencia.

**Parámetros:**
  - `titular` (string, requerido): Titular de los datos
  - `proposito` (string, requerido): Propósito del uso previsto

### `revoke`
Revoca el consentimiento de un titular (total o de un propósito concreto).

**Parámetros:**
  - `titular` (string, requerido): Titular
  - `proposito` (string, opcional): Solo revocar este propósito (vacío = todo)

### `consent_audit`
Auditoría de usos: cada uso de datos con su consentimiento amparador y usos fuera de amparo.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "consent-ledger": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-consent-ledger/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/consent-ledger/. Consentimientos {titular, propósitos, vigencia, estado}; cada uso de datos verifica propósito + vigencia, y todo queda auditado.

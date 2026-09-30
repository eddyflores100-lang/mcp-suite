# Consent Manager

> Consentimientos RGPD-style: qué datos puede procesar el agente y para qué

**Categoría:** Seguridad · **ID:** `mcp-consent-manager`

**Dolor de agente que resuelve:** El agente procesa datos personales sin registro de consentimiento: pesadilla de compliance (RGPD/LGPD).

> Estado persistente en `~/.mcp-suite/consent-manager/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `grant`
Registra un consentimiento: sujeto, propósitos autorizados, datos involucrados y vigencia.

**Parámetros:**
  - `sujeto` (string, requerido): Identificador del sujeto
  - `propositos` (array, requerido): Propósitos autorizados
  - `datos` (array, requerido): Categorías de datos (contacto, perfil...)
  - `meses` (number, opcional): Vigencia en meses

### `check`
Verifica si un procesamiento (sujeto + propósito + categoría de dato) está consentido y vigente.

**Parámetros:**
  - `sujeto` (string, requerido): Sujeto
  - `proposito` (string, requerido): Propósito del procesamiento
  - `dato` (string, requerido): Categoría de dato

### `revoke`
Revoca el consentimiento de un sujeto (todo procesamiento futuro queda bloqueado).

**Parámetros:**
  - `sujeto` (string, requerido): Sujeto

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "consent-manager": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-consent-manager/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

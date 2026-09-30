# PII Redactor

> Enmascara datos personales (PII) antes de enviar texto a APIs externas

**Categoría:** Seguridad · **ID:** `mcp-pii-redactor`

**Dolor de agente que resuelve:** El agente manda nombres, teléfonos, cédulas y tarjetas a APIs de terceros: fuga de PII por defecto.

## Tools (3 incl. health_check)

### `redact`
Detecta y enmascara PII: emails, teléfonos, cédulas/DNI/RUC ecuatorianos, SSN, tarjetas, IBAN, direcciones IP. Devuelve texto limpio + resumen.

**Parámetros:**
  - `texto` (string, requerido): Texto con posible PII
  - `modo` (enum, opcional): Modo de redacción

### `detect_types`
Solo detecta (sin redactar): qué tipos de PII contiene un texto y cuántos de cada uno.

**Parámetros:**
  - `texto` (string, requerido): Texto a analizar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "pii-redactor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-pii-redactor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

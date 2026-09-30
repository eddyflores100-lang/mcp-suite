# W3C VC Kit

> Construye y valida Verifiable Credentials (estructura W3C) para claims de agentes

**Categoría:** MarketNow Trust · **ID:** `mcp-w3c-vc-kit`

**Dolor de agente que resuelve:** Los claims de un agente ('fui auditado', 'tengo score 9') no son verificables sin la estructura VC estándar.

## Tools (3 incl. health_check)

### `build_vc`
Construye una Verifiable Credential W3C: issuer, subject, claims tipados, fecha de emisión/expiración y proof placeholder para firmar.

**Parámetros:**
  - `issuer` (string, requerido): Emisor de la credencial
  - `subject_id` (string, requerido): DID o id del sujeto
  - `claims` (any, requerido): Objeto de claims (ej: {trust_score: 9, audited: true})
  - `dias_validez` (number, opcional): Días de validez

### `validate_vc`
Valida la estructura de una VC W3C: contexts, tipos, fechas, subject y proof presente. (No verifica la criptografía: usa verification-pipeline para eso).

**Parámetros:**
  - `vc` (any, requerido): Verifiable Credential a validar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "w3c-vc-kit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-w3c-vc-kit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

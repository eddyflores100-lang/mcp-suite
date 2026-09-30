# DID Resolver

> Identidades descentralizadas did:agent: crea, resuelve, firma, verifica y revoca sin registrar nada en tercero

**Categoría:** Identidad Federada · **ID:** `mcp-did-resolver`

**Dolor de agente que resuelve:** El agente se presenta con un nombre que cualquiera puede inventar. Sin documento de identidad verificable (DID) no hay forma de saber que quien firma es quien dice ser, ni de revocar una identidad comprometida.

> Estado persistente en `~/.mcp-suite/did-resolver/state.json` (local, privado, tuya la data).

## Tools (7 incl. health_check)

### `create_did`
Crea una identidad did:agent para un agente con su documento completo.

**Parámetros:**
  - `agente` (string, requerido): Nombre/descriptor del agente
  - `proposito` (string, opcional): Para qué se usará esta identidad

### `resolve_did`
Resuelve un DID a su documento: estado, clave de verificación y metadatos.

**Parámetros:**
  - `did` (string, requerido): DID a resolver (did:agent:...)

### `sign_payload`
Firma un payload con la clave del DID: devuelve firma + todo lo necesario para verificar.

**Parámetros:**
  - `did` (string, requerido): DID firmante
  - `payload` (string, requerido): Contenido a firmar

### `verify_payload`
Verifica una firma emitida por sign_payload contra el documento actual del DID.

**Parámetros:**
  - `did` (string, requerido): DID del firmante declarado
  - `payload` (string, requerido): Contenido original (sin modificar)
  - `firma` (string, requerido): Firma a verificar

### `revoke_did`
Revoca una identidad (motivo obligatorio). Las verificaciones posteriores fallarán.

**Parámetros:**
  - `did` (string, requerido): DID a revocar
  - `motivo` (string, requerido): Por qué se revoca (compromiso, rotación, fin de vida)

### `list_dids`
Inventario de identidades locales: activas, revocadas y uso de firma.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "did-resolver": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-did-resolver/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/did-resolver/. Emite documentos DID locales con clave de verificación derivada de un seed determinista (SHA-256), firma/verifica payloads HMAC-SHA256 y soporta revocación con motivo.

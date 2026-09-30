# Ed25519 Toolbox

> Genera claves, firma y verifica mensajes con Ed25519 (RFC 8032) — la base del trust de agentes

**Categoría:** MarketNow Trust · **ID:** `mcp-ed25519-toolbox`

**Dolor de agente que resuelve:** Los agentes firman/verifican sin crypto adecuada: falta una toolbox Ed25519 simple y correcta para identidad de agentes.

> Estado persistente en `~/.mcp-suite/ed25519-toolbox/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `generate_keypair`
Genera un par de claves Ed25519 y la guarda localmente con un alias. Devuelve la pública PEM.

**Parámetros:**
  - `alias` (string, requerido): Alias para guardar la clave (ej: mi-agente)

### `sign_message`
Firma un mensaje con la clave privada del alias guardado. Devuelve firma en base64 (detached).

**Parámetros:**
  - `alias` (string, requerido): Alias de la clave
  - `mensaje` (string, requerido): Mensaje a firmar

### `verify_signature`
Verifica una firma detached Ed25519 dado el mensaje, la firma base64 y la clave pública PEM.

**Parámetros:**
  - `mensaje` (string, requerido): Mensaje original
  - `firma_b64` (string, requerido): Firma en base64
  - `public_pem` (string, requerido): Clave pública PEM

### `list_keys`
Lista los alias de claves guardadas (solo metadatos, nunca la privada).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "ed25519-toolbox": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-ed25519-toolbox/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Usa node:crypto nativo (Ed25519, RFC 8032). Las claves se guardan como PEM en ~/.mcp-suite/ed25519-toolbox/. Las firmas son detached (solo la firma) y también firmas JWS compactas.

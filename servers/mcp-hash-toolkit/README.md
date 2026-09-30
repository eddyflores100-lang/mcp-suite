# Hash Toolkit

> Hashing y encoding exacto: sha256, hmac, base64, hex y checksums

**Categoría:** Utilidades · **ID:** `mcp-hash-toolkit`

**Dolor de agente que resuelve:** Verificar integridad o firmar un payload exige hashing exacto: 'calcular' un sha256 de cabeza es imposible.

## Tools (4 incl. health_check)

### `hash`
Calcula el hash de un texto en md5/sha1/sha256/sha512 (hex o base64).

**Parámetros:**
  - `texto` (string, requerido): Texto a hashear
  - `algoritmo` (enum, opcional): Algoritmo
  - `encoding` (enum, opcional): Salida

### `hmac`
Calcula HMAC (sha256 por defecto) de un mensaje con un secreto — para firmar webhooks y payloads.

**Parámetros:**
  - `mensaje` (string, requerido): Mensaje
  - `secreto` (string, requerido): Secreto compartido
  - `algoritmo` (enum, opcional): Algoritmo

### `encode_decode`
Codifica/decodifica base64, base64url y hex con detección automática de la operación.

**Parámetros:**
  - `operacion` (enum, requerido): Operación
  - `formato` (enum, opcional): Formato
  - `dato` (string, requerido): Dato a transformar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "hash-toolkit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-hash-toolkit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

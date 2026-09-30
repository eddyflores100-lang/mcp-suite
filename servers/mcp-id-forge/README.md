# ID Forge

> Genera identificadores: UUIDv4, ULID, nanoid y slugs — ordenables y colisionables a propósito

**Categoría:** Utilidades · **ID:** `mcp-id-forge`

**Dolor de agente que resuelve:** IDs ad-hoc ('temp1', 'final-final2') rompen deduplicación y orden: hace falta generación seria.

## Tools (4 incl. health_check)

### `uuid`
Genera N UUIDs v4 criptográficamente aleatorios.

**Parámetros:**
  - `n` (number, opcional): Cuántos

### `ulid`
Genera ULIDs (ordenables por tiempo, 26 chars, safe para URLs): ideales para claves de eventos.

**Parámetros:**
  - `n` (number, opcional): Cuántos

### `slugify`
Convierte texto (con acentos y símbolos) en slug URL-safe único.

**Parámetros:**
  - `texto` (string, requerido): Texto a convertir
  - `max_len` (number, opcional): Longitud máxima

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "id-forge": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-id-forge/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

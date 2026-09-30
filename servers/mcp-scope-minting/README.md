# Scope Minting

> Acuña capacidades de mínimo privilegio como tokens: verbo + recurso + límites, verificables en un paso

**Categoría:** Identidad Federada · **ID:** `mcp-scope-minting`

**Dolor de agente que resuelve:** Al agente se le dan credenciales todopoderosas para leer UN archivo: la única granularidad disponible es 'todo o nada'. Sin tokens de alcance fino, cualquier filtración de credencial es total.

> Estado persistente en `~/.mcp-suite/scope-minting/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `define_capability`
Declara una capacidad acuñable: verbo sobre recurso con restricciones.

**Parámetros:**
  - `nombre` (string, requerido): Nombre único de la capacidad
  - `verbo` (string, requerido): Verbo permitido (leer, escribir, llamar...)
  - `recurso` (string, requerido): Recurso objetivo (ruta, tabla, endpoint)
  - `restricciones` (any, opcional): Límites extra {max_registros, solo_columnas, horas}

### `mint_token`
Acuña un token de capacidad con expiración y usos máximos.

**Parámetros:**
  - `capacidad` (string, requerido): Nombre de la capacidad
  - `portador` (string, requerido): Agente que portará el token
  - `expira_horas` (number, opcional): Vigencia en horas
  - `max_usos` (number, opcional): Usos máximos (0 = ilimitado hasta expirar)

### `check_token`
Verifica si un token autoriza UNA acción concreta (verbo+recurso exactos) y consume el uso.

**Parámetros:**
  - `id` (string, requerido): Id del token
  - `nonce` (string, requerido): Nonce del token
  - `accion_verbo` (string, requerido): Verbo que se quiere ejecutar
  - `accion_recurso` (string, requerido): Recurso que se quiere tocar
  - `consumir` (boolean, opcional): Consumir el uso si autoriza

### `burn_token`
Quema un token antes de su expiración (ya no se necesita o hay sospecha).

**Parámetros:**
  - `id` (string, requerido): Token a quemar
  - `motivo` (string, opcional): Motivo

### `token_census`
Censo de tokens: activos, por capacidad, agotados y quemados.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "scope-minting": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-scope-minting/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/scope-minting/. Capacidades declaradas (verbo+recurso+constraints); los tokens acuñados llevan nonce, expiración y límite de usos; check_token valida que el token cubre la acción exacta pedida.

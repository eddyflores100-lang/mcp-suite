# Agent Memory

> Memoria KV persistente entre sesiones con TTL y namespaces

**Categoría:** Memoria y Contexto · **ID:** `mcp-agent-memory`

**Dolor de agente que resuelve:** Los agentes amnésicos olvidan todo al cerrar la sesión: cada conversación empieza de cero.

> Estado persistente en `~/.mcp-suite/agent-memory/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `remember`
Guarda un valor bajo una clave (con namespace y TTL opcional). Persiste entre sesiones.

**Parámetros:**
  - `clave` (string, requerido): Clave única
  - `valor` (string, requerido): Valor a recordar
  - `namespace` (string, opcional): Namespace (ej: proyecto-x)
  - `ttl_segundos` (number, opcional): TTL: expira tras N segundos

### `recall`
Recupera el valor de una clave (respetando TTL: devuelve null si expiró).

**Parámetros:**
  - `clave` (string, requerido): Clave a recuperar
  - `namespace` (string, opcional): Namespace

### `list_keys`
Lista las claves guardadas en un namespace (con timestamps y expiración).

**Parámetros:**
  - `namespace` (string, opcional): Namespace
  - `prefijo` (string, opcional): Filtrar por prefijo

### `forget`
Elimina una clave (o todo el namespace con confirmar=true).

**Parámetros:**
  - `clave` (string, opcional): Clave a olvidar
  - `namespace` (string, opcional): Namespace
  - `confirmar` (boolean, opcional): Borrar namespace completo

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-agent-memory/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Clave-valor persistente en ~/.mcp-suite/agent-memory/. Soporta namespaces (por proyecto/agente), TTL opcional y búsqueda por prefijo.

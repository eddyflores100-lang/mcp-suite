# Cross-Tenant Guard

> Guardián de flujos entre inquilinos: ninguna transferencia de datos cruza tenants sin política explícita que lo permita

**Categoría:** Multi-Tenant · **ID:** `mcp-cross-tenant-guard`

**Dolor de agente que resuelve:** El agente 'optimiza' combinando datos de dos clientes para responder mejor a un tercero: nadie le dijo que ese flujo cruzado estaba prohibido, porque el prohibido no estaba escrito en ninguna parte.

> Estado persistente en `~/.mcp-suite/cross-tenant-guard/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `set_policy`
Define qué flujos entre tenants están PERMITIDOS (todo lo demás se deniega por defecto).

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la política
  - `desde_clasificacion` (enum, requerido): Clasificación del origen
  - `hacia_clasificacion_max` (enum, requerido): Clasificación máxima del destino
  - `permitido` (boolean, requerido): ¿Se permite este patrón?
  - `condicion` (string, opcional): Condición adicional si se permite

### `check_transfer`
Valida una transferencia concreta: origen, destino y clasificaciones; devuelve veredicto fail-closed.

**Parámetros:**
  - `tenant_origen` (string, requerido): Tenant que aporta el dato
  - `clasificacion_origen` (enum, requerido): Clasificación del dato que se mueve
  - `tenant_destino` (string, requerido): Tenant que recibiría
  - `clasificacion_destino` (enum, requerido): Nivel de protección del destino
  - `proposito` (string, opcional): Para qué se transferiría

### `violations`
Registro de intentos de flujo cruzado denegados, con contexto.

**Parámetros:**
  - `solo_criticas` (boolean, opcional): Solo PII cruzada

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "cross-tenant-guard": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-cross-tenant-guard/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/cross-tenant-guard/. Políticas de flujo permitido (por clasificación y dirección); check_transfer valida cada transferencia y las violaciones quedan con contexto completo para auditoría.

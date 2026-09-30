# Audit Log

> Bitácora inmutable con cadena de hash: cada acción del agente es auditable

**Categoría:** Seguridad · **ID:** `mcp-audit-log`

**Dolor de agente que resuelve:** Sin bitácora inmutable no hay forma de reconstruir qué hizo el agente (ni defenderse en disputas): estilo public audit log de MarketNow.

> Estado persistente en `~/.mcp-suite/audit-log/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `append`
Añade una entrada a la bitácora encadenada: cada registro lleva el hash del anterior (tamper-evident).

**Parámetros:**
  - `actor` (string, requerido): Quién ejecuta (agente/humano/tool)
  - `accion` (string, requerido): Qué se hizo
  - `detalle` (string, opcional): Detalles/resultado

### `verify_chain`
Verifica la integridad de toda la cadena de hash: detecta si alguien alteró entradas históricas.

### `query`
Consulta la bitácora: filtra por actor, acción (texto) y ventana de horas.

**Parámetros:**
  - `actor` (string, opcional): Filtrar por actor
  - `contiene` (string, opcional): Filtrar acción que contenga texto
  - `horas` (number, opcional): Últimas N horas
  - `limite` (number, opcional): Máx entradas

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "audit-log": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-audit-log/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

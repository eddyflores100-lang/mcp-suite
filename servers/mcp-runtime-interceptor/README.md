# Runtime Interceptor

> Reglas de interceptación en runtime: bloquea .env, rm -rf, spawns y escrituras de sistema

**Categoría:** MarketNow Ops · **ID:** `mcp-runtime-interceptor`

**Dolor de agente que resuelve:** Las skills instaladas ejecutan comandos en tu máquina: hace falta un interceptor que evalúe cada comando contra políticas de bloqueo.

> Estado persistente en `~/.mcp-suite/runtime-interceptor/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `check_command`
Evalúa un comando contra las reglas de interceptación activas. Devuelve ALLOW/BLOCK con la regla que aplica.

**Parámetros:**
  - `comando` (string, requerido): Comando a evaluar

### `add_rule`
Añade una regla personalizada de interceptación (patrón regex + acción block/warn/allow).

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la regla
  - `patron` (string, requerido): Patrón regex
  - `accion` (enum, requerido): Acción al matchear

### `list_rules`
Lista todas las reglas de interceptación activas (las 5 por defecto de MarketNow + personalizadas).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "runtime-interceptor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-runtime-interceptor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Las 5 reglas por defecto replican el Runtime Interceptor de MarketNow: bloquear acceso a .env, rm -rf, spawns de procesos, escrituras de sistema y network exfil a webhooks.

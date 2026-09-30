# Action Limiter

> Cinturón de seguridad del agente: limita frecuencia y volumen de acciones destructivas aunque el modelo insista

**Categoría:** Pre-Vuelo · **ID:** `mcp-action-limiter`

**Dolor de agente que resuelve:** El agente entra en bucle y repite la llamada destructiva 47 veces porque 'el error dice que reintentes'. Sin limitador local, ni el prompt ni el buen propósito frenan la máquina.

> Estado persistente en `~/.mcp-suite/action-limiter/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `set_policy`
Define el límite para una clase de acciones (verbo sobre objetivo).

**Parámetros:**
  - `verbo` (string, requerido): Verbo de la acción (delete, send, update, create...)
  - `objetivo` (string, opcional): Patrón del objetivo (archivo:*, tabla:*, api:*)
  - `max_por_hora` (number, opcional): Máximo permitido por hora (0 = ilimitado)
  - `max_por_sesion` (number, opcional): Máximo por sesión (0 = ilimitado)
  - `escala` (enum, opcional): Qué hacer al superarlo

### `check_action`
Pregunta ANTES de ejecutar: ¿esta acción está dentro de límite? Devuelve PERMITIDO / AVISADO / CONFIRMAR_HUMANO / BLOQUEADO con motivo.

**Parámetros:**
  - `verbo` (string, requerido): Verbo de la acción
  - `objetivo` (string, requerido): Objetivo concreto (ej: tabla:usuarios)
  - `sesion` (string, opcional): Sesión/agente que ejecuta

### `register_action`
Registra la ejecución real de la acción (alimenta los contadores).

**Parámetros:**
  - `verbo` (string, requerido): Verbo ejecutado
  - `objetivo` (string, requerido): Objetivo
  - `resultado` (string, opcional): exito | error | parcial
  - `sesion` (string, opcional): Sesión

### `usage_report`
Consumo por verbo/objetivo en la última hora y estado frente a cada política.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "action-limiter": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-action-limiter/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/action-limiter/. Políticas por verbo+objetivo: máx por ventana, máx por sesión, y escala (avisar → exigir confirmación humana → bloquear). El contador es local: el agente no puede negociarlo.

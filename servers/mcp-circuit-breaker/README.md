# Circuit Breaker

> Disyuntor por servicio: deja de martillar lo que está caído

**Categoría:** Resiliencia de Tools · **ID:** `mcp-circuit-breaker`

**Dolor de agente que resuelve:** Cuando un servicio MCP cae, cada llamada espera su timeout completo: cascada de latencia. Falta circuit breaker.

> Estado persistente en `~/.mcp-suite/circuit-breaker/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `record_success`
Registra un éxito del servicio (resetea contador de fallos; cierra el circuito si estaba half-open).

**Parámetros:**
  - `servicio` (string, requerido): Nombre del servicio

### `record_failure`
Registra un fallo del servicio: al llegar al umbral, el circuito se ABRE (bloquea llamadas).

**Parámetros:**
  - `servicio` (string, requerido): Servicio
  - `umbral` (number, opcional): Fallos para abrir

### `check`
Consulta el estado del circuito para un servicio: permite llamar (closed/half-open tras cooldown) o bloqueado (open).

**Parámetros:**
  - `servicio` (string, requerido): Servicio
  - `cooldown_ms` (number, opcional): Cooldown antes de half-open

### `reset`
Resetea manualmente el circuito de un servicio (tras confirmar que volvió).

**Parámetros:**
  - `servicio` (string, requerido): Servicio

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "circuit-breaker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-circuit-breaker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Estados: CLOSED (normal) → OPEN tras N fallos (bloquea) → HALF-OPEN tras cooldown (prueba 1 llamada).

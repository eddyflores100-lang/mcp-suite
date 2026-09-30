# Heartbeat Monitor

> El agente reporta latidos: detecta congelamientos y sesiones huérfanas

**Categoría:** Observabilidad · **ID:** `mcp-heartbeat-monitor`

**Dolor de agente que resuelve:** Un agente congelado no falla: simplemente desaparece. Sin heartbeats, nadie nota la muerte silenciosa.

> Estado persistente en `~/.mcp-suite/heartbeat-monitor/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `beat`
Registra un latido de una unidad de trabajo (agente/bucle). Devuelve si está en riesgo (mucho tiempo sin latir no puede pasar, pero múltiple beats largos sí alertan).

**Parámetros:**
  - `unidad` (string, requerido): Nombre de la unidad (ej: agent-scraper)
  - `fase` (string, opcional): Fase actual del trabajo

### `status`
Estado de todas las unidades: último latido, intervalo medio y alerta si el intervalo creció (posible congelamiento lento).

**Parámetros:**
  - `umbral_factor` (number, opcional): Factor de degradación para alertar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "heartbeat-monitor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-heartbeat-monitor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

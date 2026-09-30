# Spend Envelope

> Sobres de gasto con autorización escalonada: el agente pide permiso ANTES de quemar el presupuesto

**Categoría:** Economía del Agente · **ID:** `mcp-spend-envelope`

**Dolor de agente que resuelve:** El agente no tiene freno económico: una tarea de $0.05 termina costando $3 porque nadie le exigió parar y pedir autorización al cruzar umbrales.

> Estado persistente en `~/.mcp-suite/spend-envelope/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `create_envelope`
Crea un sobre de gasto: techo, umbral de aviso (80% por defecto) y política al superarlo.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del sobre (misión, tarea X...)
  - `techo_usd` (number, requerido): Límite máximo en dólares
  - `padre` (string, opcional): Sobre padre (para jerarquía)
  - `umbral_aviso_pct` (number, opcional): % al que avisa
  - `politica` (enum, opcional): Al alcanzar el techo

### `spend`
Registra gasto contra un sobre: valida techo, jerarquía y devuelve directiva (ok, aviso, PARAR).

**Parámetros:**
  - `sobre` (string, requerido): Nombre del sobre
  - `concepto` (string, requerido): En qué se gastó (llm, tool, api)
  - `usd` (number, requerido): Importe gastado
  - `tokens` (number, opcional): Tokens si aplica

### `authorize`
Autoriza (o niega) continuar tras alcanzar el techo; queda auditoría de quién y cuánto extra.

**Parámetros:**
  - `sobre` (string, requerido): Nombre del sobre
  - `aprobado` (boolean, requerido): ¿Autorizado?
  - `monto_extra_usd` (number, opcional): Techo adicional autorizado
  - `autorizado_por` (string, requerido): Quién autoriza
  - `motivo` (string, requerido): Por qué

### `envelope_status`
Estado de un sobre: consumo, proyección al ritmo actual y movimientos recientes.

**Parámetros:**
  - `sobre` (string, requerido): Nombre del sobre

### `portfolio`
Panorama de todos los sobres: consumo agregado, sobres en riesgo y autorizaciones pendientes.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "spend-envelope": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-spend-envelope/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/spend-envelope/. Sobres jerárquicos (misión > tarea > sub-tarea) con techo, umbral de aviso y política de autorización (parar|pedir|abortar).

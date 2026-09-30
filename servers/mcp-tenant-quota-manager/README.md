# Tenant Quota Manager

> Cuotas por inquilino: tokens, llamadas y almacenaje con contadores que se agotan de verdad

**Categoría:** Multi-Tenant · **ID:** `mcp-tenant-quota-manager`

**Dolor de agente que resuelve:** Un tenant consume el 80% del presupuesto compartido y el resto ve respuestas lentas o errores: sin cuotas duras por inquilino, el recurso compartido es una tragedia de los comunes garantizada.

> Estado persistente en `~/.mcp-suite/tenant-quota-manager/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `set_quota`
Define la cuota de un tenant para el período actual.

**Parámetros:**
  - `tenant` (string, requerido): Tenant
  - `tokens` (number, opcional): Máximo de tokens (0 = ilimitado)
  - `llamadas` (number, opcional): Máximo de llamadas/tools
  - `almacenaje_mb` (number, opcional): Máximo de MB en store

### `consume`
Consume cuota: registra el gasto real del tenant en esta operación.

**Parámetros:**
  - `tenant` (string, requerido): Tenant
  - `tokens` (number, opcional): Tokens gastados
  - `llamadas` (number, opcional): Llamadas gastadas
  - `almacenaje_mb` (number, opcional): MB añadidos

### `check_quota`
Consulta el margen restante del tenant ANTES de emprender una tarea grande.

**Parámetros:**
  - `tenant` (string, requerido): Tenant
  - `tarea_requeriria` (any, opcional): Estimación de la tarea {tokens?, llamadas?}

### `quota_report`
Panorama de cuotas: quién se acerca al límite, quién no usa la suya.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "tenant-quota-manager": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-tenant-quota-manager/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/tenant-quota-manager/. Cuotas por tenant (tokens, llamadas, MB) con ventana diaria renovable; consume() incrementa y check_quota() devuelve techo/restante con estado.

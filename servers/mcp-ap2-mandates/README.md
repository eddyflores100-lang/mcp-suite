# AP2 Mandates

> Mandatos delegados AP2: permisos explícitos, revocables y human-in-the-loop

**Categoría:** MarketNow Trust · **ID:** `mcp-ap2-mandates`

**Dolor de agente que resuelve:** Un agente compra/actúa en nombre de un humano sin mandato auditable: faltan permisos delegados firmados, con límites y revocación.

> Estado persistente en `~/.mcp-suite/ap2-mandates/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `create_mandate`
Crea un mandato AP2: qué puede hacer el agente (scopes), límites (monto, usos, vigencia en horas) y aprobación humana obligatoria por defecto.

**Parámetros:**
  - `principal` (string, requerido): Identidad del humano que delega
  - `agent` (string, requerido): Identidad del agente delegado
  - `scopes` (array, requerido): Permisos (ej: ['skill:install', 'payment:free'])
  - `monto_max` (number, opcional): Monto máximo por operación (0 = solo gratis)
  - `max_usos` (number, opcional): Usos máximos antes de expirar
  - `horas` (number, opcional): Vigencia en horas
  - `modo_silencioso` (boolean, opcional): Permitir sin notificar al principal (default false)

### `check_mandate`
Verifica si una acción está cubierta por un mandato vigente: scope presente, usos disponibles, monto dentro de límite, no revocado.

**Parámetros:**
  - `mandate_id` (string, requerido): ID del mandato
  - `accion` (string, requerido): Accion a realizar (ej: skill:install)
  - `monto` (number, opcional): Monto de la operación

### `consume_mandate`
Registra un uso del mandato (decrementa usos, notifica al principal si human_in_loop) y devuelve el uso restante.

**Parámetros:**
  - `mandate_id` (string, requerido): ID del mandato
  - `detalle` (string, opcional): Descripción del uso

### `revoke_mandate`
Revoca un mandato inmediatamente (aplicable a usos futuros).

**Parámetros:**
  - `mandate_id` (string, requerido): ID del mandato a revocar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "ap2-mandates": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-ap2-mandates/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Mandato = {mandate_id, principal, agent, scopes, límites (monto máx, usos, vigencia), aprobación humana por defecto}. Se firma con Ed25519 (clave del principal) y es revocable.

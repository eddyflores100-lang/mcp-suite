# Idempotency Guard

> Claves de idempotencia: la misma operación nunca se ejecuta dos veces

**Categoría:** Resiliencia de Tools · **ID:** `mcp-idempotency-guard`

**Dolor de agente que resuelve:** Los reintentos duplican efectos (cobros, emails, registros): falta control de idempotencia estilo header Idempotency-Key.

> Estado persistente en `~/.mcp-suite/idempotency-guard/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `check_or_set`
Antes de ejecutar: verifica si la clave ya se usó (devuelve el resultado previo) o la registra como usada.

**Parámetros:**
  - `clave` (string, requerido): Clave de idempotencia única de la operación
  - `resultado` (string, opcional): Resultado a memoizar (opcional, para devolver en duplicados)

### `stats`
Cuántas claves registradas y cuántas colisiones (duplicados evitados) hasta ahora.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "idempotency-guard": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-idempotency-guard/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

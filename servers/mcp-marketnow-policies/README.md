# MarketNow · Policies

> Políticas de reembolso, disputas y términos del marketplace en formato legible por agentes

**Categoría:** MarketNow · **ID:** `mcp-marketnow-policies`

**Dolor de agente que resuelve:** Los agentes compran skills sin conocer políticas de reembolso/disputa: los términos viven en HTML disperso, no en formato accionable.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (4 incl. health_check)

### `get_policies`
Descarga en vivo las políticas de MarketNow (GET /api/policies.json): reembolso, disputas y términos.

### `refund_conditions`
Extrae y resume las condiciones de reembolso aplicables (ventana, criterios, exclusiones) desde las políticas en vivo.

### `dispute_steps`
Devuelve el procedimiento paso a paso para disputar una compra de skill según las políticas del marketplace.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-policies": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-policies/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

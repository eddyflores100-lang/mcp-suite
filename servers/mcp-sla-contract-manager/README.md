# SLA Contract Manager

> Contratos de nivel de servicio entre agentes: métricas, objetivos, ventanas y detección de brechas

**Categoría:** Comercio A2A · **ID:** `mcp-sla-contract-manager`

**Dolor de agente que resuelve:** El agente contrata un sub-agente 'rápido' sin SLA escrito: cuando empieza a tardar 40 segundos no hay objetivo, ni ventana de medición, ni forma objetiva de reclamar. La confianza entre agentes sin métricas es humo.

> Estado persistente en `~/.mcp-suite/sla-contract-manager/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `create_contract`
Crea un contrato SLA: proveedor, métrica, objetivo, ventana y penalización por incumplimiento.

**Parámetros:**
  - `proveedor` (string, requerido): Agente/servicio proveedor
  - `consumidor` (string, opcional): Agente consumidor
  - `metrica` (enum, requerido): Métrica contratada
  - `objetivo` (number, requerido): Valor objetivo (mejor = más rápido/más alto según métrica)
  - `ventana` (enum, requerido): Ventana de evaluación
  - `penalizacion` (string, opcional): Qué pasa si se incumple (descuento, crédito, terminación)
  - `periodo_gracia_min` (number, opcional): Minutos de gracia antes de contar un incumplimiento

### `record_measurement`
Registra una medición real de la métrica del contrato.

**Parámetros:**
  - `id` (string, requerido): Id del contrato
  - `valor` (number, requerido): Valor medido
  - `contexto` (string, opcional): Contexto (llamada, día, carga)

### `check_breach`
Evalúa el contrato contra las mediciones registradas: ¿hay brecha? ¿con gracia? ¿reclamable?

**Parámetros:**
  - `id` (string, requerido): Id del contrato

### `contract_health`
Salud global: contratos por proveedor, tendencias y quién incumple más.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "sla-contract-manager": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-sla-contract-manager/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/sla-contract-manager/. Contratos con métricas (latencia, disponibilidad, tasa de error, throughput), objetivo y penalización; las mediciones se contrastan con períodos de gracia.

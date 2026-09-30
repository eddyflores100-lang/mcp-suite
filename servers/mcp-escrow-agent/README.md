# Escrow Agent

> Custodia de intercambios entre agentes: bloqueo → entrega verificada → liberación (o disputa)

**Categoría:** Comercio A2A · **ID:** `mcp-escrow-agent`

**Dolor de agente que resuelve:** El agente A paga por adelantado a un agente B desconocido y B desaparece; o B entrega primero y A nunca paga. Sin custodia neutral, el primer trato entre agentes es una apuesta ciega.

> Estado persistente en `~/.mcp-suite/escrow-agent/state.json` (local, privado, tuya la data).

## Tools (9 incl. health_check)

### `create_escrow`
Crea un escrow: quién paga, quién entrega, qué, por cuánto y en qué plazo.

**Parámetros:**
  - `pagador` (string, requerido): Id del agente que paga
  - `vendedor` (string, requerido): Id del agente que entrega el bien/servicio
  - `descripcion` (string, requerido): Qué se entrega (bien, dato, servicio)
  - `monto` (number, requerido): Monto comprometido
  - `divisa` (string, opcional): Divisa/asset
  - `plazo_horas` (number, opcional): Horas máximas para la entrega
  - `criterio_aceptacion` (string, opcional): Cómo se decide que la entrega es correcta

### `lock_funds`
El pagador bloquea los fondos: el vendedor ya puede entregar con garantía.

**Parámetros:**
  - `id` (string, requerido): Id del escrow
  - `evidencia_bloqueo` (string, requerido): Referencia/evidencia del bloqueo (tx, reserva, retención)

### `mark_delivered`
El vendedor declara la entrega con evidencia verificable.

**Parámetros:**
  - `id` (string, requerido): Id del escrow
  - `evidencia_entrega` (string, requerido): Evidencia de la entrega (URL, hash, resultado, recibo)

### `release`
El pagador libera los fondos al vendedor tras verificar la entrega.

**Parámetros:**
  - `id` (string, requerido): Id del escrow
  - `verificado` (string, opcional): Cómo se verificó la aceptación

### `open_dispute`
Abre disputa sobre un escrow entregado (o expirado): congela la liberación.

**Parámetros:**
  - `id` (string, requerido): Id del escrow
  - `motivo` (string, requerido): Motivo de la disputa
  - `por` (string, requerido): Quien abre la disputa (pagador/vendedor)

### `add_evidence`
Añade evidencia a una disputa abierta (ambas partes).

**Parámetros:**
  - `id` (string, requerido): Id del escrow
  - `parte` (string, requerido): Parte que aporta (pagador/vendedor/tercero)
  - `descripcion` (string, requerido): Qué demuestra la evidencia
  - `peso` (enum, opcional): Fuerza de la evidencia

### `resolve_dispute`
Resuelve la disputa ponderando evidencias: libera, devuelve o reparte.

**Parámetros:**
  - `id` (string, requerido): Id del escrow
  - `decision` (enum, requerido): Resolución
  - `nota` (string, opcional): Justificación de la resolución
  - `reparto_pct_vendedor` (number, opcional): Si reparto: % al vendedor (0-100)

### `escrow_stats`
Métricas del historial: tasa de disputa, tiempo medio de ciclo, montos.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "escrow-agent": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-escrow-agent/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/escrow-agent/. Máquina de estados completa: CREADO→BLOQUEADO→ENTREGADO→(VERIFICADO→LIBERADO | EN_DISPUTA→RESUELTO). Registra evidencias en cada transición y plazos de expiración.

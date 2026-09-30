# Dispute Resolver

> Carpeta de disputas con evidencias ponderadas, posiciones enfrentadas y vías de resolución propuestas

**Categoría:** Comercio A2A · **ID:** `mcp-dispute-resolver`

**Dolor de agente que resuelve:** Cuando dos agentes discrepan (entrega mala, dato incorrecto, pago no reflejado) no hay dónde registrar la disputa con estructura: la 'resolución' es un pulso de quién insiste más, sin evidencia ni trazabilidad.

> Estado persistente en `~/.mcp-suite/dispute-resolver/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `open_case`
Abre una disputa estructurada: quién, contra quién, qué se exige y bajo qué acuerdo.

**Parámetros:**
  - `reclamante` (string, requerido): Agente que reclama
  - `reclamado` (string, requerido): Agente reclamado
  - `pretension` (string, requerido): Qué se exige exactamente (reembolso, corrección, entrega, disculpa)
  - `acuerdo_violado` (string, requerido): Acuerdo/contrato/término supuestamente incumplido
  - `monto_en_juego` (number, opcional): Valor económico implicado si aplica (0 si no)

### `add_evidence`
Añade evidencia a la disputa: qué demuestra, quién la aporta y su fuerza.

**Parámetros:**
  - `id` (string, requerido): Id de la disputa
  - `parte` (string, requerido): Parte que la aporta
  - `demuestra` (string, requerido): Qué hecho concreto demuestra
  - `tipo` (enum, requerido): Naturaleza de la evidencia
  - `peso` (enum, opcional): Fuerza probatoria

### `analyze_positions`
Analiza el equilibrio probatorio: peso por parte, hechos no disputados y qué falta demostrar.

**Parámetros:**
  - `id` (string, requerido): Id de la disputa

### `propose_resolution`
Propone la vía de cierre más eficiente según monto, equilibrio probatorio y coste de escalado.

**Parámetros:**
  - `id` (string, requerido): Id de la disputa

### `close_case`
Cierra la disputa con la resolución aplicada y lecciones extraídas.

**Parámetros:**
  - `id` (string, requerido): Id de la disputa
  - `resolucion` (string, requerido): Cómo se resolvió de verdad
  - `satisface_a` (enum, requerido): Quien queda satisfecho
  - `leccion` (string, opcional): Qué cambiar para evitar repetir esta disputa

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "dispute-resolver": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-dispute-resolver/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/dispute-resolver/. Disputas con reclamante/respondedor, pretensión, evidencias con peso, y análisis de brecha entre lo pedido y lo demostrado; propone la vía de cierre más barata.

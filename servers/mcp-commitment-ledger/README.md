# Commitment Ledger

> Libro mayor de compromisos del agente: promesas con deadline, cumplimiento y reputación

**Categoría:** Objetivos y Largo Plazo · **ID:** `mcp-commitment-ledger`

**Dolor de agente que resuelve:** Los agentes prometen ('lo envío hoy', 'lo reviso luego') y olvidan: no hay libro de compromisos, así que el incumplimiento es invisible hasta que el humano pregunta dónde está.

> Estado persistente en `~/.mcp-suite/commitment-ledger/state.json` (local, privado, tuya la data).

## Tools (7 incl. health_check)

### `make_commitment`
Registra un compromiso verificable: qué, para quién, cuándo y con qué criterio de cumplimiento.

**Parámetros:**
  - `que` (string, requerido): Qué se promete (accionable)
  - `para_quien` (string, requerido): Beneficiario (humano o agente)
  - `deadline` (string, requerido): Fecha ISO o relativa (en 2h, mañana, 2026-12-01)
  - `prioridad` (enum, opcional): Prioridad
  - `criterio` (string, opcional): Cómo se sabrá que se cumplió

### `list_commitments`
Lista compromisos abiertos ordenados por deadline con riesgo de vencimiento inminente.

**Parámetros:**
  - `solo_abiertos` (boolean, opcional): Solo pendientes
  - `para_quien` (string, opcional): Filtrar por beneficiario

### `fulfill`
Marca un compromiso como cumplido con evidencia; alimenta el score de reputación.

**Parámetros:**
  - `compromiso_id` (string, requerido): ID del compromiso
  - `evidencia` (string, opcional): Cómo se cumplió

### `renegotiate`
Renegocia un compromiso a punto de vencer: nuevo deadline con motivo (queda auditado).

**Parámetros:**
  - `compromiso_id` (string, requerido): ID del compromiso
  - `nuevo_deadline` (string, requerido): Nuevo plazo (ISO o 'en Xh')
  - `motivo` (string, requerido): Por qué se renegocia

### `reputation`
Score de cumplimiento: tasa a tiempo, tardíos medios y patrón de renegociación.

### `load_forecast`
Proyección de carga por semana según compromisos abiertos: detecta semanas saturadas.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "commitment-ledger": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-commitment-ledger/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/commitment-ledger/. Compromisos con deadline, prioridad y beneficiario; alerta de vencidos, reputación de cumplimiento y carga futura por semana.

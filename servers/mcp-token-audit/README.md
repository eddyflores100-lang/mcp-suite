# Token Audit

> Auditoría de a dónde van los tokens: qué consumió el contexto, la retrieval y las tools

**Categoría:** Economía del Agente · **ID:** `mcp-token-audit`

**Dolor de agente que resuelve:** El 60-70% de los tokens se gastan en cosas que no aportan: historial rancio, retrieval excesiva, salidas de tools gigantes. Sin auditoría por partida, no hay forma de recortar con criterio.

> Estado persistente en `~/.mcp-suite/token-audit/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `log_usage`
Registra el consumo de tokens de una interacción, desglosado por partida.

**Parámetros:**
  - `interaccion` (string, requerido): ID o descripción de la interacción
  - `system` (number, opcional): Tokens de system prompt
  - `historial` (number, opcional): Tokens de historial/conversación
  - `retrieval` (number, opcional): Tokens de contexto recuperado
  - `tools_entrada` (number, opcional): Tokens de resultados de tools hacia el modelo
  - `output` (number, opcional): Tokens generados
  - `overhead` (number, opcional): Otros (formato, fences...)

### `audit_report`
Reporte de reparto agregado: % medio por partida y tendencias (¿el historial crece sin control?).

### `outlier_interactions`
Detecta interacciones anómalamente caras (muchos más tokens que la media) para autopsiarlas.

### `simulate_cut`
Simula el ahorro de recortar una partida a un % objetivo antes de aplicarlo.

**Parámetros:**
  - `partida` (enum, requerido): Partida a recortar
  - `objetivo_pct` (number, requerido): % del total al que quieres llevarla

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "token-audit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-token-audit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/token-audit/. Partidas configurables (system, historial, retrieval, tools, output, overhead) con registro por interacción y reparto porcentual del gasto.

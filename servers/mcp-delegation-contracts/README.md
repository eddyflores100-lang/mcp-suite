# Delegation Contracts

> Contratos verificables de delegación entre agentes: objetivo, criterios, presupuesto y veredicto

**Categoría:** Multi-Agente y Coordinación · **ID:** `mcp-delegation-contracts`

**Dolor de agente que resuelve:** La delegación entre agentes es un 'ahí te va esto' sin criterios verificables: el sub-agente devuelve lo que interpreta, el delegador no puede aceptar/rechazar con evidencia y no hay historial de rework.

> Estado persistente en `~/.mcp-suite/delegation-contracts/state.json` (local, privado, tuya la data).

## Tools (9 incl. health_check)

### `create_contract`
Crea un contrato de delegación: objetivo medible, criterios de aceptación, presupuesto de tokens, deadline y penalización por rework.

**Parámetros:**
  - `delegador` (string, requerido): Agent_id que delega
  - `delegado` (string, requerido): Agent_id que ejecuta
  - `objetivo` (string, requerido): Objetivo del encargo, verificable
  - `criterios_aceptacion` (array, requerido): Lista de criterios verificables de aceptación
  - `presupuesto_tokens` (number, opcional): Presupuesto máximo de tokens
  - `deadline_horas` (number, opcional): Plazo en horas desde ahora
  - `contexto` (string, opcional): Contexto esencial para el delegado

### `get_contract`
Contrato completo con entregas, revisiones y evaluación de vencimiento.

**Parámetros:**
  - `contrato_id` (string, requerido): ID del contrato

### `list_contracts`
Lista contratos con filtro por estado, delegado o delegador.

**Parámetros:**
  - `estado` (string, opcional): abierto, entregado, aprobado, rechazado, rework, escalado, vencido
  - `delegado` (string, opcional): Filtrar por agente ejecutor
  - `delegador` (string, opcional): Filtrar por agente delegante

### `submit_deliverable`
El delegado entrega: resumen del resultado, evidencia por criterio y tokens consumidos.

**Parámetros:**
  - `contrato_id` (string, requerido): ID del contrato
  - `resumen` (string, requerido): Resumen del trabajo realizado
  - `evidencias` (array, requerido): Evidencias alineadas a los criterios (texto)
  - `tokens_usados` (number, opcional): Tokens consumidos

### `review`
El delegador revisa la última entrega: marca cada criterio cumplido/no e imprime veredicto (aprobado, rework o rechazado).

**Parámetros:**
  - `contrato_id` (string, requerido): ID del contrato
  - `criterios_cumplidos` (array, requerido): Números de criterios cumplidos (ej: [1,2,4])
  - `veredicto` (enum, requerido): Veredicto final
  - `notas` (string, opcional): Notas del revisor

### `escalate_contract`
Escala un contrato atascado (rework repetido, deadline vencido, presupuesto excedido) al supervisor con contexto.

**Parámetros:**
  - `contrato_id` (string, requerido): ID del contrato
  - `razon` (string, requerido): Motivo del escalamiento
  - `hacia` (string, opcional): Agent_id o 'humano' del destinatario

### `contract_stats`
Estadísticas de delegación: tasa de aprobación, rework medio, escalaciones y desviación de presupuesto.

### `amend_contract`
Enmienda un contrato abierto: ajusta criterios, presupuesto o deadline dejando auditoría del cambio.

**Parámetros:**
  - `contrato_id` (string, requerido): ID del contrato
  - `criterios_extra` (array, opcional): Criterios nuevos a añadir
  - `presupuesto_tokens` (number, opcional): Nuevo presupuesto
  - `deadline_horas` (number, opcional): Nuevo plazo en horas desde ahora
  - `motivo` (string, requerido): Motivo de la enmienda

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "delegation-contracts": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-delegation-contracts/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/delegation-contracts/. Ciclo: create → submit_deliverable → review (aprobado/rechazado/rework) con presupuesto de tokens y deadline. Estadísticas de éxito y rework.

# Goal Contract

> Objetivos con criterios de éxito inmutables: el north star que no se reescribe en mitad de la misión

**Categoría:** Objetivos y Largo Plazo · **ID:** `mcp-goal-contract`

**Dolor de agente que resuelve:** En misiones largas el agente reescribe mentalmente el objetivo cada día ('goal drift'): termina resolviendo un problema distinto y nadie lo nota porque el objetivo original ya nadie lo recuerda.

> Estado persistente en `~/.mcp-suite/goal-contract/state.json` (local, privado, tuya la data).

## Tools (8 incl. health_check)

### `declare_goal`
Declara el contrato de objetivo: enunciado, criterios de éxito verificables y restricciones. Inmutable tras la creación.

**Parámetros:**
  - `enunciado` (string, requerido): El objetivo en una frase verificable
  - `criterios_exito` (array, requerido): Condiciones objetivas de éxito
  - `restricciones` (array, opcional): Lo que NO se debe hacer
  - `horizonte_dias` (number, opcional): Plazo esperado en días

### `get_goal`
Recupera el objetivo activo completo: criterios, cumplimiento y enmiendas acumuladas.

### `measure`
Registra una medición de un criterio (cumplido o no, con evidencia) sin alterar el contrato.

**Parámetros:**
  - `n` (number, requerido): Número del criterio a medir
  - `cumplido` (boolean, requerido): ¿Se cumple?
  - `evidencia` (string, opcional): Evidencia o cómo se verificó

### `amend_goal`
Enmienda VISIBLE del objetivo (nuevos criterios o restricciones) con motivo y fecha: nunca reescritura silenciosa.

**Parámetros:**
  - `criterios_extra` (array, opcional): Criterios nuevos
  - `restricciones_extra` (array, opcional): Restricciones nuevas
  - `motivo` (string, requerido): Por qué se enmienda el objetivo

### `check_alignment`
Verifica que una acción o sub-objetivo propuesto sigue alineado con el contrato activo (anti-drift).

**Parámetros:**
  - `propuesta` (string, requerido): Acción o sub-objetivo a evaluar

### `close_goal`
Cierra el objetivo con veredicto (logrado, parcial, abandonado) y balance de enmiendas/mediciones.

**Parámetros:**
  - `veredicto` (enum, requerido): Resultado final
  - `notas` (string, opcional): Cierre narrativo

### `goal_history`
Historial de objetivos cerrados: duración, tasa de logro y patrón de abandono.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "goal-contract": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-goal-contract/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/goal-contract/. El objetivo se declara UNA vez con criterios inmutables; después solo se puede consultar, medir o cerrar. Toda 'modificación' queda como enmienda visible, nunca como reescritura silenciosa.

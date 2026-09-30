# Scenario Simulator

> Simula escenarios de estrés para el agente: pruébalo contra edge cases antes de producción, sin costo real

**Categoría:** Evaluación Continua · **ID:** `mcp-scenario-simulator`

**Dolor de agente que resuelve:** El agente se prueba solo en el happy path: los edge cases (datos corruptos, usuario hostil, API caída, idioma raro) se descubren con clientes reales dentro.

> Estado persistente en `~/.mcp-suite/scenario-simulator/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `list_categories`
Biblioteca de categorías de escenarios de estrés con ejemplos generadores.

### `add_scenario`
Añade un escenario propio con entrada, comportamiento esperado y criterio de aprobación.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del escenario
  - `categoria` (string, requerido): Categoría (entrada_hostil, datos_malformados...)
  - `entrada` (string, requerido): Entrada que simular
  - `comportamiento_esperado` (string, requerido): Cómo debe reaccionar el agente
  - `criterio_aprobacion` (string, requerido): Condición verificable de éxito

### `run_scenario`
Registra el resultado del agente ante un escenario: ¿sobrevivió, se degradó con elegancia o falló feo?

**Parámetros:**
  - `nombre` (string, requerido): Nombre del escenario
  - `salida_agente` (string, requerido): Respuesta/acción del agente
  - `outcome` (enum, requerido): Resultado observado
  - `notas` (string, opcional): Detalles del comportamiento

### `robustness_score`
Score de robustez global por categoría: % de escenarios aprobados y los más débiles.

### `stress_plan`
Genera un plan de estrés priorizado: qué correr primero según riesgo y cobertura actual.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "scenario-simulator": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-scenario-simulator/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/scenario-simulator/. Biblioteca de escenarios de estrés por categoría (entrada hostil, datos malformados, ambigüedad, recursos agotados) + ejecución con puntuación de robustez.

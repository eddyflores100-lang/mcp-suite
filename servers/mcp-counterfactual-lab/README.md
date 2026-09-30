# Counterfactual Lab

> Laboratorio de contrafactuales: cambia UNA variable del pasado y compara mundos con el conjunto mínimo de cambios

**Categoría:** Razonamiento · **ID:** `mcp-counterfactual-lab`

**Dolor de agente que resuelve:** El agente razona 'si hubiéramos hecho X habría pasado Y' por pura narrativa: cambia cinco cosas a la vez, atribuye el resultado a la que le conviene y la lección aprendida es ficción retrospectiva.

> Estado persistente en `~/.mcp-suite/counterfactual-lab/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `register_facts`
Registra la línea de hechos del mundo real (secuencia causal).

**Parámetros:**
  - `escenario` (string, requerido): Nombre del escenario a estudiar
  - `hechos` (array, requerido): Hechos en orden {que_paso, causa?, efecto?}

### `run_counterfactual`
Cambia hechos desde un punto y calcula el conjunto mínimo de consecuencias que se alteran.

**Parámetros:**
  - `escenario` (string, requerido): Escenario base
  - `desde_hecho` (number, requerido): Número de hecho donde se inyecta el cambio
  - `cambio` (string, requerido): Qué pasa distinto a partir de ahí

### `compare_worlds`
Compara mundo real vs contrafactual: qué cambia, qué permanece y dónde diverge la narrativa.

**Parámetros:**
  - `escenario` (string, requerido): Escenario
  - `contrafactual` (string, requerido): Contrafactual registrado
  - `hechos_alternativos` (array, requerido): Hechos reescritos del mundo contrafactual {idx, que_paso}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "counterfactual-lab": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-counterfactual-lab/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/counterfactual-lab/. Registra hechos del mundo real; cada contrafactual cambia el mínimo conjunto de variables (ceteris paribus); compara consecuencias propagadas y mide la distancia entre mundos.

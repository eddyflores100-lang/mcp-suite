# Occam Razor

> Navaja de Occam cuantificada: hipótesis con entidades, supuestos y ajuste a evidencia — simplicidad que gana solo si empata

**Categoría:** Razonamiento · **ID:** `mcp-occam-razor`

**Dolor de agente que resuelve:** El agente prefiere la hipótesis más elaborada porque 'explica más': sin contar entidades ni supuestos, la complejidad extra parece virtud y no coste. La navaja sin números corta al azar.

> Estado persistente en `~/.mcp-suite/occam-razor/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `add_hypothesis`
Añade una hipótesis con sus entidades y supuestos independientes.

**Parámetros:**
  - `problema` (string, requerido): Problema a explicar
  - `hipotesis` (string, requerido): Enunciado de la hipótesis
  - `entidades` (array, requerido): Entidades/agentes/cosas que la hipótesis introduce
  - `supuestos` (array, requerido): Supuestos independientes que da por ciertos (cada uno puede fallar solo)

### `rate_fit`
Califica qué tan bien la hipótesis explica la evidencia observada (0 a 1).

**Parámetros:**
  - `problema` (string, requerido): Problema
  - `hipotesis` (string, requerido): Hipótesis
  - `ajuste` (number, requerido): Ajuste a la evidencia 0-1 (1 = lo explica todo sin residuos)
  - `evidencia_cubierta` (string, opcional): Qué evidencia cubre y cuál no

### `rank`
Ranking por navaja: penaliza complejidad y solo gana la simple si empata en ajuste.

**Parámetros:**
  - `problema` (string, requerido): Problema

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "occam-razor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-occam-razor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/occam-razor/. Hipótesis con lista de entidades y supuestos independientes + ajuste a la evidencia (0-1); penalización logarítmica por complejidad; recomendación con análisis de empate técnico.

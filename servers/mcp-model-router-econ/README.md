# Model Router Econ

> Rutea cada sub-tarea al modelo más barato capaz: stop usando un tanque para mandar un email

**Categoría:** Economía del Agente · **ID:** `mcp-model-router-econ`

**Dolor de agente que resuelve:** El agente usa el modelo más caro para TODO: clasificar un email, sumar dos números o redactar una nota usan el mismo modelo premium. El ruteo por complejidad ahorra 50-80% y nadie lo implementa.

> Estado persistente en `~/.mcp-suite/model-router-econ/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `register_model`
Registra un modelo con costos por 1M tokens (entrada/salida) y tier de capacidad (1=básico, 4=frontier).

**Parámetros:**
  - `modelo` (string, requerido): Nombre del modelo
  - `costo_entrada_1m` (number, requerido): USD por 1M tokens de entrada
  - `costo_salida_1m` (number, requerido): USD por 1M tokens de salida
  - `tier` (number, requerido): Capacidad: 1 básico, 2 estándar, 3 avanzado, 4 frontier
  - `fortalezas` (array, opcional): Etiquetas de fortaleza

### `route`
Dada una tarea, clasifica su tier requerido y devuelve el modelo más barato que lo cubre (con costo estimado).

**Parámetros:**
  - `tarea` (string, requerido): Descripción de la sub-tarea
  - `tokens_estimados` (number, opcional): Tokens totales estimados
  - `forzar_tier` (number, opcional): Tier mínimo requerido manual

### `routing_stats`
Estadísticas de ruteo: uso por modelo, tier medio demandado y ahorro acumulado estimado.

### `list_models`
Lista modelos registrados con costos y fortalezas, ordenados por costo.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "model-router-econ": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-model-router-econ/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/model-router-econ/. Registro de modelos con costo por 1M tokens y capacidades; clasifica tareas por tier de complejidad y devuelve el modelo más barato suficiente. Historial de decisiones.

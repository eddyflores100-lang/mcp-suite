# Capability Gap Scanner

> Lo que la tarea EXIGE vs lo que el agente TIENE: gaps de capacidad concretos antes de fallar en producción

**Categoría:** Auto-Mejora · **ID:** `mcp-capability-gap-scanner`

**Dolor de agente que resuelve:** El agente descubre que no puede leer PDFs... a mitad de la tarea, cuando ya gastó la mitad del contexto. Nadie compara las demandas de la tarea con el inventario real de capacidades ANTES de empezar.

> Estado persistente en `~/.mcp-suite/capability-gap-scanner/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `declare_demands`
Declara qué capacidades exige la tarea entrante.

**Parámetros:**
  - `tarea` (string, requerido): Tarea a evaluar
  - `demandas` (array, requerido): Capacidades requeridas {capacidad, criticidad: alta|media|baja}

### `declare_inventory`
Declara el inventario de capacidades que realmente tienes (tools, skills, accesos).

**Parámetros:**
  - `capacidades` (array, requerido): Capacidades disponibles {capacidad, tipo: tool|skill|acceso|humano, nota?}

### `scan_gaps`
Escanea los gaps: demandas sin cobertura, con severidad y recomendación.

**Parámetros:**
  - `tarea` (string, requerido): Tarea a escanear

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "capability-gap-scanner": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-capability-gap-scanner/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/capability-gap-scanner/. Demandas declaradas de la tarea vs inventario de capacidades del agente; cobertura, gaps críticos y recomendaciones de adquisición (tool nueva, skill, humano).

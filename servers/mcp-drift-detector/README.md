# Drift Detector

> Detecta cuándo el trabajo del agente se desvió del objetivo original (score de deriva por decisión)

**Categoría:** Objetivos y Largo Plazo · **ID:** `mcp-drift-detector`

**Dolor de agente que resuelve:** El drift es incremental e invisible: cada decisión parece razonable localmente, pero a las 40 decisiones el agente trabaja en algo distinto al encargo original y nadie supo cuándo torció.

> Estado persistente en `~/.mcp-suite/drift-detector/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `set_reference`
Fija la referencia contra la que se mide toda deriva (encargo original, literal).

**Parámetros:**
  - `encargo` (string, requerido): Texto literal del encargo original
  - `restricciones` (array, opcional): Límites originales

### `log_decision`
Registra una decisión del agente con justificación; devuelve la deriva individual frente al encargo.

**Parámetros:**
  - `decision` (string, requerido): Qué se decidió hacer
  - `justificacion` (string, requerido): Por qué (debería citar el encargo)
  - `etiqueta` (string, opcional): Etiqueta de fase (ej: research, build)

### `drift_report`
Reporte de deriva acumulada: tendencia por ventana de 5 decisiones, punto de inflexión y fase donde torció.

### `re_anchor`
Re-ancla al agente: devuelve el encargo literal + las últimas decisiones desviadas + plantilla de corrección.

### `drift_stats`
Estadísticas históricas de deriva por fase/etiqueta: dónde tiende a torcer este agente.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "drift-detector": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-drift-detector/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/drift-detector/. Registra decisiones con su justificación y calcula deriva acumulada: distancia semántica lexical vs objetivo + cadena de 'por qué' (justificación que ya no cita el objetivo).

# Trust Calibrator

> Calibra la confianza humano→agente por dominio: dónde te dejan solo y dónde exigen revisión

**Categoría:** Humano en el Bucle · **ID:** `mcp-trust-calibrator`

**Dolor de agente que resuelve:** La confianza es global, no calibrada: el humano revisa todo lo que el agente ya domina (desperdicio) O deja pasar lo que el agente still rompe (desastre). Falta trust por dominio con evidencia.

> Estado persistente en `~/.mcp-suite/trust-calibrator/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `set_trust`
Establece el nivel de confianza del humano en un dominio (0=ninguna, 4=autonomía total) con justificación.

**Parámetros:**
  - `dominio` (string, requerido): Dominio de trabajo (ej: sql, redaccion, pagos)
  - `nivel` (number, requerido): 0-4: 0 revisar todo, 1 asistir, 2 proponer, 3 ejecutar e informar, 4 autónomo
  - `justificacion` (string, requerido): Por qué este nivel

### `record_outcome`
Registra un acierto o fallo del agente en el dominio: alimenta la recalibración.

**Parámetros:**
  - `dominio` (string, requerido): Dominio
  - `exito` (boolean, requerido): ¿Salió bien sin intervención?
  - `detalle` (string, opcional): Qué pasó

### `recalibrate`
Recomienda ajustar el nivel de trust según la evidencia acumulada (con histórico de ajustes).

### `trust_map`
Mapa de confianza completo: qué puede hacer solo el agente hoy, resumido.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "trust-calibrator": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-trust-calibrator/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/trust-calibrator/. Nivel de confianza por dominio (0-4) con historial de aciertos/errores que lo justifica; recomienda subir/bajar el nivel según evidencia reciente.

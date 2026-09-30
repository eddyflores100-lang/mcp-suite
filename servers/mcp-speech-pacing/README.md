# Speech Pacing

> Planifica el ritmo del habla del agente: pausas donde hay ideas, énfasis en los datos y velocidad por complejidad

**Categoría:** Multimodal & Voz · **ID:** `mcp-speech-pacing`

**Dolor de agente que resuelve:** El agente lee a velocidad uniforme: dispara las cifras críticas, no pausa entre ideas opuestas y el usuario no retiene nada. El pacing no es un extra de TTS: es la mitad de la comprensión oral.

> Estado persistente en `~/.mcp-suite/speech-pacing/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `analyze_text`
Analiza el texto a hablar: densidad de datos, complejidad y puntos naturales de pausa.

**Parámetros:**
  - `texto` (string, requerido): Texto que el agente va a decir

### `plan_pacing`
Genera el plan de ritmo: pausas (break SSML), velocidad y énfasis por segmento.

**Parámetros:**
  - `texto` (string, requerido): Texto a decir
  - `velocidad_base` (number, opcional): Velocidad base (1.0 = normal)

### `ssml_hints`
Convierte el plan en pistas SSML concretas (breaks, prosody, emphasis) para tu motor TTS.

**Parámetros:**
  - `texto` (string, requerido): Texto a decir

### `estimate_duration`
Estima duración del habla con velocidad y pausas planificadas (para timeouts y UX).

**Parámetros:**
  - `texto` (string, requerido): Texto
  - `velocidad` (number, opcional): Velocidad (1 = normal)
  - `incluir_pausas` (boolean, opcional): Sumar las pausas estructurales

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "speech-pacing": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-speech-pacing/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/speech-pacing/. Analiza el texto (densidad de cifras, longitud de cláusulas, contraste de ideas) y produce un plan de pausas con puntos SSML (break strengths) y velocidad por segmento.

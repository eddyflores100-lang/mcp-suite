# Caption Aligner

> Alinea transcripción y subtítulos por tiempo: cobertura, solapes y huecos detectados antes de confiar en ellos

**Categoría:** Multimodal & Voz · **ID:** `mcp-caption-aligner`

**Dolor de agente que resuelve:** El transcript dice 'a las 14:30' y el caption correspondiente empieza 40 segundos tarde: el agente cita minutos exactos de un material desalineado y la referencia temporal es pura ficción.

> Estado persistente en `~/.mcp-suite/caption-aligner/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `ingest_segments`
Ingiere los segmentos de subtítulo con sus tiempos.

**Parámetros:**
  - `material` (string, requerido): Nombre del material (video/clase/reunión)
  - `segmentos` (array, requerido): Segmentos {start: segundos, end: segundos, texto}
  - `duracion_total_seg` (number, opcional): Duración del material

### `coverage_check`
Cobertura temporal: qué zonas del material no tienen caption (huecos) y cuánto duran.

**Parámetros:**
  - `material` (string, requerido): Material

### `align_transcript`
Alinea oraciones del transcript con los segmentos por similitud textual y devuelve el mapeo con confianza.

**Parámetros:**
  - `material` (string, requerido): Material
  - `oraciones` (array, requerido): Oraciones del transcript (texto, en orden)

### `suggest_offset`
Si todo alinea pero desplazado constante, calcula el offset de corrección por puntos de anclaje.

**Parámetros:**
  - `material` (string, requerido): Material
  - `anclajes` (array, requerido): Puntos verificados {texto_cita, tiempo_real_seg}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "caption-aligner": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-caption-aligner/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/caption-aligner/. Ingiere segmentos de subtítulo (start/end/texto) y oraciones del transcript; calcula solapes, huecos de cobertura y deriva acumulada; propone offsets de corrección.

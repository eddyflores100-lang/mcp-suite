# Transcript Condenser

> Condensa transcripciones de voz interminables: conserva decisiones, acciones y compromisos; tira la paja

**Categoría:** Multimodal & Voz · **ID:** `mcp-transcript-condenser`

**Dolor de agente que resuelve:** Una reunión de 90 minutos genera 12.000 tokens de transcript con 'eh', saludos y divagaciones: el agente lo traga entero, infla el contexto y aún así se le escapa el único compromiso que se tomó.

> Estado persistente en `~/.mcp-suite/transcript-condenser/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `ingest_transcript`
Ingiere un transcript con hablantes y segmentos temporales.

**Parámetros:**
  - `sesion` (string, requerido): Nombre de la sesión/reunión
  - `segmentos` (array, requerido): Segmentos {hablante, texto, ts?}

### `condense`
Condensa el transcript: clasifica cada segmento y conserva textualmente solo lo accionable.

**Parámetros:**
  - `sesion` (string, requerido): Sesión a condensar

### `extract_action_items`
Extrae la lista de acciones con responsable inferido y plazo si se menciona.

**Parámetros:**
  - `sesion` (string, requerido): Sesión condensada

### `speaker_stats`
Estadísticas de participación: quién habló más, quién decidió más, quién calló.

**Parámetros:**
  - `sesion` (string, requerido): Sesión

### `get_original`
Recupera los segmentos originales de contexto descartados en la condensación (nada se pierde).

**Parámetros:**
  - `sesion` (string, requerido): Sesión
  - `desde_indice` (number, opcional): Índice de segmento inicial
  - `cantidad` (number, opcional): Cuántos segmentos

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "transcript-condenser": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-transcript-condenser/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/transcript-condenser/. Clasifica segmentos (decisión/acción/compromiso/pregunta/contexto/ruido) con heurísticas lingüísticas; condensa manteniendo íntegro lo accionable y resume el resto.

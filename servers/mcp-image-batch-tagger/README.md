# Image Batch Tagger

> Metadatos obligatorios para lotes de imágenes: procedencia, contenido, frescura y decisión de uso

**Categoría:** Multimodal & Voz · **ID:** `mcp-image-batch-tagger`

**Dolor de agente que resuelve:** El agente recibe 20 imágenes sueltas sin origen ni fecha: las mete todas al contexto, mezcla capturas de hace un año con las de hoy y no puede justificar de dónde salió la que citó después.

> Estado persistente en `~/.mcp-suite/image-batch-tagger/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `register_batch`
Registra un lote de imágenes con metadatos mínimos por imagen.

**Parámetros:**
  - `lote` (string, requerido): Nombre del lote
  - `origen` (string, requerido): Procedencia (URL, app, usuario, carpeta)
  - `imagenes` (array, requerido): Imágenes {id, contenido?: descripción corta, tomada_ts?: fecha}

### `tag_images`
Etiqueta imágenes del lote (contenido, sensibilidad, idoneidad de uso).

**Parámetros:**
  - `lote` (string, requerido): Lote
  - `tags` (array, requerido): Etiquetas a aplicar {id, contenido?, sensibilidad?: publica|interna|confidencial, apta_para?: contexto}

### `select_by_tag`
Selecciona imágenes del lote por etiquetas y frescura para adjuntar al contexto.

**Parámetros:**
  - `lote` (string, requerido): Lote
  - `requerir_contenido` (string, opcional): Filtrar por texto en contenido
  - `max_frescura_dias` (number, opcional): Antigüedad máxima aceptable (0 = sin límite)
  - `excluir_sensibilidad` (array, opcional): Sensibilidades a excluir

### `batch_report`
Informe del lote: cobertura de metadatos, frescura y qué se ha usado ya en contexto.

**Parámetros:**
  - `lote` (string, requerido): Lote

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "image-batch-tagger": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-image-batch-tagger/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/image-batch-tagger/. Registro de lotes con metadatos por imagen (origen, fecha, contenido inferido, sensibilidad); selección por etiquetas y control de frescura antes de adjuntar al contexto.

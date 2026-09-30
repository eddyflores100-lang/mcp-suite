# PDF Text Extractor

> Extrae texto de PDFs localmente: streams zlib + operadores Tj/TJ, sin dependencias

**Categoría:** Datos y Extracción · **ID:** `mcp-pdf-text-extractor`

**Dolor de agente que resuelve:** Los PDFs son ilegibles para agentes: los extractores requieren binarios pesados. Aquí: parser PDF puro en Node.

## Tools (3 incl. health_check)

### `extract`
Extrae texto de un PDF: descomprime streams FlateDecode (zlib), interpreta operadores de texto Tj/TJ/'/" y decodifica hex strings. Funciona con PDFs de texto (no escaneados).

**Parámetros:**
  - `pdf_base64` (string, requerido): PDF en base64

### `metadata`
Extrae metadatos del PDF: versión, título, autor, fechas y productor desde el dictionary y XMP.

**Parámetros:**
  - `pdf_base64` (string, requerido): PDF en base64

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "pdf-text-extractor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-pdf-text-extractor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

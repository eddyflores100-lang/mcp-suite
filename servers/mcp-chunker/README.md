# Chunker

> Trocea texto para RAG: chunks por oraciones/superposiciones con presupuesto de tokens

**Categoría:** Datos y Extracción · **ID:** `mcp-chunker`

**Dolor de agente que resuelve:** El RAG casero trocea mal (corta oraciones, tamaños desiguales): la calidad de recuperación se hunde.

## Tools (3 incl. health_check)

### `chunk_text`
Trocea texto en chunks de presupuesto de tokens: respeta oraciones, superposición configurable y mínimo por chunk.

**Parámetros:**
  - `texto` (string, requerido): Texto a trocear
  - `max_tokens` (number, opcional): Tokens por chunk
  - `overlap_oraciones` (number, opcional): Oraciones solapadas entre chunks

### `chunk_stats`
Estadísticas de una lista de chunks: tamaños, desviación y cobertura con overlap (para tunear el chunking).

**Parámetros:**
  - `chunks` (array, requerido): Lista de chunks (strings u objetos con texto)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "chunker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-chunker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

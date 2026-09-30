# Markdown Toolkit

> TOC, encabezados, enlaces y lint de Markdown

**Categoría:** Datos y Extracción · **ID:** `mcp-markdown-toolkit`

**Dolor de agente que resuelve:** Documentos markdown desordenados: sin TOC ni lint, la doc del agente degrada rápido.

## Tools (4 incl. health_check)

### `toc`
Genera la tabla de contenidos de un markdown: encabezados anidados con anchors válidos.

**Parámetros:**
  - `markdown` (string, requerido): Markdown
  - `max_nivel` (number, opcional): Profundidad máxima

### `structure`
Analiza la estructura de un markdown: encabezados por nivel, enlaces, imágenes, bloques de código y conteo de palabras por sección.

**Parámetros:**
  - `markdown` (string, requerido): Markdown

### `extract_links`
Extrae todos los enlaces {texto, url} de un markdown, detectando duplicados y anchors internos.

**Parámetros:**
  - `markdown` (string, requerido): Markdown

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "markdown-toolkit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-markdown-toolkit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

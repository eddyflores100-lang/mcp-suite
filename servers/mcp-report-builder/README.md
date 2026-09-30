# Report Builder

> Construye reportes markdown sección a sección con control de completitud

**Categoría:** Comunicación y Humano · **ID:** `mcp-report-builder`

**Dolor de agente que resuelve:** Los reportes del agente son un muro de texto: sin estructura por secciones ni checklist de completitud.

> Estado persistente en `~/.mcp-suite/report-builder/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `add_section`
Añade una sección al reporte activo: título y contenido markdown.

**Parámetros:**
  - `reporte` (string, requerido): Nombre del reporte
  - `titulo` (string, requerido): Título de la sección
  - `contenido` (string, requerido): Contenido markdown

### `render`
Renderiza el reporte completo a markdown: TOC + secciones + checklist de calidad.

**Parámetros:**
  - `reporte` (string, requerido): Reporte a renderizar

### `outline_check`
Verifica que el reporte cubra el esqueleto estándar ejecutivo: contexto, hallazgos, cifras, riesgos y acción.

**Parámetros:**
  - `reporte` (string, requerido): Reporte a chequear

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "report-builder": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-report-builder/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

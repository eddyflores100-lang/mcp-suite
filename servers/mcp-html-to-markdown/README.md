# HTML to Markdown

> Convierte HTML a Markdown limpio: sin scripts, sin estilos, enlaces intactos

**Categoría:** Datos y Extracción · **ID:** `mcp-html-to-markdown`

**Dolor de agente que resuelve:** El HTML crudo infla el contexto 10x: el agente necesita markdown limpio para leer la web eficientemente.

## Tools (3 incl. health_check)

### `convert`
Convierte HTML a Markdown: elimina scripts/styles/navs, preserva encabezados, listas, enlaces, tablas simples, negrita/cursiva y código.

**Parámetros:**
  - `html` (string, requerido): HTML a convertir

### `strip_tags`
Versión rápida: solo texto plano sin conversión a markdown (máximo rendimiento).

**Parámetros:**
  - `html` (string, requerido): HTML a limpiar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "html-to-markdown": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-html-to-markdown/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

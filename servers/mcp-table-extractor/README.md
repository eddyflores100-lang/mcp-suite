# Table Extractor

> Tablas HTML → JSON/CSV/Markdown estructurado

**Categoría:** Datos y Extracción · **ID:** `mcp-table-extractor`

**Dolor de agente que resuelve:** Las tablas HTML llegan como sopa de tags: el agente necesita filas/columnas estructuradas.

## Tools (4 incl. health_check)

### `extract_tables`
Extrae TODAS las tablas de un HTML: cada una como {headers, rows}. Detecta th/td y colspan simple.

**Parámetros:**
  - `html` (string, requerido): HTML con tablas

### `to_csv`
Convierte una tabla {headers, rows} a CSV bien citado.

**Parámetros:**
  - `tabla` (any, requerido): {headers, rows}

### `to_markdown`
Convierte una tabla {headers, rows} a tabla Markdown.

**Parámetros:**
  - `tabla` (any, requerido): {headers, rows}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "table-extractor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-table-extractor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

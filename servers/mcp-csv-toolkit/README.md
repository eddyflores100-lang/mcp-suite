# CSV Toolkit

> Parse, filtra y resume CSVs sin Excel: separador auto-detectado

**Categoría:** Datos y Extracción · **ID:** `mcp-csv-toolkit`

**Dolor de agente que resuelve:** Los datasets llegan en CSV con separadores mixtos y comillas rotas: el agente necesita parseo robusto local.

## Tools (4 incl. health_check)

### `parse`
Parsea CSV con detección automática de separador (, ; tab |), comillas correctas y filas de encabezado.

**Parámetros:**
  - `csv` (string, requerido): Contenido CSV
  - `tiene_headers` (boolean, opcional): Primera fila son headers

### `filter_rows`
Filtra filas de un CSV ya parseado {headers, rows} por condición simple (columna operador valor).

**Parámetros:**
  - `tabla` (any, requerido): {headers, rows}
  - `columna` (string, requerido): Columna a filtrar
  - `operador` (enum, requerido): Operador
  - `valor` (string, requerido): Valor de comparación

### `summarize_columns`
Resume columnas numéricas (min, max, media, suma) y categóricas (valores únicos top) de una tabla.

**Parámetros:**
  - `tabla` (any, requerido): {headers, rows}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "csv-toolkit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-csv-toolkit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

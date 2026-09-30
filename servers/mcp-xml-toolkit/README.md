# XML Toolkit

> Parse XML/RSS a JSON plano y busca tags con atributos

**Categoría:** Datos y Extracción · **ID:** `mcp-xml-toolkit`

**Dolor de agente que resuelve:** RSS y sitemaps siguen siendo XML: sin parser, el agente pierde feeds enteros de información.

## Tools (3 incl. health_check)

### `to_json`
Convierte XML a JSON anidado: elementos con atributos (@attr), texto (#text) e hijos repetidos como arrays.

**Parámetros:**
  - `xml` (string, requerido): XML a convertir

### `find_tags`
Encuentra todas las ocurrencias de un tag (ej: item, loc, entry) con sus atributos y texto interno.

**Parámetros:**
  - `xml` (string, requerido): XML
  - `tag` (string, requerido): Tag a buscar (ej: item)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "xml-toolkit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-xml-toolkit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

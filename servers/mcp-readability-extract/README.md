# Readability Extract

> Extrae el contenido principal de una página: título, artículo y metadatos

**Categoría:** Datos y Extracción · **ID:** `mcp-readability-extract`

**Dolor de agente que resuelve:** Del HTML de una noticia el 80% es chrome (menus, footers, ads): leer sin extraer el main quema contexto.

## Tools (3 incl. health_check)

### `extract`
Heurística de legibilidad: detecta el bloque con más densidad de texto (article/main/role) y devuelve título + texto del artículo + metadatos.

**Parámetros:**
  - `html` (string, requerido): HTML de la página

### `excerpt`
Devuelve un excerpt de N palabras del contenido principal + keywords para decidir si leer más.

**Parámetros:**
  - `html` (string, requerido): HTML
  - `palabras` (number, opcional): Palabras del excerpt

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "readability-extract": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-readability-extract/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

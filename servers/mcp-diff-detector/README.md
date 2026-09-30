# Diff Detector

> Detecta cambios entre versiones de texto/HTML/JSON con similitud

**Categoría:** Datos y Extracción · **ID:** `mcp-diff-detector`

**Dolor de agente que resuelve:** Saber si algo cambió (y cuánto) entre dos versiones es la base del monitoreo: falta diff con score.

## Tools (3 incl. health_check)

### `similarity`
Similitud entre dos textos: Jaccard de palabras + shingles de 3 palabras + ratio de longitud.

**Parámetros:**
  - `a` (string, requerido): Texto A
  - `b` (string, requerido): Texto B

### `changed_sections`
Divide dos HTML/textos en secciones por encabezados (h1-h3 o líneas en blanco) y reporta qué secciones cambian, se añaden o desaparecen.

**Parámetros:**
  - `version_anterior` (string, requerido): Versión vieja
  - `version_nueva` (string, requerido): Versión nueva

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "diff-detector": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-diff-detector/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# YAML Toolkit

> Parse y genera YAML (subconjunto práctico): configs y front-matter

**Categoría:** Datos y Extracción · **ID:** `mcp-yaml-toolkit`

**Dolor de agente que resuelve:** Las configs llegan en YAML (front-matter, CI, docker-compose) y sin parser el agente las toca a ciegas.

## Tools (3 incl. health_check)

### `parse`
Parsea YAML de subconjunto práctico: escalares, strings, listas (- item), maps anidados por indentación y flags. Suficiente para configs típicas.

**Parámetros:**
  - `yaml` (string, requerido): YAML a parsear

### `stringify`
Serializa un JSON a YAML (indentación 2, strings citadas solo si necesario).

**Parámetros:**
  - `data` (any, requerido): JSON a serializar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "yaml-toolkit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-yaml-toolkit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

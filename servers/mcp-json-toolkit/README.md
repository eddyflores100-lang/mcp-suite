# JSON Toolkit

> jsonpath, merge profundo, diff y validación: la navaja suiza del JSON

**Categoría:** Datos y Extracción · **ID:** `mcp-json-toolkit`

**Dolor de agente que resuelve:** Manipular JSON anidado a mano es propenso a errores: query, merge y diff estructurados faltan.

## Tools (4 incl. health_check)

### `query`
Consulta JSON con jsonpath simplificado: $.a.b, $[0].name, $.items[*].id y filtros [?(@.x>5)].

**Parámetros:**
  - `data` (any, requerido): JSON a consultar
  - `path` (string, requerido): Ruta estilo jsonpath ($.a.b[0].c)

### `merge`
Merge profundo de 2+ JSONs: objetos se combinan recursivamente, arrays y escalares se reemplazan (o concatenan con flag).

**Parámetros:**
  - `objetos` (array, requerido): Lista de JSONs a fusionar (en orden)
  - `concatenar_arrays` (boolean, opcional): Concatenar arrays en vez de reemplazar

### `validate`
Valida estructura y tipos de un JSON: tipado inferido del valor, campos null, arrays mixtos y profundidad.

**Parámetros:**
  - `data` (any, requerido): JSON a inspeccionar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "json-toolkit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-json-toolkit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

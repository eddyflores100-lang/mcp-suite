# Unit Convert

> Conversiones de unidades exactas: longitud, masa, volumen, temperatura, datos

**Categoría:** Utilidades · **ID:** `mcp-unit-convert`

**Dolor de agente que resuelve:** '~2 libras' del LLM no sirve para recetas ni ingeniería: conversiones exactas con factores estándar.

## Tools (3 incl. health_check)

### `convert`
Convierte entre unidades de 7 familias: longitud, masa, volumen, temperatura, área, velocidad y datos (SI e imperiales).

**Parámetros:**
  - `valor` (number, requerido): Valor
  - `de` (string, requerido): Unidad origen
  - `a` (string, requerido): Unidad destino

### `list_units`
Lista todas las unidades soportadas por familia.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "unit-convert": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-unit-convert/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

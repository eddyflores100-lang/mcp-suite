# Normalize Output

> Normaliza formatos: fechas ISO, números, unidades y casing consistentes

**Categoría:** Calidad de Salida · **ID:** `mcp-normalize-output`

**Dolor de agente que resuelve:** La salida llega con formatos mezclados: fechas en 3 formatos, números con comas y puntos, unidades inconsistentes.

## Tools (3 incl. health_check)

### `normalize_dates`
Detecta fechas en un texto y las normaliza a ISO 8601 (YYYY-MM-DD), reportando cada conversión.

**Parámetros:**
  - `texto` (string, requerido): Texto con fechas

### `normalize_numbers`
Normaliza números con separadores de miles/decimales mezclados (1.234,56 / 1,234.56) a formato consistente.

**Parámetros:**
  - `numero` (string, requerido): Número a normalizar
  - `formato` (enum, opcional): Formato destino

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "normalize-output": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-normalize-output/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# Stats Toolkit

> Estadística descriptiva exacta: media, mediana, desviación, cuartiles y correlación

**Categoría:** Utilidades · **ID:** `mcp-stats-toolkit`

**Dolor de agente que resuelve:** El LLM 'estima' medias y desviaciones: para decisiones basadas en datos, cálculo exacto obligatorio.

## Tools (4 incl. health_check)

### `describe`
Estadística descriptiva completa de una lista de números: n, media, mediana, desviación, min, máx, cuartiles y outliers (IQR).

**Parámetros:**
  - `valores` (array, requerido): Lista de números

### `correlation`
Correlación de Pearson exacta entre dos listas (misma longitud).

**Parámetros:**
  - `x` (array, requerido): Valores X
  - `y` (array, requerido): Valores Y

### `histogram`
Histograma de una lista numérica con bins automáticos (regla de Sturges).

**Parámetros:**
  - `valores` (array, requerido): Números
  - `bins` (number, opcional): Número de bins

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "stats-toolkit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-stats-toolkit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

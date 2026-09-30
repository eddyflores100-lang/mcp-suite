# Data Anonymizer

> Anonimiza datasets: pseudonimos estables, emails fake y análisis de riesgo de reidentificación

**Categoría:** Datos y Extracción · **ID:** `mcp-data-anonymizer`

**Dolor de agente que resuelve:** Compartir datasets con PII raw es ilegal: hace falta anonimización con mapeo estable (no romper joins).

> Estado persistente en `~/.mcp-suite/data-anonymizer/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `pseudonymize`
Pseudonimiza un dataset: reemplaza valores de columnas sensibles por IDs estables (mismo input → mismo seudónimo, los joins sobreviven).

**Parámetros:**
  - `data` (array, requerido): Lista de registros (objetos)
  - `columnas_sensibles` (array, requerido): Columnas a pseudonimizar
  - `prefijo` (string, opcional): Prefijo del seudónimo

### `reidentification_risk`
Evalúa riesgo de reidentificación de un dataset: cuasi-identificadores (combinaciones únicas) estilo k-anonimidad.

**Parámetros:**
  - `data` (array, requerido): Registros
  - `columnas_quasi` (array, requerido): Columnas cuasi-identificadoras (edad, ciudad, zip...)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "data-anonymizer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-data-anonymizer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

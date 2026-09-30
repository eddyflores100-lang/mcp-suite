# Decision Matrix

> Decisiones ponderadas: opciones × criterios con análisis de sensibilidad

**Categoría:** Cognición y Planificación · **ID:** `mcp-decision-matrix`

**Dolor de agente que resuelve:** El agente decide por intuición: sin matriz ponderada, las decisiones no son reproducibles ni explicables.

## Tools (3 incl. health_check)

### `decide`
Evalúa opciones contra criterios ponderados: puntúa cada opción, calcula total ponderado y recomienda la ganadora.

**Parámetros:**
  - `opciones` (array, requerido): Nombres de opciones
  - `criterios` (array, requerido): Lista {nombre, peso}
  - `puntajes` (any, requerido): Matriz {opcion: {criterio: 0-10}}

### `sensitivity`
Análisis de sensibilidad: ¿cambia la decisión si un criterio cambia de peso? Encuentra los pesos que voltean la decisión.

**Parámetros:**
  - `opciones` (array, requerido): Nombres de opciones
  - `criterios` (array, requerido): Lista {nombre, peso}
  - `puntajes` (any, requerido): Matriz de puntajes

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "decision-matrix": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-decision-matrix/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

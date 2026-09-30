# Context Budget

> Presupuesto de tokens por sección: qué entra al prompt y qué se queda fuera

**Categoría:** Memoria y Contexto · **ID:** `mcp-context-budget`

**Dolor de agente que resuelve:** Sin presupuesto, el agente mete todo al prompt hasta chocar con el límite (issue #58 del spec MCP: responses too big).

## Tools (3 incl. health_check)

### `check_fit`
Calcula si una lista de secciones {nombre, texto} cabe en el presupuesto de tokens del modelo (con margen para respuesta).

**Parámetros:**
  - `secciones` (array, requerido): Lista de {nombre, texto}
  - `presupuesto_tokens` (number, opcional): Límite del modelo
  - `margen_respuesta` (number, opcional): Tokens reservados para la respuesta

### `plan_sections`
Dado un presupuesto y secciones priorizadas, decide cuáles entran completas, cuáles recortadas y cuáles fuera.

**Parámetros:**
  - `secciones` (array, requerido): Lista de {nombre, texto, prioridad 1-5}
  - `presupuesto_tokens` (number, opcional): Presupuesto

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "context-budget": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-context-budget/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

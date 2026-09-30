# Meeting Notes

> Estructura notas de reunión: decisiones, acciones con dueño y temas aparcados

**Categoría:** Comunicación y Humano · **ID:** `mcp-meeting-notes`

**Dolor de agente que resuelve:** Las notas de reunión son ríos de prosa: decisiones y acciones se pierden sin estructura.

## Tools (3 incl. health_check)

### `structure_notes`
Estructura notas crudas de reunión: detecta decisiones, action items (con dueño si aparece) y temas aparcados (parking lot).

**Parámetros:**
  - `notas` (string, requerido): Notas crudas de la reunión
  - `reunion` (string, opcional): Título de la reunión

### `action_items`
Extrae SOLO las action items con su formato estandarizado: qué, quién, cuándo (si aparece).

**Parámetros:**
  - `notas` (string, requerido): Notas

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "meeting-notes": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-meeting-notes/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

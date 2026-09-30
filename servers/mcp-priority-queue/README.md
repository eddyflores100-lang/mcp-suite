# Priority Queue

> Cola de prioridades con matriz Eisenhower: urgente vs importante

**Categoría:** Cognición y Planificación · **ID:** `mcp-priority-queue`

**Dolor de agente que resuelve:** El agente ataca lo último que llegó (recency bias): sin matriz de prioridades, lo urgente devora lo importante.

> Estado persistente en `~/.mcp-suite/priority-queue/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `add`
Añade un item con urgencia e importancia (0-10): se clasifica en la matriz Eisenhower automáticamente.

**Parámetros:**
  - `descripcion` (string, requerido): Qué hay que hacer
  - `urgencia` (number, requerido): Urgencia 0-10
  - `importancia` (number, requerido): Importancia 0-10
  - `vence_horas` (number, opcional): Vence en N horas

### `pop`
Saca el item de mayor prioridad (ponderado urgencia 60% / importancia 40%, con penalización por vencido).

### `matrix`
Snapshot de la matriz Eisenhower: items por cuadrante.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "priority-queue": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-priority-queue/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

# Handoff Notes

> Notas de traspaso entre agentes/turnos: contexto, estado y pendientes en plantilla estandarizada

**Categoría:** Comunicación y Humano · **ID:** `mcp-handoff-notes`

**Dolor de agente que resuelve:** El traspaso entre agentes (o turnos) pierde contexto crítico: cada receptor re-descubre todo.

> Estado persistente en `~/.mcp-suite/handoff-notes/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `create_handoff`
Crea una nota de traspaso estandarizada: objetivo, estado actual, pendientes, riesgos, contexto esencial y contactos.

**Parámetros:**
  - `tarea` (string, requerido): Tarea que se traspasa
  - `objetivo` (string, requerido): Objetivo
  - `estado_actual` (string, requerido): Dónde quedó todo
  - `pendientes` (array, requerido): Pendientes concretos
  - `riesgos` (array, opcional): Riesgos conocidos
  - `contexto` (string, opcional): Contexto esencial (links, decisions)

### `render_handoff`
Renderiza la nota de traspaso en markdown listo para pegar al receptor.

**Parámetros:**
  - `id` (string, requerido): ID del handoff

### `completeness_check`
Verifica completitud del traspaso: ¿el receptor puede continuar sin preguntar nada?

**Parámetros:**
  - `id` (string, requerido): ID del handoff

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "handoff-notes": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-handoff-notes/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

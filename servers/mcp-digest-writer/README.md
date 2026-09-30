# Digest Writer

> Dígestos ejecutivos: convierte una lista de items en resumen digerible priorizado

**Categoría:** Comunicación y Humano · **ID:** `mcp-digest-writer`

**Dolor de agente que resuelve:** 50 actualizaciones no leídas = 0 información: falta un digest que priorice y agrupe.

## Tools (3 incl. health_check)

### `digest`
Genera un digest de items {titulo, detalle, prioridad, categoria}: agrupado por categoría, priorizado y con top-3 destacado.

**Parámetros:**
  - `items` (array, requerido): Items {titulo, detalle, prioridad(alta/media/baja), categoria}
  - `titulo_digest` (string, opcional): Título del digest

### `escalation_digest`
Dígesto de escalación: solo lo que requiere ACCIÓN humana hoy, con deadline.

**Parámetros:**
  - `items` (array, requerido): Items {titulo, detalle, vence?}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "digest-writer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-digest-writer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

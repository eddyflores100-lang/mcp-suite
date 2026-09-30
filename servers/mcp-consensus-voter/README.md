# Consensus Voter

> Votación entre N respuestas del mismo prompt: self-consistency sin infraestructura

**Categoría:** Calidad de Salida · **ID:** `mcp-consensus-voter`

**Dolor de agente que resuelve:** Una sola pasada del LLM puede ser un outlier: self-consistency (votar entre N muestras) mejora precisión pero falta tooling.

> Estado persistente en `~/.mcp-suite/consensus-voter/state.json` (local, privado, tuya la data).

## Tools (3 incl. health_check)

### `add_answer`
Añade una respuesta candidata (de una pasada distinta) a la pregunta activa.

**Parámetros:**
  - `pregunta` (string, requerido): La pregunta (misma para todas)
  - `respuesta` (string, requerido): Respuesta candidata

### `vote`
Calcula el consenso: agrupa respuestas por similitud (números clave + Jaccard) y devuelve la ganadora con nivel de acuerdo.

**Parámetros:**
  - `pregunta` (string, requerido): La pregunta de la ronda

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "consensus-voter": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-consensus-voter/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

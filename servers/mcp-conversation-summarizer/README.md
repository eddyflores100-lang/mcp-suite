# Conversation Summarizer

> Resumen incremental de conversaciones largas sin perder los compromisos

**Categoría:** Memoria y Contexto · **ID:** `mcp-conversation-summarizer`

**Dolor de agente que resuelve:** Al resumir una conversación se pierden decisiones y tareas pendientes: el resumen debe conservar compromisos, no solo tema.

> Estado persistente en `~/.mcp-suite/conversation-summarizer/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `add_message`
Añade un mensaje a la conversación activa (rol + contenido). Se guarda cronológicamente.

**Parámetros:**
  - `rol` (enum, requerido): Autor del mensaje
  - `contenido` (string, requerido): Contenido del mensaje

### `summarize`
Genera resumen estructurado de la conversación: temas, decisiones detectadas, tareas pendientes y preguntas abiertas. Base perfecta para handoff.

**Parámetros:**
  - `ultimo_n` (number, opcional): Solo los últimos N mensajes

### `reset`
Reinicia la conversación activa (guardando archivo de histórico si confirmar=true).

**Parámetros:**
  - `confirmar` (boolean, opcional): Confirmar reset

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "conversation-summarizer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-conversation-summarizer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

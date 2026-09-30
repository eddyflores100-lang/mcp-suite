# Token Counter

> Cuenta tokens y palabras antes de enviar: presupuesto bajo control

**Categoría:** Memoria y Contexto · **ID:** `mcp-token-counter`

**Dolor de agente que resuelve:** El agente envía prompts gigantes sin saber cuánto costarán: falta un contador previo (aproximado, sin API).

## Tools (4 incl. health_check)

### `count`
Cuenta tokens aproximados de un texto (heurística chars/4 + palabras/0.75, calibrada para español e inglés).

**Parámetros:**
  - `texto` (string, requerido): Texto a medir

### `count_messages`
Cuenta tokens de una conversación completa [{rol, contenido}] incluyendo overhead por mensaje.

**Parámetros:**
  - `mensajes` (array, requerido): Lista de mensajes {rol, contenido}

### `fit_check`
Verifica si un prompt entra en la ventana de un modelo dado (gpt4, claude, gemini...) y cuánto queda para la respuesta.

**Parámetros:**
  - `tokens_prompt` (number, requerido): Tokens del prompt
  - `modelo` (enum, opcional): Clase de modelo

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "token-counter": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-token-counter/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

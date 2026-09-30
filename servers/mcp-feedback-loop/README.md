# Feedback Loop

> Recolecta feedback estructurado y detecta sentimiento sin APIs externas

**Categoría:** Comunicación y Humano · **ID:** `mcp-feedback-loop`

**Dolor de agente que resuelve:** El feedback llega suelto por chat: sin registro ni análisis, el agente repite lo que molesta.

> Estado persistente en `~/.mcp-suite/feedback-loop/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `collect`
Registra feedback: categoría (claridad, velocidad, calidad, error), texto y puntuación opcional 1-5.

**Parámetros:**
  - `categoria` (enum, requerido): Categoría
  - `texto` (string, requerido): El feedback
  - `puntuacion` (number, opcional): 1-5 opcional

### `sentiment_lite`
Sentimiento léxico local (ES): positivo/negativo/neutral con los términos detectados, sin APIs.

**Parámetros:**
  - `texto` (string, requerido): Feedback a analizar

### `summarize_feedback`
Resumen del feedback acumulado: promedio por categoría, temas frecuentes y sentimiento global.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "feedback-loop": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-feedback-loop/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

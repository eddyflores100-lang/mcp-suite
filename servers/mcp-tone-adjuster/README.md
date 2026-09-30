# Tone Adjuster

> Analiza y ajusta el tono del texto del agente: formalidad, cortesía y claridad

**Categoría:** Comunicación y Humano · **ID:** `mcp-tone-adjuster`

**Dolor de agente que resuelve:** El agente responde con tono inadecuado (demasiado seco para clientes, demasiado efusivo para técnicos): nadie mide el tono.

## Tools (3 incl. health_check)

### `analyze_tone`
Analiza el tono de un texto: formalidad (léxico), cortesía, asertividad, longitud de oraciones y jerga técnica.

**Parámetros:**
  - `texto` (string, requerido): Texto a analizar

### `adjust_hints`
Devuelve instrucciones concretas para ajustar el tono al objetivo deseado (profesional, cálido, técnico, directo).

**Parámetros:**
  - `tono_objetivo` (enum, requerido): Tono deseado
  - `texto` (string, opcional): Texto actual

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "tone-adjuster": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-tone-adjuster/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

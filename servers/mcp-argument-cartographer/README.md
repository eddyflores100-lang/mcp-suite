# Argument Cartographer

> Mapas de argumento estilo Toulmin: afirmación, garantía, respaldo y refutación — con los huecos visibles

**Categoría:** Razonamiento · **ID:** `mcp-argument-cartographer`

**Dolor de agente que resuelve:** El argumento del agente SUENA sólido pero le falta la garantía que conecta datos con conclusión: nadie dibuja el mapa, así que el agujero lógico queda invisible hasta que un humano lo destapa en producción.

> Estado persistente en `~/.mcp-suite/argument-cartographer/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `map_argument`
Mapea un argumento completo en componentes Toulmin.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del argumento
  - `claim` (string, requerido): La afirmación principal
  - `grounds` (string, requerido): Los datos/evidencia que la apoyan
  - `warrant` (string, opcional): La regla que conecta grounds con claim (¿por qué esos datos implican esa conclusión?)
  - `backing` (string, opcional): Qué respalda la garantía (estudio, norma, experiencia)
  - `qualifier` (string, opcional): Matiz del claim (probablemente, en general, salvo...)
  - `rebuttal` (string, opcional): Condiciones bajo las que el claim cae

### `find_gaps`
Detecta los huecos lógicos del argumento: componentes faltantes y conexiones débiles.

**Parámetros:**
  - `nombre` (string, requerido): Argumento

### `attack_surface`
Calcula la superficie de ataque: por dónde caería el argumento primero.

**Parámetros:**
  - `nombre` (string, requerido): Argumento

### `strength_score`
Puntúa la solidez estructural del argumento (0-100) con desglose.

**Parámetros:**
  - `nombre` (string, requerido): Argumento

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "argument-cartographer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-argument-cartographer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/argument-cartographer/. Modela argumentos Toulmin (claim/grounds/warrant/backing/qualifier/rebuttal); detecta componentes faltantes, evalúa fuerza y expone superficie de ataque.

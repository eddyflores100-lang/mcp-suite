# Change Changelog

> Changelog humano generado de los cambios del agente: agrupado, con semántica y exportable a Markdown

**Categoría:** Agent CI/CD · **ID:** `mcp-change-changelog`

**Dolor de agente que resuelve:** El agente cambia 40 cosas en la semana y cuando alguien pregunta '¿qué cambió desde el martes?' la respuesta es un encogimiento de hombros digital: sin registro estructurado no hay changelog posible.

> Estado persistente en `~/.mcp-suite/change-changelog/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `record_change`
Registra un cambio con tipo, componente y descripción orientada a humanos.

**Parámetros:**
  - `tipo` (enum, requerido): Naturaleza del cambio
  - `componente` (string, requerido): Qué se cambió (prompt:x, tool:y, config:z)
  - `descripcion` (string, requerido): Descripción en una línea, humana y específica
  - `impacto` (enum, opcional): Impacto en comportamiento

### `tag_release`
Sella los cambios pendientes en una versión (etiqueta) con resumen.

**Parámetros:**
  - `etiqueta` (string, requerido): Nombre de la versión (v1.4.0 o fecha)

### `generate_changelog`
Genera el changelog agrupado por versión y tipo, listo para publicar.

**Parámetros:**
  - `solo_release` (string, opcional): Filtrar por una versión concreta
  - `limite` (number, opcional): Máximo de versiones a mostrar

### `markdown_export`
Exporta el changelog como Markdown formato Keep-a-Changelog.

**Parámetros:**
  - `titulo` (string, opcional): Título del proyecto
  - `solo_release` (string, opcional): Versión concreta

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "change-changelog": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-change-changelog/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/change-changelog/. Registra cambios tipados (added/changed/fixed/removed/deprecated) sobre componentes; genera changelog agrupado por versión con exportación Markdown.

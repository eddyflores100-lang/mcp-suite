# Prompt Versioner

> Control de versiones para prompts y system prompts: commits con diff, semántica y puntero de despliegue

**Categoría:** Agent CI/CD · **ID:** `mcp-prompt-versioner`

**Dolor de agente que resuelve:** El prompt se 'mejora' editando el archivo a mano: no hay diff, ni versión previa, ni forma de volver. Si el agente empeora, nadie sabe qué línea cambió ni cuándo: el prompt es el código más editado y el menos versionado del planeta.

> Estado persistente en `~/.mcp-suite/prompt-versioner/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `register_prompt`
Registra un prompt nuevo con su contenido inicial (versión 0.1.0).

**Parámetros:**
  - `nombre` (string, requerido): Identificador del prompt
  - `contenido` (string, requerido): Texto completo del prompt
  - `proposito` (string, opcional): Para qué sirve

### `commit_version`
Commit de una nueva versión con bump semántico y mensaje explicando el cambio.

**Parámetros:**
  - `nombre` (string, requerido): Prompt a versionar
  - `contenido` (string, requerido): Texto COMPLETO de la nueva versión
  - `commit` (string, requerido): Mensaje del commit (qué y por qué)
  - `bump` (enum, requerido): Severidad del cambio

### `diff_versions`
Diff línea a línea entre dos versiones del prompt.

**Parámetros:**
  - `nombre` (string, requerido): Prompt
  - `desde` (string, opcional): Versión origen
  - `hasta` (string, opcional): Versión destino

### `set_pointer`
Mueve el puntero de despliegue a una versión concreta (deploy explícito, auditable).

**Parámetros:**
  - `nombre` (string, requerido): Prompt
  - `version` (string, requerido): Versión a desplegar
  - `razon` (string, opcional): Por qué se despliega

### `history`
Historia completa del prompt con commits y despliegues.

**Parámetros:**
  - `nombre` (string, requerido): Prompt

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "prompt-versioner": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-prompt-versioner/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/prompt-versioner/. Cada prompt tiene historia de versiones inmutables con mensaje de commit, diff automático (línea a línea) y bump semántico (major = cambia comportamiento esperado).

# Conflict Resolver

> Detecta y resuelve conflictos entre agentes: ediciones concurrentes, decisiones contradictorias, duplicación

**Categoría:** Multi-Agente y Coordinación · **ID:** `mcp-conflict-resolver`

**Dolor de agente que resuelve:** Dos agentes editan el mismo artefacto o toman decisiones contradictorias sobre el mismo asunto: el resultado es corrupción silenciosa del estado o guerra de tirones sin árbitro.

> Estado persistente en `~/.mcp-suite/conflict-resolver/state.json` (local, privado, tuya la data).

## Tools (8 incl. health_check)

### `record_decision`
Un agente registra una decisión sobre un asunto; se detecta contradicción con decisiones previas de otros agentes.

**Parámetros:**
  - `asunto` (string, requerido): Clave del asunto (ej: stack/frontend)
  - `agente` (string, requerido): Agent_id que decide
  - `decision` (string, requerido): Decisión tomada
  - `justificacion` (string, opcional): Por qué
  - `confianza` (number, opcional): 0-1

### `declare_edit`
Declara intención de editar un artefacto (piso, sección o campo) para detectar solapamientos con otros editores.

**Parámetros:**
  - `artefacto` (string, requerido): ID/ruta del artefacto
  - `agente` (string, requerido): Agent_id editor
  - `seccion` (string, opcional): Parte que tocará (todo, sección X, campo Y)

### `close_edit`
Cierra una declaración de edición (terminaste con el artefacto).

**Parámetros:**
  - `artefacto` (string, requerido): Artefacto
  - `agente` (string, requerido): Agent_id

### `raise_conflict`
Eleva un conflicto formal (asunto/artefacto, partes, posturas) para que se arbitre.

**Parámetros:**
  - `tipo` (enum, requerido): Tipo de conflicto
  - `sujeto` (string, requerido): Asunto o artefacto en conflicto
  - `partes` (array, requerido): Agent_ids implicados
  - `detalle` (string, opcional): Descripción del choque

### `resolve_conflict`
Resuelve un conflicto: merge documentado, votación, o escalamiento a humano; queda como precedente auditable.

**Parámetros:**
  - `conflicto_id` (string, requerido): ID del conflicto
  - `estrategia` (enum, requerido): Cómo se resolvió
  - `resolucion` (string, requerido): Texto de la resolución final
  - `resuelto_por` (string, requerido): Quién arbitra

### `duplication_check`
Detecta trabajo duplicado: dos agentes haciendo lo mismo (por similitud de descripción de tarea).

**Parámetros:**
  - `tareas` (array, requerido): Lista de {agente, descripcion} activas para cruzar

### `conflict_stats`
Estadísticas de conflictos por tipo, estrategia de resolución y tasa de escalamiento humano.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "conflict-resolver": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-conflict-resolver/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/conflict-resolver/. Registra decisiones por asunto y ediciones por artefacto; detecta contradicciones (posturas opuestas sobre la misma clave) y propone estrategia de fusión.

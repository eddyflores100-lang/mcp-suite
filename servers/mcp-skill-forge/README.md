# Skill Forge

> Convierte lecciones repetidas en skills/playbooks versionados: conocimiento procedural reutilizable

**Categoría:** Aprendizaje de Habilidades · **ID:** `mcp-skill-forge`

**Dolor de agente que resuelve:** Las lecciones sueltas no bastan para tareas complejas: el agente re-deriva el mismo procedimiento multi-paso cada vez porque nunca se empaquetó como skill con pasos, precondiciones y trampas.

> Estado persistente en `~/.mcp-suite/skill-forge/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `forge_skill`
Crea una skill a partir de un procedimiento: pasos, precondiciones, trampas y criterio de éxito.

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la skill
  - `proposito` (string, requerido): Para qué sirve
  - `pasos` (array, requerido): Pasos en orden
  - `precondiciones` (array, opcional): Qué debe ser cierto antes de empezar
  - `trampas` (array, opcional): Errores conocidos que evitar
  - `criterio_exito` (string, requerido): Cómo saber que funcionó

### `get_skill`
Recupera la skill completa para ejecutarla (con checklist de precondiciones).

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la skill

### `report_outcome`
Registra el resultado de usar la skill (éxito o fallo con paso del fallo) para su refinamiento.

**Parámetros:**
  - `nombre` (string, requerido): Skill usada
  - `exito` (boolean, requerido): ¿Funcionó?
  - `fallo_en_paso` (number, opcional): Si falló: número de paso
  - `nota` (string, opcional): Contexto del resultado

### `refine_skill`
Refina una skill: añade paso, trampa o ajusta criterio — crea versión nueva con historial de cambios.

**Parámetros:**
  - `nombre` (string, requerido): Skill a refinar
  - `pasos_extra` (array, opcional): Pasos a añadir al final
  - `trampas_extra` (array, opcional): Trampas nuevas descubiertas
  - `criterio_exito` (string, opcional): Criterio actualizado
  - `motivo` (string, requerido): Qué fallo motivó el refinamiento

### `skill_catalog`
Catálogo de skills con madurez (tasa de éxito y usos): qué está listo para delegar.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "skill-forge": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-skill-forge/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/skill-forge/. Skills = pasos ordenados + precondiciones + trampas conocidas + criterio de éxito; versionado y contador de uso con tasa de éxito.

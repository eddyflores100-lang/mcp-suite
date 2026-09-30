# Rollback Manager

> Volver atrás en un paso: snapshots nombrados de configuración del agente con restauración verificada

**Categoría:** Agent CI/CD · **ID:** `mcp-rollback-manager`

**Dolor de agente que resuelve:** El cambio de configuración rompe al agente a las 3am: 'volver atrás' significa recordar qué 6 archivos se tocaron y rezar. Sin snapshots nombrados ni rollback de un comando, cada regresión es arqueología manual.

> Estado persistente en `~/.mcp-suite/rollback-manager/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `capture_snapshot`
Captura un snapshot nombrado de la configuración actual del agente.

**Parámetros:**
  - `etiqueta` (string, requerido): Nombre del snapshot (ej: pre-migracion-router)
  - `config` (any, requerido): Objeto de configuración completo a congelar
  - `razon` (string, opcional): Por qué se captura (antes de cambiar X)

### `rollback_to`
Restaura la configuración a un snapshot: devuelve la config completa y verifica el hash.

**Parámetros:**
  - `etiqueta` (string, requerido): Snapshot a restaurar
  - `verificacion` (any, opcional): Config actual para calcular qué cambirá (opcional, mejora el reporte)

### `list_snapshots`
Lista snapshots disponibles con antigüedad y frecuencia de restauración.

### `diff_against_snapshot`
Compara tu configuración actual contra un snapshot: qué se ha tocado desde entonces.

**Parámetros:**
  - `etiqueta` (string, requerido): Snapshot de referencia
  - `config_actual` (any, requerido): Configuración actual

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "rollback-manager": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-rollback-manager/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/rollback-manager/. Snapshots de configuración (conjuntos clave-valor) con etiqueta; rollback atómico a cualquier snapshot con verificación de integridad y registro de quién/por qué.

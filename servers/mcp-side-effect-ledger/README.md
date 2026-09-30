# Side-Effect Ledger

> Libro mayor de efectos secundarios: cada cambio queda registrado con su receta de deshacer

**Categoría:** Pre-Vuelo · **ID:** `mcp-side-effect-ledger`

**Dolor de agente que resuelve:** El agente hizo 14 cambios y solo recuerda 3: cuando hay que volver atrás no existe un registro de qué tocó ni cómo se deshace cada cosa. Los 'action logs' genéricos guardan qué pasó, no cómo revertirlo.

> Estado persistente en `~/.mcp-suite/side-effect-ledger/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `register_effect`
Registra un efecto secundario con su receta de reversión. Úsalo INMEDIATAMENTE después de cada acción con impacto.

**Parámetros:**
  - `target` (string, requerido): Recurso afectado (archivo, registro, cuenta, estado)
  - `tipo` (enum, requerido): Tipo de efecto
  - `como_deshacer` (string, requerido): Receta concreta para revertir (comando, API, secuencia)
  - `paso` (string, opcional): Paso/acción del agente que lo causó
  - `caducidad_horas` (number, opcional): Horas tras las que la receta de deshacer deja de ser válida (0 = nunca)
  - `dificultad` (enum, opcional): Dificultad de reversión

### `undo_info`
Recupera la receta de deshacer para un target (o por id de efecto).

**Parámetros:**
  - `target` (string, opcional): Recurso a revertir
  - `id` (string, opcional): Id del efecto exacto

### `mark_undone`
Marca un efecto como deshecho (con nota de verificación).

**Parámetros:**
  - `id` (string, requerido): Id del efecto (fx_0001)
  - `verificado_por` (string, opcional): Cómo se verificó que quedó revertido

### `list_open_effects`
Todos los efectos sin deshacer, agrupados por dificultad y con los más urgentes primero.

**Parámetros:**
  - `solo_tipo` (string, opcional): Filtrar por tipo

### `rollback_plan`
Genera el plan de reversión total: deshacer todos los efectos abiertos en orden inverso (LIFO).

**Parámetros:**
  - `desde_id` (string, opcional): Revertir desde este efecto (inclusive) hacia atrás

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "side-effect-ledger": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-side-effect-ledger/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/side-effect-ledger/. Cada efecto guarda: target, tipo, cómo deshacer (comando/receta), si ya se deshizo y caducidad de la receta (algunos undos expiran).

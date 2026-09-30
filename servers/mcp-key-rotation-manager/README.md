# Key Rotation Manager

> Rotación de claves con ventana de gracia: rota sin romper verificaciones en curso y con historial auditable

**Categoría:** Identidad Federada · **ID:** `mcp-key-rotation-manager`

**Dolor de agente que resuelve:** El agente rota su clave de golpe y todas las firmas/verificaciones en vuelo fallan de forma misteriosa; o peor: nunca rota y la clave eterna se filtra. La rotación segura es un proceso, no un comando.

> Estado persistente en `~/.mcp-suite/key-rotation-manager/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `register_identity`
Registra una identidad criptográfica con su clave inicial y política de rotación.

**Parámetros:**
  - `identidad` (string, requerido): Nombre de la identidad/propósito de la clave
  - `clave_inicial` (string, requerido): Material o referencia de la clave inicial (id/hash, no el secreto)
  - `periodo_dias` (number, opcional): Rotar cada N días (0 = manual)
  - `gracia_horas` (number, opcional): Horas que la clave vieja sigue VERIFICANDO tras rotar

### `perform_rotation`
Ejecuta la rotación: la clave activa pasa a gracia (solo verifica) y una nueva queda activa (solo firma).

**Parámetros:**
  - `identidad` (string, requerido): Identidad a rotar
  - `nueva_clave` (string, requerido): Material/referencia de la nueva clave
  - `razon` (string, opcional): Por qué rotas (programada, sospecha, fuga)

### `check_key_status`
Consulta qué puede hacer cada clave: firmar (activa), solo verificar (gracia) o nada (muerta).

**Parámetros:**
  - `identidad` (string, requerido): Identidad

### `rotation_due`
Detecta rotaciones vencidas o a punto de vencer según la política.

**Parámetros:**
  - `margen_dias` (number, opcional): Días de aviso previo

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "key-rotation-manager": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-key-rotation-manager/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/key-rotation-manager/. Cada identidad tiene clave actual + claves en gracia (verifican pero no firman) + claves muertas; la política define periodicidad y duración de gracia.

# Permission Gate

> Puerta de permisos: operaciones sensibles requieren aprobación explícita

**Categoría:** Seguridad · **ID:** `mcp-permission-gate`

**Dolor de agente que resuelve:** Las tools ejecutan acciones sensibles (borrar, pagar, publicar) sin puerta de aprobación: human-in-the-loop ausente.

> Estado persistente en `~/.mcp-suite/permission-gate/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `request`
Solicita permiso para una operación sensible: queda PENDIENTE hasta que el humano apruebe o deniegue.

**Parámetros:**
  - `operacion` (string, requerido): Operación a autorizar
  - `justificacion` (string, requerido): Por qué es necesario
  - `riesgo` (enum, opcional): Nivel de riesgo

### `respond`
Resuelve una solicitud de permiso (aprobar o denegar) con motivo opcional.

**Parámetros:**
  - `permiso_id` (string, requerido): ID del permiso
  - `aprobar` (boolean, requerido): true=aprobar, false=denegar
  - `motivo` (string, opcional): Motivo de la decisión

### `check`
Verifica si una operación está autorizada (busca aprobación vigente ≤ 1 hora para operaciones equivalentes).

**Parámetros:**
  - `operacion` (string, requerido): Operación a verificar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "permission-gate": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-permission-gate/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

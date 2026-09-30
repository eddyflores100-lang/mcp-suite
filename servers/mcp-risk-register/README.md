# Risk Register

> Registro de riesgos: probabilidad × impacto con mitigaciones y dueños

**Categoría:** Cognición y Planificación · **ID:** `mcp-risk-register`

**Dolor de agente que resuelve:** El agente ignora riesgos hasta que explotan: sin register, la mitigación es reactiva.

> Estado persistente en `~/.mcp-suite/risk-register/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `add_risk`
Registra un riesgo: descripción, probabilidad (1-5), impacto (1-5), mitigación y dueño.

**Parámetros:**
  - `descripcion` (string, requerido): El riesgo
  - `probabilidad` (number, requerido): Probabilidad 1-5
  - `impacto` (number, requerido): Impacto 1-5
  - `mitigacion` (string, opcional): Cómo mitigarlo
  - `dueno` (string, opcional): Responsable

### `top_risks`
Top riesgos abiertos ordenados por score, con mitigaciones pendientes.

**Parámetros:**
  - `n` (number, opcional): Cuántos

### `close_risk`
Cierra un riesgo (ocurrió, se mitigó o se aceptó).

**Parámetros:**
  - `id` (string, requerido): ID del riesgo
  - `desenlace` (enum, requerido): Desenlace
  - `nota` (string, opcional): Nota

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "risk-register": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-risk-register/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

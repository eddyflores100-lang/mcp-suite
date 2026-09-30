# Assumption Auditor

> Audita supuestos del agente: explícitos, críticos y cómo validarlos

**Categoría:** Cognición y Planificación · **ID:** `mcp-assumption-auditor`

**Dolor de agente que resuelve:** Los supuestos ocultos rompen planes enteros: nadie los enumera ni valida antes de construir encima.

## Tools (3 incl. health_check)

### `audit_plan`
Extrae supuestos implícitos de un plan/objetivo (señales lingüísticas: presuposiciones, dependencias, certezas) y los clasifica por criticidad.

**Parámetros:**
  - `plan` (string, requerido): El plan u objetivo en texto

### `validate_assumption`
Guía la validación de un supuesto específico: qué evidencia lo confirmaría/refutaría y qué hacer en cada caso.

**Parámetros:**
  - `supuesto` (string, requerido): El supuesto a validar
  - `criticidad` (enum, opcional): Qué pasa si es falso

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "assumption-auditor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-assumption-auditor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

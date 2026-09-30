# Threat Modeler

> Modelado de amenazas STRIDE para tus tools y flujos de agente

**Categoría:** Seguridad · **ID:** `mcp-threat-modeler`

**Dolor de agente que resuelve:** Nadie modela amenazas antes de exponer una tool MCP: spoofing y tampering de tools son triviales sin análisis.

## Tools (3 incl. health_check)

### `enumerate`
Enumera amenazas STRIDE (Spoofing, Tampering, Repudio, Info disclosure, DoS, Elevation) para un componente/flujo descrito.

**Parámetros:**
  - `componente` (string, requerido): Componente o flujo a modelar

### `assess`
Puntúa el riesgo de un flujo según controles presentes: devuelve brechas de mitigación priorizadas.

**Parámetros:**
  - `flujo` (string, requerido): Descripción del flujo
  - `controles_presentes` (array, requerido): Controles ya implementados (ej: auth, tls, rate-limit, audit, pii-redaction, sandbox)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "threat-modeler": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-threat-modeler/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

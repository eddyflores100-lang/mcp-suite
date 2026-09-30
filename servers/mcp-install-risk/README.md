# Install Risk

> Clasifica el riesgo de instalar cualquier paquete/comando antes de ejecutarlo

**Categoría:** MarketNow Ops · **ID:** `mcp-install-risk`

**Dolor de agente que resuelve:** npm install a ciegas rompe entornos e instala malware: falta una capa de clasificación de riesgo previa a toda instalación.

## Tools (3 incl. health_check)

### `classify_command`
Clasifica cualquier comando shell en tier de riesgo de instalación (safe/caution/risky/dangerous) con reglas explicadas.

**Parámetros:**
  - `comando` (string, requerido): Comando completo a clasificar

### `safer_alternative`
Sugiere una versión más segura de un comando riesgoso: fijar versión, quitar sudo/force, evitar pipe-to-shell.

**Parámetros:**
  - `comando` (string, requerido): Comando a mejorar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "install-risk": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-install-risk/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

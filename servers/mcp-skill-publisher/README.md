# Skill Publisher

> Prepara tu skill para publicar en MarketNow: checklist L1, manifest y readme generados

**Categoría:** MarketNow Ops · **ID:** `mcp-skill-publisher`

**Dolor de agente que resuelve:** Publicar una skill requiere README, manifest, licencia y checks de seguridad: mucha fricción para el dev que quiere monetizar.

## Tools (4 incl. health_check)

### `check_readiness`
Evalúa si tu skill está lista para publicar: exige nombre, descripción, install command, licencia y repo. Checklist completo.

**Parámetros:**
  - `skill` (any, requerido): Datos de la skill: {name, description, install, license, repository}

### `generate_manifest`
Genera un package.json pulido para publicar como skill MCP: metadata completa, bin, keywords mcp.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del paquete (sin @scope)
  - `version` (string, opcional): Versión semver
  - `descripcion` (string, requerido): Descripción de la skill
  - `licencia` (string, opcional): Licencia
  - `repo` (string, opcional): URL del repositorio
  - `autor` (string, opcional): Nombre del autor

### `readme_template`
Genera un README.md de plantilla de alta conversión para tu skill (qué resuelve, tools, install, config).

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la skill
  - `resuelve` (string, requerido): Qué problema resuelve
  - `install_cmd` (string, requerido): Comando de instalación

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "skill-publisher": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-skill-publisher/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

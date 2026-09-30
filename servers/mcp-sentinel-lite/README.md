# Sentinel Lite

> Escáner estático de skills/paquetes con las reglas de estilo Sentinel L1: 10 checks reproducibles

**Categoría:** MarketNow Ops · **ID:** `mcp-sentinel-lite`

**Dolor de agente que resuelve:** Publicar o instalar una skill sin auto-auditoría: el pipeline Sentinel existe en MarketNow pero el dev necesita escanear ANTES de publicar/instalar.

## Tools (4 incl. health_check)

### `scan_manifest`
Escanea un package.json (o manifest similar) contra los 10 checks L1: nombre, versión, licencia, descripción, repo, scripts peligrosos, deps. Devuelve score 0-10.

**Parámetros:**
  - `manifest` (any, requerido): Objeto package.json

### `scan_file`
Escanea el CONTENIDO de un archivo (código/README/config) buscando secrets y patrones maliciosos. Devuelve hallazgos por severidad.

**Parámetros:**
  - `nombre` (string, requerido): Nombre del archivo
  - `contenido` (string, requerido): Contenido a escanear

### `scan_install`
Escanea un comando de instalación (npx/npm/pip/curl) contra las reglas de riesgo de MarketNow: flags, fuentes, versiones.

**Parámetros:**
  - `comando` (string, requerido): Comando de instalación

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "sentinel-lite": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-sentinel-lite/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Escanea manifest (package.json), archivos de texto (README, código) y comandos de instalación con checks L1: README, manifest, licencia, secrets, patrones maliciosos, install documentado, deps sanas.

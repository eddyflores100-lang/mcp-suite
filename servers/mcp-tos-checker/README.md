# ToS & Robots Checker

> Respeta robots.txt y términos: scraping legal antes de raspar

**Categoría:** Seguridad · **ID:** `mcp-tos-checker`

**Dolor de agente que resuelve:** El agente scrapea sin consultar robots.txt ni ToS: riesgo legal y de ban. Falta un check previo estandarizado.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (3 incl. health_check)

### `can_fetch`
Consulta robots.txt del dominio en vivo y evalúa si un user-agent puede fetch una ruta dada.

**Parámetros:**
  - `url` (string, requerido): URL que quieres fetch
  - `user_agent` (string, opcional): User agent

### `summarize_tos`
Busca en los ToS/robots en vivo las cláusulas relevantes para scraping: prohibiciones, rate limits, API oficial.

**Parámetros:**
  - `dominio` (string, requerido): Dominio a revisar (ej: example.com)

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "tos-checker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-tos-checker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

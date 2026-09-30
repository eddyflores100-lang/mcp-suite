# Citation Checker

> Extrae, formatea y verifica citas y URLs de cualquier texto

**Categoría:** Calidad de Salida · **ID:** `mcp-citation-checker`

**Dolor de agente que resuelve:** Los LLM inventan URLs y citas (alucinación de fuentes): sin verificación, el usuario propaga información falsa.

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (4 incl. health_check)

### `extract_citations`
Extrae todas las URLs y referencias de un texto, las deduplica y las clasifica (http, dominio, markdown link, DOI).

**Parámetros:**
  - `texto` (string, requerido): Texto con posibles citas

### `check_urls`
Verifica en vivo (HEAD/GET) si las URLs citadas existen realmente. Devuelve status HTTP por URL.

**Parámetros:**
  - `urls` (array, requerido): Lista de URLs a verificar

### `format_citations`
Formatea una lista de referencias en estilo consistente (APA-lite o markdown) a partir de {titulo, url, fecha}.

**Parámetros:**
  - `referencias` (array, requerido): Lista de {titulo, url, fecha?}
  - `estilo` (enum, opcional): Estilo

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "citation-checker": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-citation-checker/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

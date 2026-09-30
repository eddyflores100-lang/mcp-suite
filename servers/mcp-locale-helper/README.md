# Locale Helper

> Glossario y reglas de localización ES/EN/FR: formatos y consistencia terminológica

**Categoría:** Comunicación y Humano · **ID:** `mcp-locale-helper`

**Dolor de agente que resuelve:** El agente mezcla formatos de fecha/número entre idiomas y traduce términos clave inconsistentemente: el glossario vive en ninguna parte.

> Estado persistente en `~/.mcp-suite/locale-helper/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `add_glossary`
Añade términos al glossario multilingüe (es/en/fr) para traducciones consistentes.

**Parámetros:**
  - `es` (string, requerido): Término en español
  - `en` (string, opcional): En inglés
  - `fr` (string, opcional): En francés
  - `nota` (string, opcional): Nota de uso

### `lookup_glossary`
Busca un término en el glossario y devuelve sus equivalentes + nota de uso.

**Parámetros:**
  - `termino` (string, requerido): Término (cualquier idioma)

### `locale_rules`
Reglas de formato por locale: fechas, números, moneda y unidades (es-EC, es-ES, en-US, fr-CA, fr-FR).

**Parámetros:**
  - `locale` (enum, requerido): Locale
  - `ejemplo_fecha` (string, opcional): Fecha ISO a formatear

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "locale-helper": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-locale-helper/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

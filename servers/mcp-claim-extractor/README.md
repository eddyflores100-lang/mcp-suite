# Claim Extractor

> Extrae afirmaciones verificables del texto: el primer paso contra la alucinación

**Categoría:** Calidad de Salida · **ID:** `mcp-claim-extractor`

**Dolor de agente que resuelve:** Para verificar hechos primero hay que identificar qué claims se afirmaron: nadie separa opiniones de afirmaciones verificables.

## Tools (3 incl. health_check)

### `extract_claims`
Divide un texto en oraciones y extrae las afirmaciones verificables (con números, entidades o verbos factuales), marcando verificación sugerida.

**Parámetros:**
  - `texto` (string, requerido): Texto a analizar

### `classify_verifiability`
Clasifica una afirmación en: verificable-empíricamente / verificable-lógicamente / opinión / especulación.

**Parámetros:**
  - `afirmacion` (string, requerido): Afirmación a clasificar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "claim-extractor": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-claim-extractor/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

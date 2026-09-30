# Trust Verification Pipeline

> Pipeline de 12 etapas de verificación de credenciales al estilo UTA de MarketNow

**Categoría:** MarketNow Trust · **ID:** `mcp-verification-pipeline`

**Dolor de agente que resuelve:** Verificar una credencial de agente requiere combinar muchas comprobaciones (sintaxis, firma, vigencia, emisor, revocación...): nadie las orquesta.

## Tools (3 incl. health_check)

### `run_pipeline`
Ejecuta las 12 etapas de verificación sobre una credencial JSON y devuelve el resultado por etapa + veredicto final (CONFIABLE / REVISAR / RECHAZAR).

**Parámetros:**
  - `credential` (any, requerido): Credencial a verificar
  - `min_score` (number, opcional): Score mínimo exigido

### `stages_reference`
Documentación de las 12 etapas del pipeline: qué valida cada una y qué hacer si falla.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "verification-pipeline": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-verification-pipeline/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Ejecuta 12 etapas en orden sobre un JSON: syntax, schema, canonicalización, firma, vigencia, emisor, revocación, frescura, score, capabilities, replay y cadena. Devuelve pass/fail/warn por etapa y veredicto.

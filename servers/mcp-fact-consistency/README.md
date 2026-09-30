# Fact Consistency

> Detecta contradicciones entre dos textos o entre claims: coherencia interna

**Categoría:** Calidad de Salida · **ID:** `mcp-fact-consistency`

**Dolor de agente que resuelve:** El agente se contradice entre secciones (o contra una fuente): las inconsistencias numéricas y factuales pasan inadvertidas.

## Tools (3 incl. health_check)

### `check_consistency`
Compara dos textos y reporta contradicciones: números que difieren sobre mismos sujetos, hechos opuestos y entidades renombradas.

**Parámetros:**
  - `texto_a` (string, requerido): Primer texto
  - `texto_b` (string, requerido): Segundo texto

### `merge_facts`
Fusiona dos listas de hechos {hecho, fuente} deduplicando y marcando duplicados con fuentes distintas (consenso) o contradictorias.

**Parámetros:**
  - `hechos_a` (array, requerido): Hechos A {hecho, fuente}
  - `hechos_b` (array, requerido): Hechos B {hecho, fuente}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "fact-consistency": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-fact-consistency/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

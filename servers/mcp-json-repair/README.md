# JSON Repair

> Repara JSON roto de LLMs: comillas, comas, truncados y fences

**Categoría:** Calidad de Salida · **ID:** `mcp-json-repair`

**Dolor de agente que resuelve:** El JSON que devuelve un LLM viene con markdown fences, comas colgantes y strings sin cerrar: cada parse falla.

## Tools (3 incl. health_check)

### `repair`
Repara JSON roto: quita fences de código, elimina comas colgantes, cierra llaves/corchetes/quotes truncados (algoritmo de stack de brackets) y corrige comillas tipográficas.

**Parámetros:**
  - `texto` (string, requerido): JSON (posiblemente roto) a reparar

### `extract_json`
Extrae el primer JSON válido de un texto ruidoso (dentro de fences, prosa o logs).

**Parámetros:**
  - `texto` (string, requerido): Texto que contiene JSON en alguna parte

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "json-repair": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-json-repair/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

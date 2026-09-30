# Tenant Data Tagger

> Etiqueta cada dato con su inquilino y verifica que lo DERIVADO también la lleva: la etiqueta se propaga o no es confianza

**Categoría:** Multi-Tenant · **ID:** `mcp-tenant-data-tagger`

**Dolor de agente que resuelve:** El dato original lleva tenant en su id, pero el resumen que el agente hizo de ese dato ya no lleva nada: al reutilizarlo para otro cliente, la fuga es perfecta porque la procedencia se evaporó.

> Estado persistente en `~/.mcp-suite/tenant-data-tagger/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `tag_data`
Etiqueta un dato con su inquilino y clasificación de sensibilidad.

**Parámetros:**
  - `dato` (string, requerido): Identificador del dato (ruta, id, clave de caché)
  - `tenant` (string, requerido): Inquilino dueño
  - `clasificacion` (enum, opcional): Sensibilidad
  - `descripcion` (string, opcional): Qué contiene

### `declare_derived`
Declara que un dato DERIVA de otros: la etiqueta debe heredarse del más sensible.

**Parámetros:**
  - `dato_derivado` (string, requerido): Dato derivado (resumen, embedding, caché)
  - `fuentes` (array, requerido): Ids de los datos de origen

### `check_propagation`
Verifica la trazabilidad de un dato: ¿de dónde viene y conserva la etiqueta correcta?

**Parámetros:**
  - `dato` (string, requerido): Dato a verificar

### `untagged_scan`
Escanea un conjunto de ids de datos y devuelve los que están sin etiqueta (puntos de fuga).

**Parámetros:**
  - `candidatos` (array, requerido): Ids de datos que el agente quiere usar ahora

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "tenant-data-tagger": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-tenant-data-tagger/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/tenant-data-tagger/. Registro de datos con tenant+clasificación; verificación de propagación (los derivados declaran fuentes) y escáner de datos sin etiqueta.

# Analogy Finder

> Analogías ESTRUCTURALES: mapea relaciones entre dominios (no palabras sueltas) y delimita qué se transfiere y qué no

**Categoría:** Razonamiento · **ID:** `mcp-analogy-finder`

**Dolor de agente que resuelve:** El agente razona por analogía superficial: 'esto es como Netflix' porque ambas cosas tienen suscripciones, y transfiere conclusiones de un dominio a otro sin comprobar que las RELACIONES se corresponden. La analogía falsa es la falacia más productiva que existe.

> Estado persistente en `~/.mcp-suite/analogy-finder/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `register_case`
Registra un caso/dominio con sus entidades y relaciones internas.

**Parámetros:**
  - `caso` (string, requerido): Nombre del caso/dominio
  - `entidades` (array, requerido): Entidades principales {nombre, rol}
  - `relaciones` (array, requerido): Relaciones {desde, tipo, hacia} — el tipo ES la estructura (pagar, competir, depender...)
  - `desenlace` (string, opcional): Cómo terminó ese caso (si se sabe)

### `find_analogy`
Busca el caso registrado cuya ESTRUCTURA relacional coincide con tu situación actual.

**Parámetros:**
  - `entidades_actuales` (array, requerido): Entidades de tu situación {nombre, rol}
  - `relaciones_actuales` (array, requerido): Relaciones {desde, tipo, hacia}

### `map_transfer`
Para una analogía concreta: qué conocimiento se transfiere y qué se queda en casa.

**Parámetros:**
  - `caso` (string, requerido): Caso análogo registrado
  - `correspondencias` (array, requerido): Mapeo declarado {entidad_o_relacion_del_caso, equivalente_actual}

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "analogy-finder": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-analogy-finder/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/analogy-finder/. Casos con entidades y relaciones tipadas; el matching estructural exige correspondencia de relaciones (no de nombres); la validación separa lo que se transfiere de lo que no.

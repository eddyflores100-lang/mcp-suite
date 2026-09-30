# Spec Clarifier

> Detecta ambigüedad en especificaciones y genera las preguntas de clarificación correctas

**Categoría:** Especificación y Requisitos · **ID:** `mcp-spec-clarifier`

**Dolor de agente que resuelve:** El humano escribe specs vagas ('hazlo bonito', 'mejora el rendimiento') y el agente adivina. La causa raíz #1 de fallo multi-agente es la ambigüedad de especificación, no la infraestructura.

## Tools (6 incl. health_check)

### `analyze_spec`
Analiza una especificación y devuelve ambigüedades concretas clasificadas (vaguedad, cuantificación, referencia, contradicción) y score de claridad.

**Parámetros:**
  - `spec` (string, requerido): Texto de la especificación

### `generate_questions`
Genera la lista de preguntas de clarificación priorizadas (bloqueantes primero) listas para enviar al humano.

**Parámetros:**
  - `spec` (string, requerido): Especificación original
  - `max_preguntas` (number, opcional): Límite de preguntas

### `operationalize`
Convierte una frase vaga en una definición operacional medible (plantillas por tipo de vaguedad).

**Parámetros:**
  - `frase` (string, requerido): Frase vaga (ej: 'debe ser rápido')
  - `dominio` (string, opcional): Contexto (web, api, datos, ux)

### `contradiction_check`
Detecta requisitos contradictorios o incompatibles entre sí dentro de la spec.

**Parámetros:**
  - `requisitos` (array, requerido): Lista de requisitos en texto

### `nfr_checklist`
Checklist de requisitos no funcionales que la spec omite (rendimiento, seguridad, accesibilidad, datos...).

**Parámetros:**
  - `spec` (string, requerido): Especificación a auditar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "spec-clarifier": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-spec-clarifier/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Análisis léxico-heurístico sin LLM: detecta vaguedad (adverbios blandos), cuantificadores ausentes, referencias sin definición, requisitos contradictorios y missing NFRs. Genera preguntas listas para enviar al humano.

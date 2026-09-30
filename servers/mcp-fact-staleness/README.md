# Fact Staleness

> Validez temporal de hechos: cada dato caduca y el agente debe saber cuándo ya no sirve

**Categoría:** Frescura del Conocimiento · **ID:** `mcp-fact-staleness`

**Dolor de agente que resuelve:** El agente trata todos los hechos como eternos: cita un dato de 2023 como vigente, mezcla precios antiguos con actuales y no sabe qué parte de su conocimiento ya venció.

> Estado persistente en `~/.mcp-suite/fact-staleness/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `register_fact`
Registra un hecho con su fuente, fecha de observación y clase (que determina su vida media).

**Parámetros:**
  - `hecho` (string, requerido): El hecho en una frase
  - `valor` (string, requerido): Valor/dato concreto
  - `clase` (enum, requerido): Clase de hecho
  - `fuente` (string, requerido): De dónde se obtuvo
  - `observado` (string, opcional): Fecha ISO en que se observó

### `check_freshness`
Evalúa la frescura de los hechos registrados: frescos, a punto de caducar y ya vencidos.

### `refresh_fact`
Re-verifica un hecho: nuevo valor + fuente + fecha, dejando auditoría del cambio.

**Parámetros:**
  - `id` (string, requerido): ID del hecho
  - `nuevo_valor` (string, requerido): Valor re-verificado
  - `fuente` (string, requerido): Fuente de la verificación
  - `sin_cambio` (boolean, opcional): true si se confirmó igual

### `assert_usable`
Antes de usar un hecho en una respuesta: ¿sigue siendo utilizable o hay que re-verificarlo?

**Parámetros:**
  - `id` (string, requerido): ID del hecho

### `staleness_report`
Reporte por clase de hecho: qué clases de conocimiento se mantienen al día y cuáles no.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "fact-staleness": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-fact-staleness/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/fact-staleness/. Hechos con vida-media por clase (precio 7d, métrica 30d, hecho estructural ∞); calcula frescura, vencidos y exige re-verificación.

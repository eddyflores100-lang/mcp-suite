# Turn State Machine

> Gobierno de turnos para agentes de voz: quién habla, cuándo callar, cómo procesar la interrupción sin perder el hilo

**Categoría:** Multimodal & Voz · **ID:** `mcp-turn-state-machine`

**Dolor de agente que resuelve:** El agente de voz sigue hablando cuando el usuario ya lo interrumpió, o responde al silencio con monólogos en cadena: el turn-taking es una máquina de estados y casi nadie la modela, se improvisa con ifs.

> Estado persistente en `~/.mcp-suite/turn-state-machine/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `new_session`
Crea una sesión de diálogo de voz con política de turnos.

**Parámetros:**
  - `sesion` (string, requerido): Id de sesión
  - `silencio_max_seg` (number, opcional): Segundos de silencio del usuario antes de ceder turno
  - `tolera_interrupcion` (boolean, opcional): ¿El usuario puede interrumpir al agente?

### `handle_event`
Procesa un evento de turno y devuelve la transición con la acción correcta para el agente.

**Parámetros:**
  - `sesion` (string, requerido): Sesión
  - `evento` (enum, requerido): Evento ocurrido
  - `detalle` (string, opcional): Detalle del evento (duración del silencio, texto escuchado...)

### `current_state`
Estado actual de la sesión y eventos legales desde ahí.

**Parámetros:**
  - `sesion` (string, requerido): Sesión

### `session_log`
Traza completa de transiciones para depurar el comportamiento del diálogo.

**Parámetros:**
  - `sesion` (string, requerido): Sesión
  - `ultimos` (number, opcional): Últimos N eventos

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "turn-state-machine": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-turn-state-machine/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/turn-state-machine/. Sesiones de diálogo con estados ESCUCHANDO/PENSANDO/HABLANDO/ESPERANDO_CONFIRMACION y eventos legales por transición; detecta interrupciones (barge-in), silencios y compulsión de respuesta.

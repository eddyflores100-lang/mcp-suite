# Agent Passport

> Pasaporte portable del agente: identidad, capacidades declaradas, sellos de entrada/salida y verificación de integridad

**Categoría:** Identidad Federada · **ID:** `mcp-agent-passport`

**Dolor de agente que resuelve:** Cuando un agente llega a otra orquestación no hay forma portable de presentarse: quién eres, qué sabes hacer, dónde has estado, quién te avala. Cada sistema vuelve a preguntarlo todo y nada es verificable.

> Estado persistente en `~/.mcp-suite/agent-passport/state.json` (local, privado, tuya la data).

## Tools (6 incl. health_check)

### `create_passport`
Emite un pasaporte para un agente con identidad y vigencia.

**Parámetros:**
  - `agente` (string, requerido): Identidad del agente (did o nombre único)
  - `emisor` (string, requerido): Quién emite el pasaporte (organización raíz)
  - `vigencia_dias` (number, opcional): Días de validez

### `add_claim`
Añade una capacidad o mérito al pasaporte (con nivel demostrado, no auto-declarado).

**Parámetros:**
  - `numero` (string, requerido): Número de pasaporte (P-00001)
  - `claim` (string, requerido): Capacidad (ej: navegacion-web-segura)
  - `nivel` (enum, requerido): Nivel demostrado
  - `evidencia` (string, opcional): Evidencia o fuente del nivel

### `stamp`
Sella una entrada/salida: dónde operó el agente, cuándo y con qué resultado.

**Parámetros:**
  - `numero` (string, requerido): Pasaporte
  - `sistema` (string, requerido): Sistema/orquestación visitada
  - `tipo` (enum, requerido): Tipo de sello
  - `resultado` (string, opcional): Resultado de la visita (ok, con incidente, expulsado)

### `verify_passport`
Verifica un pasaporte: integridad (checksum), vigencia y nivel de confianza según claims e incidentes.

**Parámetros:**
  - `numero` (string, requerido): Pasaporte a verificar

### `annul_passport`
Anula un pasaporte (robo, desmantelamiento del agente, fraude).

**Parámetros:**
  - `numero` (string, requerido): Pasaporte
  - `motivo` (string, requerido): Motivo de anulación

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "agent-passport": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-agent-passport/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/agent-passport/. El pasaporte agrupa identidad + claims + sellos con un checksum interno (SHA-256 sobre contenido canónico); la verificación detecta manipulación y caducidad.

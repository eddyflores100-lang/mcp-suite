# Data Residency Check

> Verifica a dónde van los datos: restricciones de residencia geográfica y transferencias válidas

**Categoría:** Cumplimiento · **ID:** `mcp-data-residency-check`

**Dolor de agente que resuelve:** El agente envía datos a APIs sin saber en qué país procesan: viola requisitos de residencia de datos (GDPR, soberanía) sin enterarse hasta la auditoría.

> Estado persistente en `~/.mcp-suite/data-residency-check/state.json` (local, privado, tuya la data).

## Tools (4 incl. health_check)

### `register_destination`
Registra un destino de datos (API/servicio) con su jurisdicción y regiones de procesamiento.

**Parámetros:**
  - `destino` (string, requerido): Nombre del servicio/API
  - `jurisdiccion` (string, requerido): País/jurisdicción principal (US, EU, CN, LOCAL...)
  - `regiones` (array, opcional): Regiones donde procesa datos
  - `nota` (string, opcional): Detalles del procesamiento

### `check_transfer`
Valida enviar un dato a un destino según su restricción de residencia.

**Parámetros:**
  - `dato` (string, requerido): Tipo de dato (pii_ec, salud, financiero, anonimizado...)
  - `restriccion` (enum, requerido): Restricción del dato
  - `destino` (string, requerido): Destino registrado

### `flow_map`
Mapa de flujos de datos: qué tipo de datos va a qué destinos y con qué estado de cumplimiento.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "data-residency-check": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-data-residency-check/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/data-residency-check/. Catálogo de destinos con jurisdicción/region; valida transferencias contra restricciones del dato (solo-UE, solo-local, no-China...) y genera mapa de flujos.

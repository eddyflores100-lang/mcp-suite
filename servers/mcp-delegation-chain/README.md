# Delegation Chain

> Delegación de capacidades verificable: cadenas de 'puedo hacer X porque me lo delegó Y' con expiración y estrechamiento

**Categoría:** Identidad Federada · **ID:** `mcp-delegation-chain`

**Dolor de agente que resuelve:** El agente subordinado actúa 'en nombre de' su principal sin prueba verificable: ni alcance exacto, ni caducidad, ni límite de profundidad. Cualquier agente intermedio puede inflar sus poderes y nadie lo detecta.

> Estado persistente en `~/.mcp-suite/delegation-chain/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `mint_delegation`
Emite una delegación: quién delega, sobre quién, qué alcance y hasta cuándo.

**Parámetros:**
  - `delegante` (string, requerido): Agente que delega (principal o intermediario)
  - `delegado` (string, requerido): Agente que recibe la capacidad
  - `alcance` (string, requerido): Capacidad delegada (ej: lectura:clientes-EC)
  - `expira_horas` (number, opcional): Vigencia en horas (0 = sin expiración)

### `verify_chain`
Verifica la cadena completa de una delegación: validez, expiración, profundidad y estrechamiento de alcance.

**Parámetros:**
  - `delegado_final` (string, requerido): Agente cuya autoridad se cuestiona
  - `alcance_requerido` (string, requerido): Capacidad que quiere ejercer
  - `raiz_confiable` (string, opcional): Principal raíz de confianza
  - `max_profundidad` (number, opcional): Profundidad máxima de re-delegación

### `revoke_delegation`
Revoca una delegación concreta (las cadenas que pasan por ella caen).

**Parámetros:**
  - `id` (string, requerido): Id de la delegación (dlg_0001)
  - `motivo` (string, requerido): Motivo de revocación

### `chain_view`
Visualiza el árbol de delegaciones desde una raíz o para un agente.

**Parámetros:**
  - `agente` (string, opcional): Raíz o agente de interés

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "delegation-chain": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-delegation-chain/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/delegation-chain/. Árbol de delegaciones {delegante, delegado, alcance, expira, profundidad}; la verificación recorre la cadena hasta la raíz y falla ante expiración, ensanchamiento de alcance o profundidad excesiva.

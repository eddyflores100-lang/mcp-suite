# Bayesian Updater

> Cree con números: hipótesis con prior, evidencias con verosimilitud y posteriores que se actualizan con traza explicada

**Categoría:** Razonamiento · **ID:** `mcp-bayesian-updater`

**Dolor de agente que resuelve:** El agente dice 'ahora estoy más seguro' sin números: sin prior ni verosimilitud, la 'actualización de creencia' es teatro. Cuando llega evidencia contradictoria no sabe si reforzar o abandonar la hipótesis.

> Estado persistente en `~/.mcp-suite/bayesian-updater/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `define_hypothesis`
Define una hipótesis con su probabilidad a priori y justificación.

**Parámetros:**
  - `hipotesis` (string, requerido): Enunciado de la hipótesis
  - `prior` (number, requerido): Probabilidad inicial 0-1
  - `justificacion_prior` (string, requerido): Por qué ese prior (base rate, historia, intuición experta)

### `apply_evidence`
Aplica una evidencia con su verosimilitud P(E|H) vs P(E|no H) y actualiza el posterior.

**Parámetros:**
  - `hipotesis` (string, requerido): Hipótesis a actualizar
  - `evidencia` (string, requerido): Descripción de la evidencia observada
  - `p_e_dado_h` (number, requerido): P(E | hipótesis cierta) 0-1
  - `p_e_dado_no_h` (number, requerido): P(E | hipótesis falsa) 0-1
  - `fuente` (string, opcional): De dónde viene la evidencia

### `posterior_view`
Ranking de todas las hipótesis por posterior actual, con su historial de evidencias.

### `explain_update`
Explica la evolución completa de una hipótesis: cada salto, su evidencia y su dirección.

**Parámetros:**
  - `hipotesis` (string, requerido): Hipótesis

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "bayesian-updater": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-bayesian-updater/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/bayesian-updater/. Hipótesis con probabilidad a priori; cada evidencia aplica su likelihood ratio en espacio log-odds; la traza explica cada salto y detecta evidencia doblemente contada.

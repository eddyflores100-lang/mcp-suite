# Canary Deployer

> Despliega cambios de agente al 10% del tráfico, mide, y decide con datos: promover o revertir

**Categoría:** Agent CI/CD · **ID:** `mcp-canary-deployer`

**Dolor de agente que resuelve:** El prompt nuevo se despliega al 100% de golpe: si degrada la calidad, se entera por las quejas de los usuarios con horas de daño. El canary clásico del backend jamás llegó al mundo de los agentes.

> Estado persistente en `~/.mcp-suite/canary-deployer/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `start_canary`
Inicia un canary: variante A (control) vs B (candidata) con % inicial de tráfico.

**Parámetros:**
  - `sistema` (string, requerido): Qué se despliega (prompt, herramienta, configuración)
  - `control` (string, requerido): Identificador de la versión estable (A)
  - `candidata` (string, requerido): Identificador de la versión nueva (B)
  - `pct_inicial` (number, opcional): % de tráfico inicial a la candidata
  - `min_muestras` (number, opcional): Muestras mínimas por variante antes de decidir
  - `tolerancia_pct` (number, opcional): Pérdida máxima tolerada en la métrica principal

### `record_result`
Registra el resultado de una ejecución real bajo una variante.

**Parámetros:**
  - `id` (string, requerido): Id del canary
  - `variante` (enum, requerido): Variante que sirvió la ejecución
  - `exito` (boolean, requerido): ¿La ejecución cumplió su objetivo?
  - `latencia_ms` (number, opcional): Tiempo total
  - `calidad` (number, opcional): Score de calidad 0-100 si lo mides

### `evaluate_canary`
Evalúa el canary con banda de tolerancia: PROMOVER, MANTENER (más muestras) o ABORTAR.

**Parámetros:**
  - `id` (string, requerido): Id del canary
  - `auto_escala` (boolean, opcional): Si se mantiene: sugerir subir el % de tráfico

### `close_canary`
Cierra el canary con la decisión final aplicada (promovido o abortado).

**Parámetros:**
  - `id` (string, requerido): Id del canary
  - `decision` (enum, requerido): Decisión final
  - `nota` (string, opcional): Nota de cierre

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "canary-deployer": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-canary-deployer/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/canary-deployer/. Lanzamientos canary con % de tráfico, resultados por variante (éxito, latencia, calidad) y criterio de decisión estadístico (banda de tolerancia) para promover o abortar.

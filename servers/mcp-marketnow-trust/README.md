# MarketNow · Trust & Riesgo

> Clasificación de confianza del marketplace: safe/caution/risky/dangerous con evidencia

**Categoría:** MarketNow · **ID:** `mcp-marketnow-trust`

**Dolor de agente que resuelve:** Discovery está resuelto pero la confianza no: un agente necesita saber si una skill es segura antes de instalarla (install-risk).

> Este servidor hace peticiones HTTP en vivo (ver descripción de cada tool). Requiere conexión a internet.

## Tools (5 incl. health_check)

### `get_audit_report`
Descarga el reporte de transparencia en vivo de MarketNow (GET /api/audit-report.json): totales por clasificación safe/caution/risky/dangerous y ejemplos.

### `classify_skill_risk`
Mapea un sentinel_score (0-10) al tier de riesgo de MarketNow (dangerous <3, risky <5, caution <8, safe >=8) y explica qué revisar antes de instalar.

**Parámetros:**
  - `score` (number, requerido): Sentinel score de la skill (0-10)

### `compare_trust`
Compara dos skills (score, tier, verificación, licencia) y recomienda cuál instalar primero. Acepta datos que traigas del catálogo.

**Parámetros:**
  - `nombre_a` (string, requerido): Nombre skill A
  - `score_a` (number, requerido): Sentinel score A
  - `nombre_b` (string, requerido): Nombre skill B
  - `score_b` (number, requerido): Sentinel score B

### `risk_digest`
Resumen ejecutivo del estado de riesgo del marketplace: proporciones por tier y alertas (skills dangerous/risky presentes).

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "marketnow-trust": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-marketnow-trust/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Envuelve /api/audit-report.json en vivo (transparencia real: safe 8238, caution 874, risky 54, dangerous 81 sobre 9248 skills auditadas) y mapea sentinel_score → tier de riesgo.

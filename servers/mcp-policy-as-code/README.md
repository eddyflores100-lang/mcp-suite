# Policy As Code

> Políticas ejecutables para agentes regulados: cada acción se valida contra reglas, no contra intuición

**Categoría:** Cumplimiento · **ID:** `mcp-policy-as-code`

**Dolor de agente que resuelve:** En industrias reguladas la política vive en PDFs que el agente nunca lee: cada acción es un riesgo de incumplimiento porque las reglas no son ejecutables por la máquina.

> Estado persistente en `~/.mcp-suite/policy-as-code/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `add_policy`
Añade una política ejecutable: condición sobre atributos de la acción y veredicto.

**Parámetros:**
  - `nombre` (string, requerido): Nombre de la política
  - `descripcion` (string, requerido): Qué controla
  - `condicion` (string, requerido): Condición sobre atributos (ej: 'datos=pii y destino=externo')
  - `veredicto` (enum, requerido): Resultado si aplica
  - `marco` (string, opcional): Marco de referencia (HIPAA, GDPR, SOX, interno)

### `evaluate_action`
Evalúa una acción contra todas las políticas: veredicto final (más restrictivo gana) con trazas.

**Parámetros:**
  - `accion` (string, requerido): Acción contemplada
  - `atributos` (any, requerido): Atributos {datos, destino, volumen, usuario...}

### `conflict_scan`
Detecta políticas que pueden disparar veredictos contradictorios para la misma acción.

### `compliance_log`
Registro de auditoría de decisiones de política: qué se evaluó, cuándo y con qué veredicto.

**Parámetros:**
  - `solo_bloqueos` (boolean, opcional): Solo negadas/requiere aprobación

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "policy-as-code": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-policy-as-code/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/policy-as-code/. Reglas condición→permitir/negar/requerir_aprobación sobre acciones con atributos; evaluación determinista con auditoría de cada decisión y reglas en conflicto.

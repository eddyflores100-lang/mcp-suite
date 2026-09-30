# Tenant Isolator

> Aislamiento de contexto por inquilino: cada sesión ligada a su tenant y todo acceso cruzado denegado con evidencia

**Categoría:** Multi-Tenant · **ID:** `mcp-tenant-isolator`

**Dolor de agente que resuelve:** El agente atiende a ClienteA y ClienteB en la misma memoria: el contexto de una filtración de datos entre tenants es silenciosa y total. 'Confío en que el prompt lo evita' no es aislamiento, es fe.

> Estado persistente en `~/.mcp-suite/tenant-isolator/state.json` (local, privado, tuya la data).

## Tools (5 incl. health_check)

### `register_tenant`
Registra un inquilino (cliente, usuario, departamento) del agente.

**Parámetros:**
  - `tenant` (string, requerido): Identificador único del tenant
  - `nombre_visible` (string, opcional): Nombre para mostrar
  - `clasificacion` (enum, opcional): Sensibilidad del tenant

### `bind_session`
Vincula una sesión/conversación a UN tenant (decisión inmutable por diseño).

**Parámetros:**
  - `sesion` (string, requerido): Id de sesión/conversación
  - `tenant` (string, requerido): Tenant al que pertenece

### `check_access`
Verifica que una sesión puede tocar un recurso: el dueño del recurso debe ser su tenant.

**Parámetros:**
  - `sesion` (string, requerido): Sesión que pide el acceso
  - `recurso` (string, requerido): Recurso al que se accede (id o ruta)
  - `dueño_recurso` (string, requerido): Tenant dueño del recurso
  - `operacion` (string, opcional): Operación (leer, escribir, borrar)

### `isolation_report`
Reporte de aislamiento: sesiones por tenant, violaciones y patrones sospechosos.

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "tenant-isolator": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-tenant-isolator/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Persiste en ~/.mcp-suite/tenant-isolator/. Registro de tenants y vinculación sesión→tenant; check_access valida que la sesión que pide un recurso pertenece al tenant dueño; reporte de intentos cruzados.

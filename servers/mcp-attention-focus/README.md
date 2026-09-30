# Attention Focus

> Prioriza qué merece atención: ranking de secciones del contexto por relevancia

**Categoría:** Memoria y Contexto · **ID:** `mcp-attention-focus`

**Dolor de agente que resuelve:** Todo el contexto pesa igual y nada destaca: el agente diluye la atención en irrelevantes.

## Tools (3 incl. health_check)

### `prioritize`
Rankea secciones {nombre, texto} por relevancia contra una consulta: coincidencias de términos, posición y densidad.

**Parámetros:**
  - `secciones` (array, requerido): Lista de {nombre, texto}
  - `consulta` (string, requerido): A qué hay que prestar atención

### `focus_window`
Construye la ventana de foco: las K secciones más relevantes concatenadas, listas para usar como contexto reducido.

**Parámetros:**
  - `secciones` (array, requerido): Lista de {nombre, texto}
  - `consulta` (string, requerido): Consulta
  - `k` (number, opcional): Cuántas secciones

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "attention-focus": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-attention-focus/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

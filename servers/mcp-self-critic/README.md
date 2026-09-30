# Self Critic

> El agente se critica a sí mismo: checklist de reflexión antes de entregar

**Categoría:** Calidad de Salida · **ID:** `mcp-self-critic`

**Dolor de agente que resuelve:** Sin reflexión previa a la entrega, el agente repite errores evitables (técnica reflect de los papers de agentes).

## Tools (3 incl. health_check)

### `critique`
Aplica checklist de autocrítica a una salida: rigor, completitud, sesgos, seguridad y accionabilidad. Genera issues concretos.

**Parámetros:**
  - `salida` (string, requerido): Salida a criticar
  - `tarea` (string, requerido): Tarea original que debía resolver

### `reflect_prompt`
Genera el prompt de reflexión (estilo Reflexion) para que el modelo mejore su salida en el siguiente intento.

**Parámetros:**
  - `tarea` (string, requerido): La tarea original
  - `intento` (string, requerido): El intento fallido
  - `feedback` (string, opcional): Qué salió mal

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "self-critic": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-self-critic/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

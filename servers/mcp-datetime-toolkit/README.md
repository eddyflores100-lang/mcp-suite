# Datetime Toolkit

> Fechas exactas: parse natural-ligero, formato, zonas horarias y días hábiles

**Categoría:** Utilidades · **ID:** `mcp-datetime-toolkit`

**Dolor de agente que resuelve:** Los LLM calculan mal 'qué día será en 30 días' o mezclan zonas horarias: las fechas de deadlines deben ser exactas.

## Tools (4 incl. health_check)

### `parse_date`
Parsea fechas en múltiples formatos a ISO: ISO, dd/mm/yyyy, 'hoy', 'mañana', 'pasado mañana', 'lunes próximo', 'hace N días'.

**Parámetros:**
  - `texto` (string, requerido): Fecha en texto
  - `zona` (string, opcional): Zona horaria IANA

### `add_days`
Suma/resta días (o business days) a una fecha ISO con exactitud de calendario.

**Parámetros:**
  - `fecha` (string, requerido): Fecha ISO (yyyy-mm-dd)
  - `dias` (number, requerido): Días a sumar (negativo resta)
  - `solo_habiles` (boolean, opcional): Solo días hábiles (L-V)

### `diff_dates`
Diferencia exacta entre dos fechas: días totales, días hábiles, semanas y meses aproximados.

**Parámetros:**
  - `desde` (string, requerido): Fecha ISO inicial
  - `hasta` (string, requerido): Fecha ISO final

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "datetime-toolkit": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-datetime-toolkit/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

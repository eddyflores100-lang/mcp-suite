# Safe Math

> Aritmética exacta del agente: evaluación, porcentajes y reglas de tres

**Categoría:** Utilidades · **ID:** `mcp-safe-math`

**Dolor de agente que resuelve:** Los LLM cometen errores aritméticos notorios: cualquier cifra importante debe calcularse con tool, no 'de cabeza'.

## Tools (4 incl. health_check)

### `evaluate`
Evalúa una expresión aritmética de forma segura con parser propio (sin eval): + - * / % ** y paréntesis.

**Parámetros:**
  - `expresion` (string, requerido): Expresión (ej: (1250 - 320) * 0.15)

### `percent_change`
Calcula variación porcentual exacta entre dos valores (con dirección y magnitud).

**Parámetros:**
  - `valor_inicial` (number, requerido): Valor inicial
  - `valor_final` (number, requerido): Valor final

### `rule_of_three`
Regla de tres directa/inversa: dado A→B, ¿qué corresponde a C?

**Parámetros:**
  - `a` (number, requerido): Valor A
  - `b` (number, requerido): Valor correspondiente a A
  - `c` (number, requerido): Nuevo valor de A
  - `inversa` (boolean, opcional): Proporcionalidad inversa

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "safe-math": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-safe-math/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

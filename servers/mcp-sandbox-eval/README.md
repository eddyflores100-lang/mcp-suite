# Sandbox Eval

> Evaluación matemática/lógica segura: nunca eval() sobre input del usuario

**Categoría:** Seguridad · **ID:** `mcp-sandbox-eval`

**Dolor de agente que resuelve:** Para calcular algo el agente recurre a eval() con input no confiable: RCE garantizado. Hace falta un parser seguro.

## Tools (3 incl. health_check)

### `safe_math`
Evalúa una expresión aritmética de forma segura (parser shunting-yard, sin eval): + - * / % ** paréntesis y funciones matemáticas.

**Parámetros:**
  - `expresion` (string, requerido): Expresión (ej: (2+3)*4^2 o round(3.7))

### `compare_expressions`
Compara dos expresiones matemáticas: ¿son iguales? (útil para verificar cálculos del LLM).

**Parámetros:**
  - `a` (string, requerido): Expresión A
  - `b` (string, requerido): Expresión B

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "sandbox-eval": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-sandbox-eval/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

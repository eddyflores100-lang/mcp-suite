# Viewport Verifier

> Verifica el estado visible esperado tras cada acción: el navegador dice lo que realmente se ve

**Categoría:** Computer Use · **ID:** `mcp-viewport-verifier`

**Dolor de agente que resuelve:** El agente asume que su acción funcionó porque no hubo error: pero el toast se cerró, el modal tapaba el botón, o el spinner seguía girando. Sin verificar el estado visible, el flujo 'avanza' roto.

## Tools (5 incl. health_check)

### `declare_expectation`
Declara la expectativa de estado visible tras una acción (para verificarla inmediatamente).

**Parámetros:**
  - `tras_accion` (string, requerido): Acción realizada
  - `debe_aparecer` (array, opcional): Elementos/textos que deben ser visibles
  - `debe_desaparecer` (array, opcional): Lo que ya no debe verse
  - `debe_contener_texto` (string, opcional): Texto que debe existir en la página

### `verify_viewport`
Verifica la expectativa contra lo observado (texto visible y elementos detectados) y explica discrepancias.

**Parámetros:**
  - `expectativa` (any, requerido): Expectativa declarada (objeto de declare_expectation)
  - `texto_visible` (string, requerido): Texto visible actual del viewport
  - `elementos_detectados` (array, opcional): Selectores/textos de elementos visibles

### `assert_page_ready`
Comprueba señales de página lista vs página ocupada (spinners, overlays, disabled) contra el texto/estado actual.

**Parámetros:**
  - `texto_o_estado` (string, requerido): Texto visible o snapshot de atributos del viewport

### `observed_report`
Compara lo que el agente CREE que pasó vs lo observado: convierte suposiciones en evidencia.

**Parámetros:**
  - `suposicion` (string, requerido): Lo que el agente cree que logró
  - `observado` (string, requerido): Lo que realmente se ve en pantalla

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "viewport-verifier": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-viewport-verifier/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Sin persistencia. Expectativas declaradas (qué debe ser visible/ausente/contenido) y verificación contra la observación del viewport con explicación de discrepancias.

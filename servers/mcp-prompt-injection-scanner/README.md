# Prompt Injection Scanner

> Detecta inyecciones de prompt en entradas externas antes de que lleguen al modelo

**Categoría:** Seguridad · **ID:** `mcp-prompt-injection-scanner`

**Dolor de agente que resuelve:** El texto externo (web, emails, docs) puede contener órdenes maliciosas al agente: prompt injection es el OWASP #1 de LLM.

## Tools (3 incl. health_check)

### `scan`
Escanea un texto en busca de intentos de prompt injection: override de instrucciones, jailbreaks conocidos, exfiltración y tool override. Score 0-100.

**Parámetros:**
  - `texto` (string, requerido): Texto externo a escanear

### `sanitize`
Sanitiza el texto sospechoso: neutraliza las frases de inyección detectadas y envuelve el contenido externo en delimitación.

**Parámetros:**
  - `texto` (string, requerido): Texto a sanitizar

## Instalación — Claude Desktop

```json
{
  "mcpServers": {
    "prompt-injection-scanner": {
      "command": "node",
      "args": ["<RUTA_AL_REPO>/servers/mcp-prompt-injection-scanner/dist/index.js"]
    }
  }
}
```

Cursor / Cline / Continue: misma configuración stdio (`command: node`).

## Notas técnicas

Servidor stdio autocontenido. Compila con `npm run build` dentro de la carpeta; el monorepo raíz ya entrega `dist/` precompilado.

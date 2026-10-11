# MCP Suite — piloto de herramientas locales para agentes

Integra cálculo, consultas JSON y conversiones en un cliente MCP mediante procesos locales stdio. La oferta inicial es **instalación e integración asistida con pruebas de aceptación**, con alcance definido antes de cotizar.

El repositorio contiene 229 servidores generados. Esa cantidad describe el catálogo, **no certifica 229 productos listos para producción**. La verificación de este piloto se limita a los casos automatizados de tres servidores.

## Empezar

Requiere Node.js 22 y npm.

```sh
npm ci --ignore-scripts
npm run verify:pilot
```

El comando compila `safe-math`, `json-toolkit` y `unit-convert`, verifica inicialización y salud MCP, y ejecuta pruebas funcionales y de rechazo de errores. No necesita claves ni acceso a proveedores externos durante las pruebas.

Configura cada servidor en tu cliente MCP como un proceso `node` con la ruta absoluta a su archivo compilado. Ejemplo de configuración para clientes que usan `mcpServers`:

```json
{
  "mcpServers": {
    "safe-math": {
      "command": "node",
      "args": ["/RUTA/ABSOLUTA/mcp-suite/servers/mcp-safe-math/dist/index.js"]
    }
  }
}
```

## Alcance comercial inicial

| Servicio | Entrega verificable |
| --- | --- |
| Diagnóstico de integración | Cliente objetivo, flujo elegido, entradas y criterios de aceptación acordados |
| Piloto local | Instalación de los tres servidores y demostración de los casos cubiertos por las pruebas |
| Integración a medida | Adaptación de un flujo del cliente, documentación de configuración y reporte de aceptación |
| Mantenimiento opcional | Actualizaciones y regresiones según contrato separado |

Para preparar una cotización, usar [el brief de piloto](docs/PILOT-BRIEF.md). El precio, plazo y soporte se acuerdan según el flujo; este repositorio no implementa cobro, licencias de pago ni reservas. El código conserva su licencia MIT: el servicio remunerado es el trabajo de integración y soporte.

## Cobertura y límites

- `safe-math`: evaluación aritmética, precedencia, signos, potencias, decimales, porcentajes y proporcionalidad directa; rechazo de sintaxis inválida y división por cero. Usa números JavaScript de precisión finita, no contabilidad decimal exacta.
- `json-toolkit`: consulta por propiedades e índices y ruta inexistente. Los filtros, comodines, merge y perfilado no forman parte de la aceptación comercial de este piloto.
- `unit-convert`: longitud, temperatura, datos y rechazo entre familias incompatibles. KB/MB/GB/TB son decimales; KiB/MiB/GiB son binarios; B representa bytes. Los factores de otras familias requieren validación específica para el uso previsto.
- Un `health_check` exitoso acredita conexión y respuesta básica, no corrección de todas las herramientas registradas.
- La aceptación final requiere ejecutar el flujo en el cliente MCP elegido. No se promete compatibilidad con cualquier cliente ni aptitud para decisiones críticas.

## Desarrollo

```sh
npm test                         # pruebas del verificador, sin compilar servidores
node tools/generator.mjs --only safe-math  # regenera solo ese servidor; conserva el catálogo global
npm run verify:pilot             # alcance comercial inicial
npm run verify                   # validación de specs, compilación y salud de todo el catálogo
```

La fuente de los servidores generados está en `tools/specs/`. Mantener los cambios tanto en la spec como en el servidor generado. La CI de esta propuesta valida únicamente el piloto. Los módulos excluidos de la reestructuración quedan fuera de estos cambios.

El [catálogo histórico](docs/CATALOG-LEGACY.md) y `publish/` conservan material previo de referencia. Sus cifras de ingresos, precios y afirmaciones de disponibilidad no constituyen una oferta vigente ni evidencia de validación. El alcance vigente es el de este README.

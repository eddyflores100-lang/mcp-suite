#!/usr/bin/env node
/**
 * MCP Server: Meeting Notes
 * Estructura notas de reunión: decisiones, acciones con dueño y temas aparcados
 *
 * Dolor que resuelve: Las notas de reunión son ríos de prosa: decisiones y acciones se pierden sin estructura.
 * Categoría: Comunicación y Humano | Generado por mcp-suite | id: meeting-notes
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";


// ——— helpers de respuesta ———
function ok(data: any) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg: any) {
  return { content: [{ type: "text" as const, text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true as const };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o: any): any[] { return Object.values(o); }
function __ents(o: any): [string, any][] { return Object.entries(o); }

const server = new McpServer({ name: "meeting-notes", version: "1.0.0" });

server.tool(
  "structure_notes",
  "Estructura notas crudas de reunión: detecta decisiones, action items (con dueño si aparece) y temas aparcados (parking lot).",
  {
  notas: z.string().describe("Notas crudas de la reunión"),
  reunion: z.string().describe("Título de la reunión").default("Reunión"),
  },
  async (args: any) => {
    const { notas, reunion } = args as any;
    const t = String(notas);
const oraciones = t.split(/[\n.!?]+/).map((s) => s.trim()).filter((s) => s.length > 5);
const decisiones = oraciones.filter((o) => /decidimos|acordamos|se aprobó|aprobado|queda definido|vamos con|elegimos|se resolvió/i.test(o));
const acciones = oraciones.filter((o) => /va a |hará|se encarga|queda a cargo|action item|to.?do|antes del|para el viernes|para la próxima|enviar|preparar/i.test(o));
const parking = oraciones.filter((o) => /lo vemos|más adelante|no es prioritario|lo dejamos|pendiente de|tablero|para otra/i.test(o));
const dueños = acciones.map((a) => { const m = a.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+(?:va a|hará|se encarga|queda)/); return m ? m[1] : null; });
return ok({ reunion: reunion || "Reunión", total_oraciones: oraciones.length, decisiones, acciones: acciones.map((a, i) => ({ accion: a, dueno: dueños[i] || "sin dueño asignado" })), parking_lot: parking, proximos_pasos: acciones.length ? "asigna deadlines a cada acción" : "sin acciones detectadas: ¿fue una reunión solo informativa?" });
  }
);

server.tool(
  "action_items",
  "Extrae SOLO las action items con su formato estandarizado: qué, quién, cuándo (si aparece).",
  {
  notas: z.string().describe("Notas"),
  },
  async (args: any) => {
    const { notas } = args as any;
    const t = String(notas);
const lineas = t.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
const items: any[] = [];
for (const l of lineas) {
  if (/^(?:-|\*|\d+[.)])\s+/.test(l) || /va a |hará|debe|action|todo|pendiente|encarg/i.test(l)) {
    const dueño = (l.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\b/) || [])[1] || "sin dueño";
    const fecha = (l.match(/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo|mañana|pasado mañana|\d{1,2}[/-]\d{1,2}|semana que viene|el \d+\b)/i) || [])[0] || "sin fecha";
    items.push({ que: l.replace(/^[-*\d.)\s]+/, ""), quien: dueño, cuando: fecha });
  }
}
return ok({ total: items.length, items: items.slice(0, 30), sin_dueño: items.filter((i) => i.quien === "sin dueño").length });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor meeting-notes está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "meeting-notes", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[meeting-notes] fatal:", e);
  process.exit(1);
});

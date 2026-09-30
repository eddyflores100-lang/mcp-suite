#!/usr/bin/env node
/**
 * MCP Server: Digest Writer
 * Dígestos ejecutivos: convierte una lista de items en resumen digerible priorizado
 *
 * Dolor que resuelve: 50 actualizaciones no leídas = 0 información: falta un digest que priorice y agrupe.
 * Categoría: Comunicación y Humano | Generado por mcp-suite | id: digest-writer
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

const server = new McpServer({ name: "digest-writer", version: "1.0.0" });

server.tool(
  "digest",
  "Genera un digest de items {titulo, detalle, prioridad, categoria}: agrupado por categoría, priorizado y con top-3 destacado.",
  {
  items: z.array(z.any()).describe("Items {titulo, detalle, prioridad(alta/media/baja), categoria}"),
  titulo_digest: z.string().describe("Título del digest").default("Digest"),
  },
  async (args: any) => {
    const { items, titulo_digest } = args as any;
    const list = Array.isArray(items) ? items : [];
if (!list.length) return fail("sin items");
const por_cat: any = {};
for (const it of list) { const c = it.categoria || "general"; por_cat[c] = (por_cat[c] || []).concat(it); }
const orden: any = { alta: 0, media: 1, baja: 2 };
const top3 = [...list].sort((a: any, b: any) => (orden[a.prioridad] ?? 1) - (orden[b.prioridad] ?? 1)).slice(0, 3);
const lineas: string[] = ["# " + (titulo_digest || "Digest"), "", "**" + new Date().toISOString().slice(0, 10) + " — " + list.length + " items**", "", "## Top prioridades"];
for (const t of top3) lineas.push("- **" + (t.titulo || "sin título") + "** (" + (t.prioridad || "media") + "): " + String(t.detalle || "").slice(0, 120));
for (const [cat, items_cat] of __ents(por_cat as Record<string, any[]>)) {
  lineas.push("", "## " + cat + " (" + items_cat.length + ")");
  for (const it of items_cat) lineas.push("- " + (it.titulo || "") + ": " + String(it.detalle || "").slice(0, 100));
}
return ok({ total_items: list.length, categorias: Object.keys(por_cat).length, digest: lineas.join("\n") });
  }
);

server.tool(
  "escalation_digest",
  "Dígesto de escalación: solo lo que requiere ACCIÓN humana hoy, con deadline.",
  {
  items: z.array(z.any()).describe("Items {titulo, detalle, vence?}"),
  },
  async (args: any) => {
    const { items } = args as any;
    const list = Array.isArray(items) ? items : [];
const ahora = Date.now();
const con_deadline = list.filter((i: any) => i.vence);
const vencidos = con_deadline.filter((i: any) => new Date(i.vence).getTime() < ahora);
const lineas: string[] = ["# ⚠ Escalación: acción humana requerida", ""];
if (vencidos.length) { lineas.push("**VENCIDOS:**"); for (const v of vencidos) lineas.push("- 🚨 " + v.titulo + " (venció " + v.vence + ")"); lineas.push(""); }
const proximos = con_deadline.filter((i: any) => { const t = new Date(i.vence).getTime(); return t >= ahora && t - ahora < 86400000; });
if (proximos.length) { lineas.push("**Vencen hoy:**"); for (const p of proximos) lineas.push("- " + p.titulo + " → " + p.vence); }
const sin_deadline = list.filter((i: any) => !i.vence).slice(0, 5);
if (sin_deadline.length) { lineas.push("", "**Sin deadline asignado:**"); for (const s of sin_deadline) lineas.push("- " + s.titulo + " (asigna deadline)"); }
return ok({ items_totales: list.length, vencidos: vencidos.length, vencen_hoy: proximos.length, digest: lineas.join("\n") });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor digest-writer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "digest-writer", tools: 3, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[digest-writer] fatal:", e);
  process.exit(1);
});

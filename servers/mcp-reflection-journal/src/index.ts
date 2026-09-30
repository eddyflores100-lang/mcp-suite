#!/usr/bin/env node
/**
 * MCP Server: Reflection Journal
 * Diario de reflexión del agente: qué funcionó, qué no, qué sorprendió — y las lecciones destiladas al final del período
 *
 * Dolor que resuelve: El agente termina 30 tareas y no extrae NADA: las sorpresas de la semana pasada se repiten esta semana porque nunca hubo un momento estructurado de mirar atrás. Sin reflexión, la experiencia no se convierte en aprendizaje.
 * Categoría: Auto-Mejora | Generado por mcp-suite | id: reflection-journal
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

// ——— persistencia local: ~/.mcp-suite/reflection-journal/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "reflection-journal");
const STORE_FILE = join(STORE_DIR, "state.json");
const store = {
  load(): any {
    try { return existsSync(STORE_FILE) ? JSON.parse(readFileSync(STORE_FILE, "utf8")) : {}; }
    catch { return {}; }
  },
  save(data: any) {
    mkdirSync(STORE_DIR, { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
    return data;
  },
};

const server = new McpServer({ name: "reflection-journal", version: "1.0.0" });

server.tool(
  "new_reflection",
  "Registra una reflexión post-tarea: lo que funcionó, lo que falló y lo que sorprendió.",
  {
  tarea: z.string().describe("Tarea/Contexto de la reflexión"),
  funciono: z.string().describe("Qué táctica/decisión funcionó y por qué crees que sí"),
  fallo: z.string().describe("Qué falló o costó de más"),
  sorpresa: z.string().describe("Qué te sorprendió (lo no anticipado)").optional(),
  leccion_candidata: z.string().describe("Regla extraíble de esta experiencia").optional(),
  },
  async (args: any) => {
    const { tarea, funciono, fallo, sorpresa, leccion_candidata } = args as any;
    const st = store.load();
st.reflexiones = st.reflexiones || [];
st.reflexiones.push({ tarea, funciono, fallo, sorpresa: sorpresa || "", leccion_candidata: leccion_candidata || "", promovida: false, ts: new Date().toISOString() });
store.save(st);
return ok({ registrada: true, reflexiones_totales: st.reflexiones.length, calidad: sorpresa && leccion_candidata ? "ALTA: sorpresa + lección, la materia prima del aprendizaje" : sorpresa ? "media: hay sorpresa pero no lección: ¿qué harías distinto?" : "baja: reflexión descriptiva, extrae la regla" });
  }
);

server.tool(
  "review_period",
  "Revisa el período: patrones entre reflexiones y lecciones candidatas que se repiten.",
  {
  dias: z.number().describe("Ventana hacia atrás").default(14),
  },
  async (args: any) => {
    const { dias } = args as any;
    const st = store.load();
const desde = Date.now() - dias * 86400000;
const recientes = (st.reflexiones || []).filter(r => new Date(r.ts).getTime() >= desde);
if (!recientes.length) return fail("sin reflexiones en los últimos " + dias + " días");
const tokens = (x) => new Set(String(x).toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 3));
const lecciones = recientes.filter(r => r.leccion_candidata);
const repetidas = [];
const vistas = new Set();
lecciones.forEach(l => {
  const clave = [...tokens(l.leccion_candidata)].slice(0, 5).sort().join("|");
  if (vistas.has(clave)) { const existente = repetidas.find(r => r.clave === clave); if (existente) existente.veces++; else repetidas.push({ clave, leccion: l.leccion_candidata.slice(0, 90), veces: 2 }); }
  vistas.add(clave);
});
const sorpresas = recientes.filter(r => r.sorpresa);
const fallosRecurrentes = [];
recientes.forEach(r => { const t = [...tokens(r.fallo)]; fallosRecurrentes.push(t); });
const conteoPalabras = {};
fallosRecurrentes.forEach(t => t.forEach(w => { conteoPalabras[w] = (conteoPalabras[w] || 0) + 1; }));
const topFallos = Object.keys(conteoPalabras).sort((a, b) => conteoPalabras[b] - conteoPalabras[a]).slice(0, 5).map(w => w + " (" + conteoPalabras[w] + "x)");
return ok({ periodo_dias: dias, reflexiones: recientes.length, con_leccion: lecciones.length, con_sorpresa: sorpresas.length, lecciones_repetidas: repetidas.sort((a, b) => b.veces - a.veces), temas_de_fallo_dominantes: topFallos, accion: repetidas.length ? "las lecciones repetidas van a lesson-library como REGLAS confirmadas: " + repetidas.slice(0, 3).map(r => r.leccion.slice(0, 50)).join(" / ") : "sin repetición aún: sigue registrando, el patrón aparece" });
  }
);

server.tool(
  "extract_lessons",
  "Extrae las lecciones confirmables: candidatas que aparecen 2+ veces o con sorpresa fuerte.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const rs = st.reflexiones || [];
if (!rs.length) return fail("sin reflexiones");
const tokens = (x) => new Set(String(x).toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 3));
const buckets = {};
rs.forEach((r, i) => {
  if (!r.leccion_candidata || r.promovida) return;
  const clave = [...tokens(r.leccion_candidata)].slice(0, 5).sort().join("|");
  buckets[clave] = buckets[clave] || { leccion: r.leccion_candidata, indices: [], conSorpresa: false };
  buckets[clave].indices.push(i);
  if (r.sorpresa) buckets[clave].conSorpresa = true;
});
const confirmables = Object.keys(buckets).filter(k => buckets[k].indices.length >= 2 || buckets[k].conSorpresa).map(k => ({ leccion: buckets[k].leccion.slice(0, 110), apariciones: buckets[k].indices.length, respaldada_por_sorpresa: buckets[k].conSorpresa, estado: buckets[k].indices.length >= 3 ? "REGLA (3+ apariciones): incorporated al comportamiento" : "candidata sólida: pendiente de una aparición más" }));
return ok({ reflexiones: rs.length, lecciones_confirmables: confirmables, no_promover: Object.keys(buckets).length - confirmables.length + " candidatas únicas sin repetición: aún anecdóticas, no las promuevas" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor reflection-journal está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "reflection-journal", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[reflection-journal] fatal:", e);
  process.exit(1);
});

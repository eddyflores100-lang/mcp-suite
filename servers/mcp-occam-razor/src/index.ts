#!/usr/bin/env node
/**
 * MCP Server: Occam Razor
 * Navaja de Occam cuantificada: hipótesis con entidades, supuestos y ajuste a evidencia — simplicidad que gana solo si empata
 *
 * Dolor que resuelve: El agente prefiere la hipótesis más elaborada porque 'explica más': sin contar entidades ni supuestos, la complejidad extra parece virtud y no coste. La navaja sin números corta al azar.
 * Categoría: Razonamiento | Generado por mcp-suite | id: occam-razor
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

// ——— persistencia local: ~/.mcp-suite/occam-razor/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "occam-razor");
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

const server = new McpServer({ name: "occam-razor", version: "1.0.0" });

server.tool(
  "add_hypothesis",
  "Añade una hipótesis con sus entidades y supuestos independientes.",
  {
  problema: z.string().describe("Problema a explicar"),
  hipotesis: z.string().describe("Enunciado de la hipótesis"),
  entidades: z.array(z.any()).describe("Entidades/agentes/cosas que la hipótesis introduce"),
  supuestos: z.array(z.any()).describe("Supuestos independientes que da por ciertos (cada uno puede fallar solo)"),
  },
  async (args: any) => {
    const { problema, hipotesis, entidades, supuestos } = args as any;
    const st = store.load();
st.problemas = st.problemas || {};
st.problemas[problema] = st.problemas[problema] || { problema, hipotesis: {} };
const p = st.problemas[problema];
const clave = hipotesis.toLowerCase().slice(0, 60);
if (p.hipotesis[clave]) return fail("hipótesis ya registrada");
p.hipotesis[clave] = { hipotesis, entidades: (entidades || []).map(String), supuestos: (supuestos || []).map(String), ajuste: null, registrado: new Date().toISOString() };
store.save(st);
return ok({ problema, hipotesis: clave, entidades: (entidades || []).length, supuestos: (supuestos || []).length, complejidad_bruta: (entidades || []).length + (supuestos || []).length, siguiente: "califica el ajuste a la evidencia con rate_fit" });
  }
);

server.tool(
  "rate_fit",
  "Califica qué tan bien la hipótesis explica la evidencia observada (0 a 1).",
  {
  problema: z.string().describe("Problema"),
  hipotesis: z.string().describe("Hipótesis"),
  ajuste: z.number().describe("Ajuste a la evidencia 0-1 (1 = lo explica todo sin residuos)"),
  evidencia_cubierta: z.string().describe("Qué evidencia cubre y cuál no").optional(),
  },
  async (args: any) => {
    const { problema, hipotesis, ajuste, evidencia_cubierta } = args as any;
    const st = store.load();
const p = (st.problemas || {})[problema];
if (!p) return fail("problema no encontrado");
const clave = hipotesis.toLowerCase().slice(0, 60);
const h = p.hipotesis[clave];
if (!h) return fail("hipótesis no registrada");
if (ajuste < 0 || ajuste > 1) return fail("ajuste entre 0 y 1");
h.ajuste = ajuste;
h.evidencia_cubierta = evidencia_cubierta || "";
store.save(st);
return ok({ hipotesis: clave, ajuste, nota: ajuste < 0.5 ? "explica MENOS de la mitad de la evidencia: necesitas datos extra o una hipótesis distinta" : "ajuste registrado" });
  }
);

server.tool(
  "rank",
  "Ranking por navaja: penaliza complejidad y solo gana la simple si empata en ajuste.",
  {
  problema: z.string().describe("Problema"),
  },
  async (args: any) => {
    const { problema } = args as any;
    const st = store.load();
const p = (st.problemas || {})[problema];
if (!p) return fail("problema no encontrado");
const hs = __vals(p.hipotesis);
if (hs.length < 2) return fail("necesitas 2+ hipótesis para rankear");
const sinAjuste = hs.filter(h => h.ajuste === null);
if (sinAjuste.length) return fail("sin calificar: " + sinAjuste.map(h => h.hipotesis.slice(0, 40)).join(", ") + " (usa rate_fit)");
const puntuadas = hs.map(h => {
  const complejidad = h.entidades.length + h.supuestos.length;
  const penalizacion = Math.log2(complejidad + 1);
  const score = (h.ajuste ?? 0) - 0.08 * penalizacion;
  return { hipotesis: h.hipotesis.slice(0, 80), entidades: h.entidades.length, supuestos: h.supuestos.length, complejidad, ajuste: h.ajuste, penalizacion_log: Number(penalizacion.toFixed(2)), score_naval: Number(score.toFixed(3)) };
}).sort((a, b) => b.score_naval - a.score_naval);
const mejor = puntuadas[0];
const segunda = puntuadas[1];
const empateTecnico = segunda && Math.abs(mejor.score_naval - segunda.score_naval) < 0.05;
return ok({ problema, ranking: puntuadas, ganadora: mejor.hipotesis, analisis: empateTecnico ? "EMPATE TÉCNICO con '" + segunda.hipotesis.slice(0, 50) + "': cuando dos hipótesis empatan, la navaja manda elegir la MÁS SIMPLE de las dos" : "ventaja clara de " + Number((mejor.score_naval - (segunda ? segunda.score_naval : 0)).toFixed(3)), advertencias: puntuadas.filter(h => h.entidades > 4).map(h => "la hipótesis '" + h.hipotesis.slice(0, 40) + "' introduce " + h.entidades + " entidades: cada una es una historia que sostener"), recordatorio: "la simplicidad es el DESEMPATE, no el criterio: una hipótesis simple que no encaja (ajuste bajo) sigue siendo incorrecta" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor occam-razor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "occam-razor", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[occam-razor] fatal:", e);
  process.exit(1);
});

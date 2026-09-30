#!/usr/bin/env node
/**
 * MCP Server: Error Taxonomy
 * Agrupa los errores del agente en familias con firma común: el error 47 y el 3 son el MISMO error, ahora lo verás
 *
 * Dolor que resuelve: El agente acumula 200 errores registrados como 200 eventos únicos: sin clustering por similitud, el patrón que se repite 40 veces es invisible y cada 'arreglo' ataca el síntoma de la semana.
 * Categoría: Auto-Mejora | Generado por mcp-suite | id: error-taxonomy
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

// ——— persistencia local: ~/.mcp-suite/error-taxonomy/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "error-taxonomy");
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

const server = new McpServer({ name: "error-taxonomy", version: "1.0.0" });

server.tool(
  "ingest_errors",
  "Ingiere una tanda de errores con su contexto (operación, mensaje, fase).",
  {
  errores: z.array(z.any()).describe("Errores {mensaje, operacion?, fase?, severidad?}"),
  },
  async (args: any) => {
    const { errores } = args as any;
    const st = store.load();
st.errores = st.errores || [];
const limpios = (errores || []).filter(e => e && e.mensaje).map(e => ({ mensaje: String(e.mensaje).slice(0, 200), operacion: String(e.operacion || ""), fase: String(e.fase || ""), severidad: String(e.severidad || "media"), ts: new Date().toISOString() }));
if (!limpios.length) return fail("sin errores con mensaje");
st.errores.push(...limpios);
if (st.errores.length > 3000) st.errores = st.errores.slice(-2500);
store.save(st);
return ok({ ingeridos: limpios.length, total_historico: st.errores.length, siguiente: "agrupa con cluster" });
  }
);

server.tool(
  "cluster",
  "Agrupa los errores en familias por similitud de firma (tokens del mensaje + operación).",
  {
  umbral_similitud: z.number().describe("Similitud Jaccard mínima para agrupar (0.3-0.6 recomendado)").default(0.45),
  },
  async (args: any) => {
    const { umbral_similitud } = args as any;
    const st = store.load();
const errores = st.errores || [];
if (errores.length < 5) return fail("con menos de 5 errores no hay patrón que descubrir");
const firma = (e) => new Set(String(e.mensaje).toLowerCase().split(/[^a-z0-9áéíóúñ%]+/).filter(w => w.length > 2 && !/\d/.test(w)).concat(e.operacion ? [e.operacion.toLowerCase()] : []));
const jaccard = (a, b) => { const inter = [...a].filter(x => b.has(x)).length; const uni = a.size + b.size - inter; return uni ? inter / uni : 0; };
const familias = [];
const asignados = new Array(errores.length).fill(false);
errores.forEach((e, i) => {
  if (asignados[i]) return;
  const familia = [i];
  asignados[i] = true;
  for (let j = i + 1; j < errores.length; j++) {
    if (asignados[j]) continue;
    if (jaccard(firma(errores[i]), firma(errores[j])) >= umbral_similitud) { familia.push(j); asignados[j] = true; }
  }
  const miembros = familia.map(idx => errores[idx]);
  const palabras = {};
  firma(errores[i]).forEach(w => { palabras[w] = 0; });
  miembros.forEach(m => { const f = firma(m); Object.keys(palabras).forEach(w => { if (f.has(w)) palabras[w]++; }); });
  const topPalabras = Object.keys(palabras).sort((a, b) => palabras[b] - palabras[a]).slice(0, 4);
  familias.push({
    familia: "F" + (familias.length + 1),
    recurrencia: miembros.length,
    firma_comun: topPalabras.join(" · "),
    ejemplo_representativo: miembros[0].mensaje.slice(0, 90),
    operaciones_involucradas: [...new Set(miembros.map(m => m.operacion).filter(Boolean))].slice(0, 3),
    severidad_dominante: miembros.filter(m => m.severidad === "alta").length > miembros.length / 2 ? "alta" : "media/baja",
    primera_vez: miembros[0].ts,
    ultima_vez: miembros[miembros.length - 1].ts
  });
});
familias.sort((a, b) => b.recurrencia - a.recurrencia);
st.familias = familias;
store.save(st);
return ok({ errores_analizados: errores.length, familias: familias.length, top_familias: familias.slice(0, 8), lectura: familias[0] && familias[0].recurrencia > errores.length * 0.3 ? "la familia " + familias[0].familia + " agrupa el " + Number((familias[0].recurrencia / errores.length * 100).toFixed(0)) + "% de TODOS los errores: arregla esto y tu fiabilidad cambia de escala" : "error repartido: arregla las 2-3 familias de arriba" });
  }
);

server.tool(
  "name_cluster",
  "Bautiza una familia con su causa probable (convierte el patrón en diagnóstico).",
  {
  familia: z.string().describe("Id de familia (F1)"),
  nombre: z.string().describe("Nombre diagnóstico (ej: timeouts-por-reintentos-en-cadena)"),
  causa_probable: z.string().describe("Qué la causa realmente"),
  },
  async (args: any) => {
    const { familia, nombre, causa_probable } = args as any;
    const st = store.load();
const f = (st.familias || []).find(x => x.familia === familia);
if (!f) return fail("familia no encontrada: " + familia + " (corre cluster primero)");
f.nombre_diagnostico = nombre;
f.causa_probable = causa_probable;
store.save(st);
return ok({ familia, nombre_diagnostico: nombre, causa_probable, recurrencia: f.recurrencia, siguiente: "registra la causa raíz con root-cause-tree de otro MCP y cruza" });
  }
);

server.tool(
  "taxonomy_report",
  "Reporte de la taxonomía: familias nombradas vs anónimas, cobertura y foco de arreglo.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const familias = st.familias || [];
if (!familias.length) return ok({ familias: 0, mensaje: "corre cluster primero" });
const nombradas = familias.filter(f => f.nombre_diagnostico);
const anonimas = familias.filter(f => !f.nombre_diagnostico);
const totalErrores = familias.reduce((a, f) => a + f.recurrencia, 0) || 1;
const concentracion = Number((familias.slice(0, 3).reduce((a, f) => a + f.recurrencia, 0) / totalErrores * 100).toFixed(0));
return ok({ familias: familias.length, errores_total: totalErrores, nombradas: nombradas.map(f => f.familia + " = " + f.nombre_diagnostico + " (" + f.recurrencia + "x)"), anonimas: anonimas.length + " familias sin nombre: no puedes arreglar lo que no sabes nombrar", concentracion_top3: concentracion + "% de los errores viven en las 3 familias principales", estrategia: concentracion > 60 ? "arregla las 3 de arriba y cierra la mayoría del problema: el 80/20 se cumple" : "error disperso: revisa si hay una causa sistémica común (contexto corrupto, datos sucios)" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor error-taxonomy está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "error-taxonomy", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[error-taxonomy] fatal:", e);
  process.exit(1);
});

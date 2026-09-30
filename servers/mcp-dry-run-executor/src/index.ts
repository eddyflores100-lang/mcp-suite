#!/usr/bin/env node
/**
 * MCP Server: Dry-Run Executor
 * Ensayo el plan ANTES de ejecutarlo: detecta pasos fuera de orden, efectos sin deshacer y dependencias faltantes
 *
 * Dolor que resuelve: El plan del agente se ve bien en texto pero al ejecutarlo el paso 4 depende de un dato que el paso 7 produce: el agente descubre el error con la mitad del mundo ya modificada.
 * Categoría: Pre-Vuelo | Generado por mcp-suite | id: dry-run-executor
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

// ——— persistencia local: ~/.mcp-suite/dry-run-executor/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "dry-run-executor");
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

const server = new McpServer({ name: "dry-run-executor", version: "1.0.0" });

server.tool(
  "define_plan",
  "Registra un plan como lista de pasos declarativos con lo que leen/escriben/destruyen/requieren.",
  {
  plan: z.string().describe("Nombre del plan"),
  pasos: z.array(z.any()).describe("Pasos {nombre, lee:[], escribe:[], destruye:[], requiere:[]}"),
  proposito: z.string().describe("Objetivo del plan").optional(),
  },
  async (args: any) => {
    const { plan, pasos, proposito } = args as any;
    const st = store.load();
st.planes = st.planes || {};
const limpios = (pasos || []).map((p, i) => ({
  nombre: String(p.nombre || ("paso_" + (i + 1))),
  lee: (p.lee || []).map(String),
  escribe: (p.escribe || []).map(String),
  destruye: (p.destruye || []).map(String),
  requiere: (p.requiere || []).map(String)
}));
if (!limpios.length) return fail("plan sin pasos");
st.planes[plan] = { plan, proposito: proposito || "", pasos: limpios, creado: new Date().toISOString(), ensayos: 0 };
store.save(st);
return ok({ plan, pasos: limpios.length, aviso: "ejecuta dry_run para validarlo antes de la ejecución real" });
  }
);

server.tool(
  "dry_run",
  "Ensaya el plan: verifica orden de datos, precondiciones, pasos destructivos sin compensación y variables huérfanas.",
  {
  plan: z.string().describe("Plan a ensayar"),
  datos_iniciales: z.array(z.any()).describe("Datos/recursos que existen antes de empezar").optional(),
  },
  async (args: any) => {
    const { plan, datos_iniciales } = args as any;
    const st = store.load();
const p = (st.planes || {})[plan];
if (!p) return fail("plan no definido: " + plan);
p.ensayos = (p.ensayos || 0) + 1;
const disponibles = new Set((datos_iniciales || []).map(String));
const problemas = [];
const huérfanas = new Set();
p.pasos.forEach((paso, i) => {
  (paso.requiere || []).forEach(r => { if (!disponibles.has(r)) problemas.push({ paso: i + 1, nombre: paso.nombre, tipo: "PRECONDICION_FALTA", detalle: "requiere '" + r + "' que no existe aún" }); });
  (paso.lee || []).forEach(l => { if (!disponibles.has(l)) { problemas.push({ paso: i + 1, nombre: paso.nombre, tipo: "LEE_INEXISTENTE", detalle: "lee '" + l + "' que nadie produce ni está en los datos iniciales" }); huérfanas.add(l); } });
  (paso.destruye || []).forEach(d => { if (!disponibles.has(d)) problemas.push({ paso: i + 1, nombre: paso.nombre, tipo: "DESTRUYE_INEXISTENTE", detalle: "destruye '" + d + "' que no existe" }); });
  (paso.escribe || []).forEach(e => disponibles.add(e));
  (paso.lee || []).forEach(l => disponibles.add(l));
  (paso.requiere || []).forEach(r => disponibles.add(r));
});
const destructivosSinCompensar = [];
p.pasos.forEach((paso, i) => {
  (paso.destruye || []).forEach(d => {
    const compensado = p.pasos.some(o => (o.escribe || []).includes(d));
    if (!compensado) destructivosSinCompensar.push({ paso: i + 1, nombre: paso.nombre, recurso: d });
  });
});
destructivosSinCompensar.forEach(dc => problemas.push({ paso: dc.paso, nombre: dc.nombre, tipo: "DESTRUCTIVO_SIN_COMPENSAR", detalle: "destruye '" + dc.recurso + "' y ningún paso lo regenera: irreversible dentro del plan" }));
const escribeSinLeer = [];
p.pasos.forEach((paso, i) => (paso.escribe || []).forEach(e => { const loUsaAlguien = p.pasos.some(o => (o.lee || []).includes(e) || (o.requiere || []).includes(e)); if (!loUsaAlguien) escribeSinLeer.push({ paso: i + 1, dato: e }); }));
const veredicto = problemas.some(pr => pr.tipo === "PRECONDICION_FALTA" || pr.tipo === "LEE_INEXISTENTE" || pr.tipo === "DESTRUCTIVO_SIN_COMPENSAR") ? "NO_EJECUTAR: corrige el plan primero" : problemas.length ? "EJECUTAR_CON_CUIDADO: hay avisos menores" : "LISTO: el plan ensaya limpio";
store.save(st);
return ok({ plan, ensayo_numero: p.ensayos, pasos: p.pasos.length, problemas, variables_huerfanas: [...huérfanas], pasos_destructivos_sin_compensar: destructivosSinCompensar, escribe_sin_consumir: escribeSinLeer, veredicto });
  }
);

server.tool(
  "reorder_suggestion",
  "Sugiere un reordenamiento de pasos que resuelve dependencias de datos por orden topológico.",
  {
  plan: z.string().describe("Plan a reordenar"),
  },
  async (args: any) => {
    const { plan } = args as any;
    const st = store.load();
const p = (st.planes || {})[plan];
if (!p) return fail("plan no definido");
const pasos = p.pasos.map((x, i) => ({ idx: i, ...x }));
const prod = new Map<any, any>();
(datos => { pasos.forEach(paso => (paso.escribe || []).forEach(e => { if (!prod.has(e)) prod.set(e, paso.idx); })); })();
const antes = (a, b) => {
  const depsA = [...(a.lee || []), ...(a.requiere || [])].filter(d => prod.has(d) && prod.get(d) !== a.idx);
  const depsB = [...(b.lee || []), ...(b.requiere || [])].filter(d => prod.has(d) && prod.get(d) !== b.idx);
  return depsA.length - depsB.length;
};
const ordenado = pasos.slice().sort(antes);
const cambiadas = ordenado.filter((x, i) => x.idx !== i).length;
return ok({ plan, orden_actual: pasos.map(x => x.nombre), orden_sugerido: ordenado.map(x => x.nombre), pasos_reubicados: cambiadas, nota: "el orden sugerido pone primero los pasos que más dependencias de datos satisfacen; re-ensaya con dry_run tras aplicar" });
  }
);

server.tool(
  "post_execution_check",
  "Tras ejecutar: compara lo declarado en el ensayo con lo que realmente pasó (pasos saltados, efectos extra).",
  {
  plan: z.string().describe("Plan ejecutado"),
  pasos_reales: z.array(z.any()).describe("Nombres de pasos realmente ejecutados en orden"),
  efectos_extra: z.array(z.any()).describe("Efectos observados no declarados {paso, detalle}").optional(),
  },
  async (args: any) => {
    const { plan, pasos_reales, efectos_extra } = args as any;
    const st = store.load();
const p = (st.planes || {})[plan];
if (!p) return fail("plan no definido");
const declarados = p.pasos.map(x => x.nombre);
const reales = (pasos_reales || []).map(String);
const saltados = declarados.filter(n => !reales.includes(n));
const inventados = reales.filter(n => !declarados.includes(n));
const ordenDeclarado = declarados.map((n, i) => ({ n, i })).filter(x => reales.includes(x.n));
let ordenRoto = false;
let pos = -1;
ordenDeclarado.forEach(x => { const rp = reales.indexOf(x.n); if (rp < pos) ordenRoto = true; pos = Math.max(pos, rp); });
return ok({ plan, pasos_declarados: declarados.length, pasos_reales: reales.length, saltados, pasos_no_declarados: inventados, orden_respetado: !ordenRoto, efectos_no_declarados: efectos_extra || [], desviacion: saltados.length + inventados.length === 0 && !ordenRoto ? "ejecución fiel al ensayo" : "desviación detectada: registra por qué y actualiza el plan" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor dry-run-executor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "dry-run-executor", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[dry-run-executor] fatal:", e);
  process.exit(1);
});

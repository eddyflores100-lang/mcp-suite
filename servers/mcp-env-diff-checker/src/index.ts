#!/usr/bin/env node
/**
 * MCP Server: Env Diff Checker
 * Caza el drift de configuración: snapshot de entorno dev vs prod y qué claves divergen antes de desplegar
 *
 * Dolor que resuelve: El agente funciona perfecto en desarrollo y falla en producción: 3 claves distintas, 1 ausente y un timeout que solo existe en un lado. El drift de entorno es el bug más caro de diagnosticar y el más fácil de prevenir.
 * Categoría: Agent CI/CD | Generado por mcp-suite | id: env-diff-checker
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

// ——— persistencia local: ~/.mcp-suite/env-diff-checker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "env-diff-checker");
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

const server = new McpServer({ name: "env-diff-checker", version: "1.0.0" });

server.tool(
  "capture_env",
  "Captura un entorno nombrado (config aplanada; los valores sensibles se ofuscan automáticamente).",
  {
  nombre: z.string().describe("Nombre del entorno (dev, staging, prod)"),
  config: z.any().describe("Objeto de configuración {clave: valor}"),
  },
  async (args: any) => {
    const { nombre, config } = args as any;
    const st = store.load();
st.entornos = st.entornos || [];
const previo = st.entornos.find(e => e.nombre === nombre);
const ofuscar = (k, v) => /pass|secret|token|key|api|credential/i.test(k) ? "«" + String(v).length + " chars»" : v;
const aplanado = {};
const aplanar = (obj, prefijo) => {
  Object.keys(obj || {}).forEach(k => {
    const v = obj[k];
    const clave = prefijo ? prefijo + "." + k : k;
    if (v && typeof v === "object" && !Array.isArray(v)) aplanar(v, clave);
    else aplanado[clave] = ofuscar(clave, v);
  });
};
aplanar(config, "");
if (!Object.keys(aplanado).length) return fail("config vacía: nada que capturar");
if (previo) {
  const drift = Object.keys(aplanado).filter(k => JSON.stringify(previo.config[k]) !== JSON.stringify(aplanado[k])).length;
  st.entornos = st.entornos.filter(e => e.nombre !== nombre);
  st.entornos.push({ nombre, config: aplanado, ts: new Date().toISOString(), revision: (previo.revision || 1) + 1, drift_desde_anterior: drift });
} else {
  st.entornos.push({ nombre, config: aplanado, ts: new Date().toISOString(), revision: 1 });
}
store.save(st);
return ok({ entorno: nombre, claves: Object.keys(aplanado).length, revision: previo ? (previo.revision || 1) + 1 : 1, secretos_ofuscados: Object.keys(aplanado).filter(k => String(aplanado[k]).startsWith("«")).length });
  }
);

server.tool(
  "diff_envs",
  "Diferencia dos entornos: claves divergentes, ausentes y con riesgo clasificado.",
  {
  origen: z.string().describe("Entorno base (ej: dev)"),
  destino: z.string().describe("Entorno a comparar (ej: prod)"),
  },
  async (args: any) => {
    const { origen, destino } = args as any;
    const st = store.load();
const a = (st.entornos || []).find(e => e.nombre === origen);
const b = (st.entornos || []).find(e => e.nombre === destino);
if (!a) return fail("entorno no capturado: " + origen);
if (!b) return fail("entorno no capturado: " + destino);
const ka = new Set(Object.keys(a.config)), kb = new Set(Object.keys(b.config));
const soloA = [...ka].filter(k => !kb.has(k));
const soloB = [...kb].filter(k => !ka.has(k));
const divergentes = [...ka].filter(k => kb.has(k) && JSON.stringify(a.config[k]) !== JSON.stringify(b.config[k])).map(k => ({
  clave: k,
  en_origen: String(a.config[k]).slice(0, 40),
  en_destino: String(b.config[k]).slice(0, 40),
  riesgo: /timeout|retries|limit|batch|concurrency|pool/i.test(k) ? "MEDIO: afecta rendimiento/comportamiento" : /version|url|endpoint|host|model|provider/i.test(k) ? "ALTO: apunta a otro sistema o versión" : /debug|verbose|log|mock|sandbox/i.test(k) ? "ESPERABLE: flags de entorno" : "bajo"
}));
return ok({ comparacion: origen + " vs " + destino, capturados: { origen: a.ts, destino: b.ts }, claves_totales: { origen: ka.size, destino: kb.size }, solo_en_origen: soloA, solo_en_destino: soloB, valores_divergentes: divergentes, resumen: { total_diferencias: soloA.length + soloB.length + divergentes.length, altas: divergentes.filter(d => d.riesgo.startsWith("ALTO")).length }, veredicto: soloA.length + soloB.length + divergentes.length === 0 ? "entornos alineados: despliega con confianza" : soloA.length + soloB.length > 5 ? "drift GRAVE: más de 5 diferencias estructurales, reconcilia antes de desplegar" : "drift presente: revisa las claves marcadas ALTO antes de desplegar" });
  }
);

server.tool(
  "watch_drift",
  "Compara la última captura de cada entorno y vigila el empeoramiento del drift.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const entornos = st.entornos || {};
if (st.entornos.length < 2) return fail("necesitas al menos 2 entornos capturados");
const nombres = [...new Set(st.entornos.map(e => e.nombre))];
const pares = [];
for (let i = 0; i < nombres.length; i++) {
  for (let j = i + 1; j < nombres.length; j++) {
    const a = st.entornos.filter(e => e.nombre === nombres[i]).pop();
    const b = st.entornos.filter(e => e.nombre === nombres[j]).pop();
    const ka = new Set(Object.keys(a.config)), kb = new Set(Object.keys(b.config));
    const diff = [...ka].filter(k => !kb.has(k)).length + [...kb].filter(k => !ka.has(k)).length + [...ka].filter(k => kb.has(k) && JSON.stringify(a.config[k]) !== JSON.stringify(b.config[k])).length;
    const frescura = {};
    frescura[String(nombres[i])] = a.ts;
    frescura[String(nombres[j])] = b.ts;
    pares.push({ par: String(nombres[i]) + " <-> " + String(nombres[j]), diferencias: diff, frescura });
  }
}
const peor = pares.slice().sort((a, b) => b.diferencias - a.diferencias)[0];
st.historialDrift = st.historialDrift || [];
st.historialDrift.push({ ts: new Date().toISOString(), pares: pares.map(p => p.par + ":" + p.diferencias) });
store.save(st);
const tendencia = st.historialDrift.length >= 2 ? pares.map(p => { const prev = st.historialDrift[st.historialDrift.length - 2].pares.find(x => x.startsWith(p.par)); return { par: p.par, antes: prev ? Number(prev.split(":").pop()) : null, ahora: p.diferencias }; }) : null;
return ok({ entornos: nombres, pares, peor_par: peor, tendencia, aviso: peor.diferencias > 10 ? "drift fuera de control en " + peor.par + ": sincroniza YA" : null });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor env-diff-checker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "env-diff-checker", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[env-diff-checker] fatal:", e);
  process.exit(1);
});

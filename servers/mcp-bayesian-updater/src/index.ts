#!/usr/bin/env node
/**
 * MCP Server: Bayesian Updater
 * Cree con números: hipótesis con prior, evidencias con verosimilitud y posteriores que se actualizan con traza explicada
 *
 * Dolor que resuelve: El agente dice 'ahora estoy más seguro' sin números: sin prior ni verosimilitud, la 'actualización de creencia' es teatro. Cuando llega evidencia contradictoria no sabe si reforzar o abandonar la hipótesis.
 * Categoría: Razonamiento | Generado por mcp-suite | id: bayesian-updater
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

// ——— persistencia local: ~/.mcp-suite/bayesian-updater/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "bayesian-updater");
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

const server = new McpServer({ name: "bayesian-updater", version: "1.0.0" });

server.tool(
  "define_hypothesis",
  "Define una hipótesis con su probabilidad a priori y justificación.",
  {
  hipotesis: z.string().describe("Enunciado de la hipótesis"),
  prior: z.number().describe("Probabilidad inicial 0-1"),
  justificacion_prior: z.string().describe("Por qué ese prior (base rate, historia, intuición experta)"),
  },
  async (args: any) => {
    const { hipotesis, prior, justificacion_prior } = args as any;
    const st = store.load();
st.hipotesis = st.hipotesis || {};
const clave = hipotesis.toLowerCase().slice(0, 80);
if (st.hipotesis[clave]) return fail("hipótesis ya registrada");
if (prior <= 0 || prior >= 1) return fail("prior debe estar entre 0 y 1 (exclusivo)");
st.hipotesis[clave] = { hipotesis, prior, posterior: prior, justificacion_prior, evidencias: [], traza: [{ evento: "prior", p: prior, ts: new Date().toISOString() }] };
store.save(st);
return ok({ hipotesis: clave, prior, en_log_odds: Number(Math.log(prior / (1 - prior)).toFixed(3)), justificacion: justificacion_prior });
  }
);

server.tool(
  "apply_evidence",
  "Aplica una evidencia con su verosimilitud P(E|H) vs P(E|no H) y actualiza el posterior.",
  {
  hipotesis: z.string().describe("Hipótesis a actualizar"),
  evidencia: z.string().describe("Descripción de la evidencia observada"),
  p_e_dado_h: z.number().describe("P(E | hipótesis cierta) 0-1"),
  p_e_dado_no_h: z.number().describe("P(E | hipótesis falsa) 0-1"),
  fuente: z.string().describe("De dónde viene la evidencia").optional(),
  },
  async (args: any) => {
    const { hipotesis, evidencia, p_e_dado_h, p_e_dado_no_h, fuente } = args as any;
    const st = store.load();
const clave = hipotesis.toLowerCase().slice(0, 80);
const h = (st.hipotesis || {})[clave];
if (!h) return fail("hipótesis no registrada: usa define_hypothesis");
if (p_e_dado_h <= 0 || p_e_dado_h > 1 || p_e_dado_no_h <= 0 || p_e_dado_no_h > 1) return fail("verosimilitudes deben estar en (0, 1]");
const duplicada = h.evidencias.some(e => e.evidencia.toLowerCase().slice(0, 40) === evidencia.toLowerCase().slice(0, 40));
if (duplicada) return fail("evidencia sospechosamente duplicada (mismo texto): NO cuentes dos veces la misma observación, es el error bayesiano clásico");
const lr = p_e_dado_h / p_e_dado_no_h;
const oddsAntes = h.posterior / (1 - h.posterior);
const oddsDespues = oddsAntes * lr;
const nuevo = oddsDespues / (1 + oddsDespues);
h.evidencias.push({ evidencia, p_e_dado_h, p_e_dado_no_h, lr: Number(lr.toFixed(3)), fuente: fuente || "", ts: new Date().toISOString() });
h.posterior = nuevo;
h.traza.push({ evento: "evidencia: " + evidencia.slice(0, 50), lr: Number(lr.toFixed(3)), p: Number(nuevo.toFixed(4)), ts: new Date().toISOString() });
store.save(st);
return ok({ hipotesis: clave, evidencia: evidencia.slice(0, 80), likelihood_ratio: Number(lr.toFixed(3)) + (lr > 1 ? " (refuerza)" : lr < 1 ? " (debilita)" : " (neutra)"), posterior_antes: Number((oddsAntes / (1 + oddsAntes)).toFixed(4)), posterior_ahora: Number(nuevo.toFixed(4)), salto: nuevo > h.posterior ? "" : "", en_palabras: lr >= 10 ? "evidencia MUY FUERTE a favor" : lr >= 2 ? "evidencia moderada a favor" : lr > 0.5 ? "evidencia leve en contra" : lr > 0.1 ? "evidencia moderada en contra" : "evidencia MUY FUERTE en contra" });
  }
);

server.tool(
  "posterior_view",
  "Ranking de todas las hipótesis por posterior actual, con su historial de evidencias.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const hs = __vals(st.hipotesis || {});
if (!hs.length) return ok({ hipotesis: 0, mensaje: "sin hipótesis registradas" });
const ranking = hs.map(h => ({ hipotesis: h.hipotesis, prior: h.prior, posterior: Number(h.posterior.toFixed(4)), confianza: h.posterior > 0.9 ? "MUY ALTA" : h.posterior > 0.7 ? "alta" : h.posterior > 0.3 ? "incierta" : h.posterior > 0.1 ? "baja" : "MUY BAJA", evidencias: h.evidencias.length, fuerza_neta: Number(h.evidencias.reduce((s, e) => s + Math.log(e.lr), 0).toFixed(2)) + " log-LR acumulado" })).sort((a, b) => b.posterior - a.posterior);
return ok({ hipotesis: ranking.length, ranking, lider: ranking[0], cobertura_total: Number(ranking.reduce((s, h) => s + h.posterior, 0).toFixed(2)) + " (si >> 1 hay hipótesis solapadas; si << 1 falta la hipótesis correcta)" });
  }
);

server.tool(
  "explain_update",
  "Explica la evolución completa de una hipótesis: cada salto, su evidencia y su dirección.",
  {
  hipotesis: z.string().describe("Hipótesis"),
  },
  async (args: any) => {
    const { hipotesis } = args as any;
    const st = store.load();
const clave = hipotesis.toLowerCase().slice(0, 80);
const h = (st.hipotesis || {})[clave];
if (!h) return fail("hipótesis no registrada");
const pasos = [];
let p = h.prior;
h.evidencias.forEach(e => {
  const odds = p / (1 - p);
  const nuevo = (odds * e.lr) / (1 + odds * e.lr);
  pasos.push({ desde: Number(p.toFixed(3)), hasta: Number(nuevo.toFixed(3)), direccion: e.lr > 1 ? "SUBE" : "BAJA", evidencia: e.evidencia.slice(0, 70), lr: e.lr, fuente: e.fuente });
  p = nuevo;
});
return ok({ hipotesis: h.hipotesis, prior_inicial: h.prior, posterior_final: Number(h.posterior.toFixed(4)), total_evidencias: h.evidencias.length, camino: pasos, lectura: h.evidencias.filter(e => e.lr > 2).length > h.evidencias.filter(e => e.lr < 0.5).length ? "la corriente de evidencia empuja a favor" : h.evidencias.filter(e => e.lr < 0.5).length > h.evidencias.filter(e => e.lr > 2).length ? "la corriente de evidencia empuja en contra: plantea la hipótesis alternativa YA" : "evidencia mixta: la hipótesis está mal formulada o falta discriminar", aviso_conteo_doble: h.evidencias.length > 8 ? "8+ evidencias: revisa que ninguna sea derivada de otra (correlación no es doble evidencia)" : null });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor bayesian-updater está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "bayesian-updater", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[bayesian-updater] fatal:", e);
  process.exit(1);
});

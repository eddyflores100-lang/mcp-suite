#!/usr/bin/env node
/**
 * MCP Server: Causal Ladder
 * Escalera de Pearl aplicada: clasifica tu pregunta (asociación/intervención/contrafactual) y exige el método que le corresponde
 *
 * Dolor que resuelve: El agente responde '¿qué pasa si intervenimos?' con datos observacionales: mezcla los peldaños de la escalera causal y entrega correlación disfrazada de causalidad. Nadie le exige el método que cada pregunta merece.
 * Categoría: Razonamiento | Generado por mcp-suite | id: causal-ladder
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

// ——— persistencia local: ~/.mcp-suite/causal-ladder/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "causal-ladder");
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

const server = new McpServer({ name: "causal-ladder", version: "1.0.0" });

server.tool(
  "classify_question",
  "Clasifica una pregunta en el peldaño correcto de la escalera causal.",
  {
  pregunta: z.string().describe("La pregunta analítica"),
  },
  async (args: any) => {
    const { pregunta } = args as any;
    const p = pregunta.toLowerCase();
const patronR3 = /\b(si hubi|si no hubi|habría pasado|habria pasado|contrafactual|en lugar de|si en vez de|qué habría)\b/;
const patronR2 = /\b(qué pasa si|que pasa si|si hacemos|si aplicamos|efecto de|impacto de|interven|debemos|mejor opción|causa)\b/;
const patronR1 = /\b(cómo se relaciona|correlaci|asociad|qué predice|que predice|patrón|tendencia|está asociado)\b/;
let peldano = null, razon = "";
if (patronR3.test(p)) { peldano = 3; razon = "formula un mundo alternativo al ocurrido"; }
else if (patronR2.test(p)) { peldano = 2; razon = "pregunta por el efecto de una intervención o acción"; }
else if (patronR1.test(p)) { peldano = 1; razon = "pregunta por relaciones observadas en los datos"; }
if (!peldano) { peldano = 2; razon = "sin marcadores claros: por defecto asume intervención (el peldaño de decisión), verifica"; }
const descripciones = {
  1: { nombre: "ASOCIACIÓN (ver)", que_responde: "¿qué se ve junto con qué?", metodo_correcto: "correlaciones, regresión observacional, minería de patrones", prohibido: "NO interpretes los coeficientes como efectos causales" },
  2: { nombre: "INTERVENCIÓN (hacer)", que_responde: "¿qué pasa si hacemos X?", metodo_correcto: "experimento controlado, A/B, variables instrumentales, do-calculus, diff-in-diff", prohibido: "NO respondas esto con solo datos observacionales sin ajuste" },
  3: { nombre: "CONTRAFACTUAL (imaginar)", que_responde: "¿qué habría pasado si...?", metodo_correcto: "modelos causales estructurales, abducción+intervención+predicción, simulación del mundo alternativo", prohibido: "NO respondas esto con A/B: el A/B responde peldaño 2" }
};
return ok({ pregunta, peldano, nombre: descripciones[peldano].nombre, razon_de_clasificacion: razon, que_responde: descripciones[peldano].que_responde, metodo_que_exige: descripciones[peldano].metodo_correcto, advertencia: descripciones[peldano].prohibido });
  }
);

server.tool(
  "check_method",
  "Verifica que el método elegido puede responder la pregunta clasificada.",
  {
  pregunta: z.string().describe("La pregunta"),
  metodo: z.string().describe("El método con el que piensas responderla"),
  },
  async (args: any) => {
    const { pregunta, metodo } = args as any;
    const p = pregunta.toLowerCase();
const m = metodo.toLowerCase();
const patronR3 = /\b(si hubi|habría|habria|contrafactual|en lugar de|si en vez de)\b/;
const patronR2 = /\b(qué pasa si|que pasa si|si hacemos|si aplicamos|efecto de|impacto de|interven|debemos)\b/;
const peldano = patronR3.test(p) ? 3 : patronR2.test(p) ? 2 : 1;
const metodos = {
  1: ["correlacion", "correlación", "regresion", "regresión", "asociacion", "asociación", "patron", "patrón", "tendencia", "cluster", "predictivo"],
  2: ["a/b", "ab test", "experimento", "controlado", "aleatoriz", "randomiz", "instrumental", "diff-in-diff", "diferencias", "do-calculus", "intervencion", "intervención", "prueba controlada"],
  3: ["contrafactual", "estructural", "simulacion", "simulación", "abduccion", "abducción", "modelo causal", "scm", "mundo alternativo", "counterfactual"]
};
const tiene = (arr) => arr.some(x => m.includes(x));
const metodoPeldano = tiene(metodos[3]) ? 3 : tiene(metodos[2]) ? 2 : tiene(metodos[1]) ? 1 : 0;
const escaleraOk = metodoPeldano >= peldano && metodoPeldano !== 0;
return ok({ pregunta, peldano_requerido: peldano, peldano_del_metodo: metodoPeldano || "no identificado", veredicto: metodoPeldano === 0 ? "MÉTODO NO RECONOCIDO: clasifica manualmente qué peldaño cubre" : escaleraOk ? "VÁLIDO: el método alcanza el peldaño exigido" : "SUBORDINADO: tu método responde un peldaño MÁS BAJO que la pregunta: la respuesta será correlación disfrazada de causalidad", corregir_a: !escaleraOk ? metodos[peldano].slice(0, 4).join(" / ") : null });
  }
);

server.tool(
  "ladder_report",
  "Auditoría de un análisis completo: qué peldaños cubre y dónde salta sin permiso.",
  {
  analisis: z.string().describe("Descripción del análisis (pregunta + método + conclusión)"),
  },
  async (args: any) => {
    const { analisis } = args as any;
    const a = analisis.toLowerCase();
const hallazgos = [];
const saltos = [];
if (/correlaci|asociad|relaci[oó]n/.test(a) && /\b(causa\w*|provoc\w*|produc\w*|efecto\w*|impacto\w*)/.test(a)) saltos.push({ desde: "asociación", hacia: "causalidad", detalle: "el texto calcula correlación y concluye efecto: salto del peldaño 1 al 2 sin control ni experimento" });
if (/\b(a\/b|experimento|aleatoriz)\b/.test(a) && /\b(habría|habria|si no hubi|contrafactual|en vez de)\b/.test(a)) saltos.push({ desde: "intervención", hacia: "contrafactual", detalle: "el A/B dice qué pasa si intervenimos, no qué habría pasado sin la intervención en ESTE caso: para eso, peldaño 3" });
if (/\b(si hubi|habría|habria)\b/.test(a) && !/\b(modelo causal|estructural|simulaci|contrafactual)\b/.test(a)) hallazgos.push({ tipo: "contrafactual sin método", detalle: "se formulan mundos alternativos sin modelo causal que los genere: narrativa retrospectiva" });
if (/\b(una? causa clara|la causa es|obviamente causa)\b/.test(a)) hallazgos.push({ tipo: "causalidad por adjetivo", detalle: "'clara/obvia' no es evidencia: la causalidad se demuestra con método, no con énfasis" });
return ok({ saltos_de_peldano: saltos, hallazgos, veredicto_general: saltos.length + hallazgos.length === 0 ? "análisis coherente con su peldaño" : saltos.length + hallazgos.length <= 1 ? "una deslizadera causal: corrígela" : "múltiples saltos causales: la conclusión no es defendible, reestructura el análisis" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor causal-ladder está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "causal-ladder", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[causal-ladder] fatal:", e);
  process.exit(1);
});

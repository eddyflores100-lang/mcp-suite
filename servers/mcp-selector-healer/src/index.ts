#!/usr/bin/env node
/**
 * MCP Server: Selector Healer
 * Repara selectores rotos por similitud: encuentra el elemento renombrado sin reescribir el flujo
 *
 * Dolor que resuelve: Un botón cambió de id (#btn-submit → #submit-btn) y el flujo entero muere: el agente no tiene forma de mapear 'el botón de antes' al elemento nuevo sin rehacer todo.
 * Categoría: Computer Use | Generado por mcp-suite | id: selector-healer
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

// ——— persistencia local: ~/.mcp-suite/selector-healer/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "selector-healer");
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

const server = new McpServer({ name: "selector-healer", version: "1.0.0" });

server.tool(
  "register_selector",
  "Registra un selector con metadatos ricos para poder curarlo después (texto, ordinal, atributos, página).",
  {
  nombre: z.string().describe("Nombre lógico (ej: boton_enviar)"),
  selector: z.string().describe("Selector CSS/XPath actual"),
  texto_visible: z.string().describe("Texto del elemento").optional(),
  pagina: z.string().describe("Página/flujo").default("default"),
  atributos: z.any().describe("Atributos relevantes {id, class, name...}").optional(),
  },
  async (args: any) => {
    const { nombre, selector, texto_visible, pagina, atributos } = args as any;
    const st = store.load();
st.selectores = st.selectores || {};
st.selectores[nombre] = { nombre, selector, texto_visible: texto_visible || "", pagina, atributos: atributos || {}, curaciones: 0, creado: new Date().toISOString() };
store.save(st);
return ok({ selector: nombre, registrado: true });
  }
);

server.tool(
  "heal",
  "Dado un selector roto y los candidatos actuales del DOM, devuelve el mejor match con score de confianza.",
  {
  nombre: z.string().describe("Nombre lógico del selector roto"),
  candidatos: z.array(z.any()).describe("Candidatos actuales {selector, texto, atributos}"),
  },
  async (args: any) => {
    const { nombre, candidatos } = args as any;
    const st = store.load();
const s = (st.selectores || {})[nombre];
if (!s) return fail("selector no registrado: " + nombre);
const cands = (candidatos || []).filter(c => c && c.selector);
if (!cands.length) return fail("sin candidatos: extrae los elementos del DOM actual primero");
const tokens = (x) => new Set(String(x || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2));
const scored = cands.map(c => {
  let score = 0;
  const selTokens = tokens(s.selector), candSel = tokens(c.selector);
  const overlapSel = [...selTokens].filter(w => candSel.has(w)).length;
  score += overlapSel / Math.max(selTokens.size, 1) * 40;
  if (s.texto_visible && c.texto) {
    const t1 = tokens(s.texto_visible), t2 = tokens(c.texto);
    score += [...t1].filter(w => t2.has(w)).length / Math.max(t1.size, 1) * 35;
  } else if (s.texto_visible && !c.texto) score -= 5;
  if (s.atributos && c.atributos) {
    const claves = Object.keys(s.atributos);
    if (claves.length) {
      const hits = claves.filter(k => c.atributos[k] && String(c.atributos[k]) === String(s.atributos[k])).length;
      score += hits / claves.length * 25;
    }
  }
  return { selector: c.selector, texto: (c.texto || "").slice(0, 40), score: Number(score.toFixed(1)) };
}).sort((a, b) => b.score - a.score);
const mejor = scored[0];
const confianza = mejor.score >= 65 ? "ALTA: aplica" : mejor.score >= 40 ? "MEDIA: aplica con verificación visual posterior" : "BAJA: intervención humana";
if (mejor.score >= 40 && mejor.selector !== s.selector) {
  s.historial = s.historial || [];
  s.historial.push({ desde: s.selector, hacia: mejor.selector, score: mejor.score, ts: new Date().toISOString() });
  s.selector = mejor.selector;
  s.curaciones = (s.curaciones || 0) + 1;
  store.save(st);
}
return ok({ roto: nombre, mejor_candidato: mejor, confianza, top3: scored.slice(0, 3), curaciones_totales: s.curaciones });
  }
);

server.tool(
  "fragility_report",
  "Qué selectores se rompen más y con qué patrón (ids dinámicos, clases hash, textos volátiles).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const sels = __vals(st.selectores || {});
if (!sels.length) return ok({ selectores: 0 });
const analisis = sels.map(s => {
  const patrones = [];
  if (/\d{4,}|\$\{.*\}|[a-f0-9]{8,}/i.test(s.selector)) patrones.push("id/clase dinámico");
  if (/nth-child|nth-of-type/.test(s.selector)) patrones.push("posición ordinal frágil");
  if (/\/\/ul\/\/li\//.test(s.selector)) patrones.push("xpath profundo");
  if (s.texto_visible && s.texto_visible.length > 25) patrones.push("texto largo volátil");
  return { nombre: s.nombre, curaciones: s.curaciones || 0, patrones_riesgo: patrones, selector: s.selector.slice(0, 70) };
}).sort((a, b) => b.curaciones - a.curaciones);
return ok({
  selectores: sels.length,
  curaciones_totales: sels.reduce((a, s) => a + (s.curaciones || 0), 0),
  mas_fragiles: analisis.slice(0, 8),
  consejo: "prioriza data-testid > id estable > aria-label > texto corto > ordinal",
});
  }
);

server.tool(
  "export_map",
  "Exporta el mapa lógico→selector actual (para el orquestador de navegador).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const sels = __vals(st.selectores || {});
return ok({ total: sels.length, mapa: Object.fromEntries(sels.map(s => [s.nombre, { selector: s.selector, pagina: s.pagina, texto: s.texto_visible }])) });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor selector-healer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "selector-healer", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[selector-healer] fatal:", e);
  process.exit(1);
});

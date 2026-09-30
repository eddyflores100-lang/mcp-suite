#!/usr/bin/env node
/**
 * MCP Server: Argument Cartographer
 * Mapas de argumento estilo Toulmin: afirmación, garantía, respaldo y refutación — con los huecos visibles
 *
 * Dolor que resuelve: El argumento del agente SUENA sólido pero le falta la garantía que conecta datos con conclusión: nadie dibuja el mapa, así que el agujero lógico queda invisible hasta que un humano lo destapa en producción.
 * Categoría: Razonamiento | Generado por mcp-suite | id: argument-cartographer
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

// ——— persistencia local: ~/.mcp-suite/argument-cartographer/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "argument-cartographer");
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

const server = new McpServer({ name: "argument-cartographer", version: "1.0.0" });

server.tool(
  "map_argument",
  "Mapea un argumento completo en componentes Toulmin.",
  {
  nombre: z.string().describe("Nombre del argumento"),
  claim: z.string().describe("La afirmación principal"),
  grounds: z.string().describe("Los datos/evidencia que la apoyan"),
  warrant: z.string().describe("La regla que conecta grounds con claim (¿por qué esos datos implican esa conclusión?)").optional(),
  backing: z.string().describe("Qué respalda la garantía (estudio, norma, experiencia)").optional(),
  qualifier: z.string().describe("Matiz del claim (probablemente, en general, salvo...)").optional(),
  rebuttal: z.string().describe("Condiciones bajo las que el claim cae").optional(),
  },
  async (args: any) => {
    const { nombre, claim, grounds, warrant, backing, qualifier, rebuttal } = args as any;
    const st = store.load();
st.argumentos = st.argumentos || {};
if (st.argumentos[nombre]) return fail("argumento ya mapeado: " + nombre);
st.argumentos[nombre] = { nombre, claim, grounds, warrant: warrant || null, backing: backing || null, qualifier: qualifier || null, rebuttal: rebuttal || null, mapeado: new Date().toISOString(), ataques_recibidos: [] };
store.save(st);
return ok({ nombre, componentes: { claim: "OK", grounds: "OK", warrant: warrant ? "OK" : "FALTA", backing: backing ? "OK" : "FALTA", qualifier: qualifier ? "OK" : "FALTA (afirmación absoluta sin matiz)", rebuttal: rebuttal ? "OK" : "FALTA (no se contempla cuándo fallaría)" }, siguiente: "audita con find_gaps" });
  }
);

server.tool(
  "find_gaps",
  "Detecta los huecos lógicos del argumento: componentes faltantes y conexiones débiles.",
  {
  nombre: z.string().describe("Argumento"),
  },
  async (args: any) => {
    const { nombre } = args as any;
    const st = store.load();
const a = (st.argumentos || {})[nombre];
if (!a) return fail("argumento no encontrado: " + nombre);
const huecos = [];
if (!a.warrant) huecos.push({ componente: "warrant", severidad: "ALTA", detalle: "no existe la regla que conecte los datos con la conclusión: el argumento es una yuxtaposición, no una inferencia", remedio: "escribe explícitamente: 'SI " + a.grounds.slice(0, 40) + "... ENTONCES " + a.claim.slice(0, 40) + "... PORQUE __'" });
if (!a.backing && a.warrant) huecos.push({ componente: "backing", severidad: a.warrant.length < 40 ? "ALTA" : "media", detalle: "la garantía no tiene respaldo: ¿por qué confiar en esa regla?", remedio: "cita la fuente que valida el warrant" });
if (!a.rebuttal) huecos.push({ componente: "rebuttal", severidad: "media", detalle: "no se contempla ninguna condición de fallo: argumento blindado = argumento dogmático", remedio: "enumera al menos un escenario donde el claim no se sostenga" });
if (!a.qualifier && /\b(todos|todas|siempre|nunca|jamás|ninguno)\b/i.test(a.claim)) huecos.push({ componente: "qualifier", severidad: "ALTA", detalle: "claim ABSOLUTO sin matiz y sin excepciones contempladas", remedio: "sustituye el universal por 'la mayoría/en este contexto/salvo X'" });
const groundsVagos = /\b(muchos|varios|algunos|mucho|bastante|abundante)\b/i.test(a.grounds || "");
if (groundsVagos) huecos.push({ componente: "grounds", severidad: "media", detalle: "evidencia con cuantificadores vagos ('" + (a.grounds.match(/\b(muchos|varios|algunos|mucho|bastante)\b/i) || ["vago"])[0] + "'): sin números no hay falsabilidad", remedio: "cuantifica: cuántos, de qué población, en qué período" });
return ok({ nombre, huecos_totales: huecos.length, huecos, solidez_base: huecos.filter(h => h.severidad === "ALTA").length === 0 ? "estructura completa: la fuerza depende de la verdad de los grounds" : "estructura COJA: corrige los huecos ALTO antes de fiarte de la conclusión" });
  }
);

server.tool(
  "attack_surface",
  "Calcula la superficie de ataque: por dónde caería el argumento primero.",
  {
  nombre: z.string().describe("Argumento"),
  },
  async (args: any) => {
    const { nombre } = args as any;
    const st = store.load();
const a = (st.argumentos || {})[nombre];
if (!a) return fail("argumento no encontrado");
const vectores = [];
if (a.warrant) vectores.push({ vector: "negar el warrant", como: "cuestionar la regla '" + a.warrant.slice(0, 60) + "': buscar un contraejemplo de la misma regla con distinto resultado", resistencia: a.backing ? "media (hay backing)" : "BAJA (sin respaldo)" });
if (a.grounds) vectores.push({ vector: "negar los grounds", como: "atacar la veracidad o la representatividad de: '" + a.grounds.slice(0, 60) + "'", resistencia: /\d/.test(a.grounds) ? "media-alta (hay cifras)" : "BAJA (evidencia no cuantificada)" });
if (!a.rebuttal) vectores.push({ vector: "presentar la rebuttal que falta", como: "encontrar UN caso donde el claim falle: el argumento no contempla excepciones y cae entero", resistencia: "BAJA" });
vectores.push({ vector: "incluir el claim en otro contexto", como: "trasplantar la afirmación a un dominio donde no aplique y mostrar el absurdo", resistencia: a.qualifier ? "media (hay qualifier que acota)" : "BAJA" });
const masDebil = vectores.filter(v => v.resistencia.startsWith("BAJA"));
return ok({ nombre, vectores_de_ataque: vectores, vectores_sin_defensa: masDebil.map(v => v.vector), refuerza_primero: masDebil[0] ? masDebil[0].vector : "ningún vector está indefenso: argumento robusto (no por ello correcto)" });
  }
);

server.tool(
  "strength_score",
  "Puntúa la solidez estructural del argumento (0-100) con desglose.",
  {
  nombre: z.string().describe("Argumento"),
  },
  async (args: any) => {
    const { nombre } = args as any;
    const st = store.load();
const a = (st.argumentos || {})[nombre];
if (!a) return fail("argumento no encontrado");
const partes = [
  { parte: "claim matizado", pts: a.qualifier ? 15 : /\b(todos|siempre|nunca)\b/i.test(a.claim) ? 0 : 8, nota: a.qualifier ? "qualifier presente" : "sin qualifier" },
  { parte: "grounds cuantificados", pts: /\d/.test(a.grounds || "") ? 25 : 10, nota: /\d/.test(a.grounds || "") ? "evidencia con cifras" : "evidencia cualitativa" },
  { parte: "warrant explícito", pts: a.warrant ? 25 : 0, nota: a.warrant ? "regla de inferencia presente" : "inferencia implícita: el eslabón perdido" },
  { parte: "backing del warrant", pts: a.backing ? 15 : 0, nota: a.backing ? "respaldo citado" : "warrant en el aire" },
  { parte: "rebuttal contemplada", pts: a.rebuttal ? 20 : 5, nota: a.rebuttal ? "excepciones previstas" : "blindado al fracaso" }
];
const total = partes.reduce((s, p) => s + p.pts, 0);
a.ultimo_score = { total, ts: new Date().toISOString() };
store.save(st);
return ok({ nombre, score_estructural: total + "/100", desglose: partes, nivel: total >= 80 ? "SÓLIDO: sobrevive auditoría" : total >= 55 ? "MEJORABLE: refuerza los puntos flojos antes de decidir con él" : "FRÁGIL: este argumento no debe sostener ninguna decisión" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor argument-cartographer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "argument-cartographer", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[argument-cartographer] fatal:", e);
  process.exit(1);
});

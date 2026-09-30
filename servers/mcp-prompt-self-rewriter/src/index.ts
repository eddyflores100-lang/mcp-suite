#!/usr/bin/env node
/**
 * MCP Server: Prompt Self-Rewriter
 * Auto-edición de prompts con guardarrailes: el agente propone su propia mejora pero no puede debilitar sus restricciones
 *
 * Dolor que resuelve: El agente 'optimiza' su propio prompt y sin querer borra la línea que prohibía exfiltrar datos: la auto-mejora sin candados es la vía rápida a la auto-anulación de las normas.
 * Categoría: Auto-Mejora | Generado por mcp-suite | id: prompt-self-rewriter
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

// ——— persistencia local: ~/.mcp-suite/prompt-self-rewriter/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "prompt-self-rewriter");
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

const server = new McpServer({ name: "prompt-self-rewriter", version: "1.0.0" });

server.tool(
  "register_prompt",
  "Registra el prompt actual con su intención y la lista de restricciones intocables.",
  {
  nombre: z.string().describe("Nombre del prompt"),
  contenido: z.string().describe("Texto completo actual"),
  intencion: z.string().describe("Qué debe lograr el prompt"),
  restricciones: z.array(z.any()).describe("Restricciones que NUNCA pueden debilitarse (texto o resumen por línea)"),
  },
  async (args: any) => {
    const { nombre, contenido, intencion, restricciones } = args as any;
    const st = store.load();
st.prompts = st.prompts || {};
if (st.prompts[nombre]) return fail("prompt ya registrado: " + nombre);
if (!restricciones || !restricciones.length) return fail("SIN restricciones declaradas no hay auto-edición segura: declara al menos las que protegen datos y alcance");
st.prompts[nombre] = { nombre, contenido, intencion, restricciones: restricciones.map(String), ediciones: [], adoptadas: 0, rechazadas: 0, registrado: new Date().toISOString() };
store.save(st);
return ok({ nombre, restricciones_intocables: restricciones.length, caracteres: contenido.length, nota: "toda edición pasará por guardrail_check antes de poder adoptarse" });
  }
);

server.tool(
  "propose_edit",
  "Propón una edición concreta del prompt con justificación basada en evidencia.",
  {
  nombre: z.string().describe("Prompt"),
  tipo: z.enum(["añadir_instruccion","clarificar_ambiguedad","reordenar","recortar_ruido","añadir_ejemplo"]).describe("Naturaleza de la edición"),
  edicion: z.string().describe("El cambio concreto (texto a añadir/quitar/reordenar)"),
  porque: z.string().describe("Evidencia de que mejora: qué fallo concreto corrige"),
  },
  async (args: any) => {
    const { nombre, tipo, edicion, porque } = args as any;
    const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado");
if (!porque || porque.length < 20) return fail("la justificación es débil ('" + (porque || "vacía") + "'): sin evidencia de un fallo concreto, la edición es capricho");
p.ediciones.push({ tipo, edicion, porque, estado: "propuesta", ts: new Date().toISOString() });
store.save(st);
return ok({ edicion_propuesta: p.ediciones.length, tipo, siguiente: "pasa guardrail_check antes de tocar el prompt" });
  }
);

server.tool(
  "guardrail_check",
  "Valida una edición propuesta contra las restricciones intocables y la intención del prompt.",
  {
  nombre: z.string().describe("Prompt"),
  indice: z.number().describe("Índice de la edición propuesta (1-based)"),
  },
  async (args: any) => {
    const { nombre, indice } = args as any;
    const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado");
const ed = p.ediciones[indice - 1];
if (!ed) return fail("edición no encontrada: hay " + p.ediciones.length + " propuestas");
if (ed.estado !== "propuesta") return fail("edición ya procesada: " + ed.estado);
const textoEdicion = ed.edicion.toLowerCase();
const intencionesPeligrosas = [
  { patron: /\b(ignora|omite|salta|desactiva|pasa por alto)\b.*\b(restricciones|restriccion|restricci|reglas|regla|limites|límites|límite|limite|seguridad)/, tipo: "ELUSIÓN_DIRECTA", detalle: "la edición pide ignorar restricciones explícitamente" },
  { patron: /\b(sin limites|sin límites|sin limite|sin límite|ilimitad\w*|todo lo que puedas|máxima libertad|maxima libertad)/, tipo: "AMPLIACIÓN_DE_ALCANCE", detalle: "amplía el alcance permitido" },
  { patron: /\b(no verifiques|no valides|confía en|confia en|asume que es seguro)/, tipo: "DESACTIVA_VERIFICACIÓN", detalle: "propone saltarse verificaciones" },
  { patron: /\b(ignora|olvida)\b.*\b(contexto|instrucciones|previo|anterior)\b/, tipo: "CORTE_DE_MEMORIA", detalle: "pide descartar instrucciones previas: patrón de prompt-injection clásico" }
];
const violaciones = intencionesPeligrosas.filter(v => v.patron.test(textoEdicion)).map(v => ({ tipo: v.tipo, detalle: v.detalle }));
const tocaRestriccion = p.restricciones.some(r => {
  const tokensR = String(r).toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const palabrasEdicion = new Set(textoEdicion.split(/[^a-z0-9áéíóúñ]+/));
  const solape = tokensR.filter(w => palabrasEdicion.has(w)).length;
  return solape >= 2 && /\b(quitar|borrar|elimina|remove|recorta)\b/.test(textoEdicion);
});
if (tocaRestriccion) violaciones.push({ tipo: "TOCA_RESTRICCIÓN", detalle: "la edición recorta texto de una restricción declarada intocable" });
ed.estado = violaciones.length ? "bloqueada" : "aprobada_por_guardrail";
if (violaciones.length) p.rechazadas++; 
store.save(st);
return ok({ edicion: indice, tipo: ed.tipo, estado: ed.estado, violaciones, siguiente: violaciones.length ? "NO adoptes esta edición: rediseñala respetando el guardrail" : "puede adoptarse TRAS pasar la puerta de evaluación (commit_eval)" });
  }
);

server.tool(
  "commit_eval",
  "Puerta de evaluación: adoptar una edición exige evidencia de mejora medida, no opinión.",
  {
  nombre: z.string().describe("Prompt"),
  indice: z.number().describe("Edición aprobada"),
  evidencia_mejora: z.string().describe("Medición de la mejora (A/B, score antes/después)"),
  },
  async (args: any) => {
    const { nombre, indice, evidencia_mejora } = args as any;
    const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado");
const ed = p.ediciones[indice - 1];
if (!ed) return fail("edición no encontrada");
if (ed.estado === "bloqueada") return fail("edición BLOQUEADA por guardrail: inadmisible");
if (ed.estado === "adoptada") return fail("ya adoptada");
if (ed.estado !== "aprobada_por_guardrail") return fail("pasa guardrail_check primero");
if (!evidencia_mejora || !/\d/.test(evidencia_mejora)) return fail("la evidencia de mejora debe contener MEDIDAS (números): 'parece mejor' no es evidencia");
ed.estado = "adoptada";
ed.evidencia = evidencia_mejora;
ed.adoptada = new Date().toISOString();
p.adoptadas++;
store.save(st);
return ok({ edicion: indice, adoptada: true, ediciones_adoptadas: p.adoptadas, rechazadas: p.rechazadas, disciplina: "guardrail + medición = las dos llaves: la auto-mejora sin ambas es deriva" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor prompt-self-rewriter está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "prompt-self-rewriter", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[prompt-self-rewriter] fatal:", e);
  process.exit(1);
});

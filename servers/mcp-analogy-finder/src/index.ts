#!/usr/bin/env node
/**
 * MCP Server: Analogy Finder
 * Analogías ESTRUCTURALES: mapea relaciones entre dominios (no palabras sueltas) y delimita qué se transfiere y qué no
 *
 * Dolor que resuelve: El agente razona por analogía superficial: 'esto es como Netflix' porque ambas cosas tienen suscripciones, y transfiere conclusiones de un dominio a otro sin comprobar que las RELACIONES se corresponden. La analogía falsa es la falacia más productiva que existe.
 * Categoría: Razonamiento | Generado por mcp-suite | id: analogy-finder
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

// ——— persistencia local: ~/.mcp-suite/analogy-finder/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "analogy-finder");
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

const server = new McpServer({ name: "analogy-finder", version: "1.0.0" });

server.tool(
  "register_case",
  "Registra un caso/dominio con sus entidades y relaciones internas.",
  {
  caso: z.string().describe("Nombre del caso/dominio"),
  entidades: z.array(z.any()).describe("Entidades principales {nombre, rol}"),
  relaciones: z.array(z.any()).describe("Relaciones {desde, tipo, hacia} — el tipo ES la estructura (pagar, competir, depender...)"),
  desenlace: z.string().describe("Cómo terminó ese caso (si se sabe)").optional(),
  },
  async (args: any) => {
    const { caso, entidades, relaciones, desenlace } = args as any;
    const st = store.load();
st.casos = st.casos || {};
if (st.casos[caso]) return fail("caso ya registrado: " + caso);
const ents = (entidades || []).filter(e => e && e.nombre).map(e => ({ nombre: String(e.nombre), rol: String(e.rol || "sin rol") }));
const rels = (relaciones || []).filter(r => r && r.desde && r.hacia && r.tipo).map(r => ({ desde: String(r.desde), tipo: String(r.tipo).toLowerCase(), hacia: String(r.hacia) }));
if (ents.length < 2 || rels.length < 1) return fail("necesitas al menos 2 entidades y 1 relación");
st.casos[caso] = { caso, entidades: ents, relaciones: rels, desenlace: desenlace || "desconocido", registrado: new Date().toISOString() };
store.save(st);
return ok({ caso, entidades: ents.length, relaciones: rels.length, estructura: rels.map(r => r.desde + " --" + r.tipo + "--> " + r.hacia), aviso: "define relaciones por su TIPO funcional (paga, depende, compite) y no por su etiqueta superficial" });
  }
);

server.tool(
  "find_analogy",
  "Busca el caso registrado cuya ESTRUCTURA relacional coincide con tu situación actual.",
  {
  entidades_actuales: z.array(z.any()).describe("Entidades de tu situación {nombre, rol}"),
  relaciones_actuales: z.array(z.any()).describe("Relaciones {desde, tipo, hacia}"),
  },
  async (args: any) => {
    const { entidades_actuales, relaciones_actuales } = args as any;
    const st = store.load();
const casos = __vals(st.casos || {});
if (!casos.length) return fail("sin casos registrados");
const misRels = (relaciones_actuales || []).filter(r => r && r.tipo).map(r => ({ desde: String(r.desde), tipo: String(r.tipo).toLowerCase(), hacia: String(r.hacia) }));
if (!misRels.length) return fail("sin relaciones actuales: sin estructura no hay analogía, solo parecido de palabras");
const scores = casos.map(c => {
  let matches = 0;
  const detalles = [];
  c.relaciones.forEach(rc => {
    const rm = misRels.find(x => x.tipo === rc.tipo && (x.desde === rc.desde || x.hacia === rc.hacia));
    const rmTipo = misRels.find(x => x.tipo === rc.tipo);
    if (rm) { matches += 2; detalles.push({ relacion: rc.desde + " --" + rc.tipo + "--> " + rc.hacia, correspondencia: "exacta (tipo y actores)" }); }
    else if (rmTipo) { matches += 1; detalles.push({ relacion: rc.desde + " --" + rc.tipo + "--> " + rc.hacia, correspondencia: "solo tipo (actores distintos)" }); }
  });
  const cobertura = matches / (c.relaciones.length * 2);
  const rolesParecidos = (entidades_actuales || []).filter(e => c.entidades.some(ce => ce.rol && e.rol && String(ce.rol).toLowerCase() === String(e.rol).toLowerCase())).length;
  return { caso: c.caso, score_estructural: Number(cobertura.toFixed(2)), relaciones_cubiertas: detalles.length + "/" + c.relaciones.length, detalle: detalles, roles_alineados: rolesParecidos, desenlace: c.desenlace };
}).sort((a, b) => b.score_estructural - a.score_estructural);
const mejor = scores[0];
return ok({ mejor_analogia: mejor, otras_candidatas: scores.slice(1, 4), advertencia_superficialidad: mejor.score_estructural < 0.4 ? "NINGUNA analogía estructural fuerte: la similitud que percibes es superficial (nombres parecidos); NO transfieras conclusiones" : mejor.score_estructural < 0.7 ? "analogía PARCIAL: transfiere solo lo marcado como correspondencia exacta" : "analogía estructural sólida: la transferencia es defendible" });
  }
);

server.tool(
  "map_transfer",
  "Para una analogía concreta: qué conocimiento se transfiere y qué se queda en casa.",
  {
  caso: z.string().describe("Caso análogo registrado"),
  correspondencias: z.array(z.any()).describe("Mapeo declarado {entidad_o_relacion_del_caso, equivalente_actual}"),
  },
  async (args: any) => {
    const { caso, correspondencias } = args as any;
    const st = store.load();
const c = (st.casos || {})[caso];
if (!c) return fail("caso no registrado: " + caso);
const mapa = (correspondencias || []).filter(x => x && x.entidad_o_relacion_del_caso);
if (!mapa.length) return fail("sin correspondencias declaradas");
const cubiertas = new Set(mapa.map(x => String(x.entidad_o_relacion_del_caso)));
const sinMapear = c.relaciones.filter(r => !cubiertas.has(r.desde + " --" + r.tipo + "--> " + r.hacia) && !cubiertas.has(r.desde) && !cubiertas.has(r.hacia));
return ok({ caso, mapeo: mapa, relaciones_del_caso_sin_equivalente: sinMapear.map(r => r.desde + " --" + r.tipo + "--> " + r.hacia), cobertura: Number(((c.relaciones.length - sinMapear.length) / Math.max(c.relaciones.length, 1) * 100).toFixed(0)) + "%", se_transfiere: mapa.map(x => "lo aprendido sobre '" + x.entidad_o_relacion_del_caso + "' APLICA a '" + x.equivalente_actual + "'"), NO_se_transfiere: sinMapear.length ? sinMapear.map(r => "el mecanismo '" + r.tipo + "' entre " + r.desde + " y " + r.hacia + " NO existe en tu situación: las conclusiones que dependan de él quedan fuera") : ["todo el caso tiene equivalente: transferencia completa"], desenlace_del_caso: c.desenlace, condicional: c.desenlude !== "desconocido" ? null : "el desenlace del caso es desconocido: la analogía orienta pero no predice" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor analogy-finder está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "analogy-finder", tools: 4, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[analogy-finder] fatal:", e);
  process.exit(1);
});

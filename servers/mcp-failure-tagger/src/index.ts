#!/usr/bin/env node
/**
 * MCP Server: Failure Tagger
 * Taxonomía de fallos del agente: etiqueta, agrupa y encuentra el patrón raíz de los errores
 *
 * Dolor que resuelve: Los fallos se tratan como anecdotes: cada error se investiga desde cero porque no hay taxonomía compartida ni conteo por tipo, así que el mismo fallo se 'descubre' diez veces.
 * Categoría: Evaluación Continua | Generado por mcp-suite | id: failure-tagger
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

// ——— persistencia local: ~/.mcp-suite/failure-tagger/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "failure-tagger");
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

const server = new McpServer({ name: "failure-tagger", version: "1.0.0" });

server.tool(
  "get_taxonomy",
  "Devuelve la taxonomía de fallos raíz con señales típicas de cada tipo.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const TAX = {
  percepcion: { desc: "el agente entendió mal la entrada o el contexto", señales: ["responde a otra cosa", "ignora parte del input", "confunde entidades"] },
  planificacion: { desc: "el plan era incorrecto o incompleto", señales: ["paso faltante", "orden subóptimo", "no considera dependencias"] },
  ejecucion_tool: { desc: "la tool/API falló o se llamó mal", señales: ["parametros inválidos", "timeout", "respuesta inesperada de la tool"] },
  alucion: { desc: "inventó hechos o datos", señales: ["cifras sin fuente", "citas inexistentes", "APIs que no existen"] },
  contexto: { desc: "perdió o desbordó contexto", señales: ["olvida instrucciones previas", "repite trabajo", "desborda ventana"] },
  formato_salida: { desc: "el contenido era correcto pero el formato no", señales: ["JSON inválido", "schema violado", "idioma incorrecto"] },
  razonamiento: { desc: "lógica o aritmética errónea", señales: ["cálculo mal", "condición invertida", "inferencia no válida"] },
  coordinacion: { desc: "falla entre múltiples agentes/handoffs", señales: ["trabajo duplicado", "mensaje perdido", "deadlock"] },
  seguridad: { desc: "vulneró política o filtró datos", señales: ["inyección no detectada", "PII expuesta", "acción no autorizada"] },
  recursos: { desc: "se quedó sin presupuesto/tiempo", señales: ["timeout global", "tokens agotados", "rate limit"] },
};
return ok({ tipos: Object.keys(TAX), taxonomia: TAX });
  }
);

server.tool(
  "tag_failure",
  "Etiqueta un incidente con tipo raíz, descripción y causa probable (alimentado por quien investiga).",
  {
  titulo: z.string().describe("Título corto del incidente"),
  tipo: z.enum(["percepcion","planificacion","ejecucion_tool","alucion","contexto","formato_salida","razonamiento","coordinacion","seguridad","recursos"]).describe("Tipo raíz"),
  descripcion: z.string().describe("Qué pasó exactamente"),
  causa_probable: z.string().describe("Causa raíz estimada"),
  severidad: z.enum(["baja","media","alta","critica"]).describe("Severidad").default("media"),
  },
  async (args: any) => {
    const { titulo, tipo, descripcion, causa_probable, severidad } = args as any;
    const st = store.load();
st.incidentes = st.incidentes || [];
const id = "inc_" + Date.now().toString(36);
st.incidentes.push({ id, titulo, tipo, descripcion, causa_probable, severidad, ts: new Date().toISOString(), fix: null });
store.save(st);
return ok({ incidente_id: id, tipo, severidad });
  }
);

server.tool(
  "attach_fix",
  "Adjunta el fix aplicado a un incidente y márcalo resuelto.",
  {
  incidente_id: z.string().describe("ID del incidente"),
  fix: z.string().describe("Qué se cambió para resolverlo"),
  verificado: z.boolean().describe("¿Se verificó que ya no ocurre?").default(false),
  },
  async (args: any) => {
    const { incidente_id, fix, verificado } = args as any;
    const st = store.load();
const i = (st.incidentes || []).find(x => x.id === incidente_id);
if (!i) return fail("incidente no encontrado");
i.fix = fix;
i.resuelto = true;
i.verificado = verificado;
i.resuelto_ts = new Date().toISOString();
store.save(st);
return ok({ incidente: i.id, resuelto: true, verificado });
  }
);

server.tool(
  "failure_stats",
  "Estadísticas por tipo: frecuencia, severidad media y tasa de recurrencia (mismo tipo sin fix verificado).",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const incs = st.incidentes || [];
if (!incs.length) return ok({ incidentes: 0, sugerencia: "etiqueta fallos con tag_failure" });
const SEV = { baja: 1, media: 2, alta: 3, critica: 4 };
const porTipo = {};
for (const i of incs) {
  porTipo[i.tipo] = porTipo[i.tipo] || { total: 0, sevSuma: 0, resueltos: 0, verificados: 0 };
  porTipo[i.tipo].total++;
  porTipo[i.tipo].sevSuma += SEV[i.severidad] || 2;
  if (i.resuelto) porTipo[i.tipo].resueltos++;
  if (i.verificado) porTipo[i.tipo].verificados++;
}
const filas = __ents(porTipo).map(([tipo, v]) => ({
  tipo, incidentes: v.total,
  severidad_media: Number((v.sevSuma / v.total).toFixed(1)),
  resueltos: v.resueltos,
  verificados: v.verificados,
  recurrencia_activa: v.total - v.verificados,
})).sort((a, b) => b.incidentes - a.incidentes);
return ok({
  incidentes: incs.length,
  por_tipo: filas,
  tipo_dominante: filas[0]?.tipo,
  criticos_sin_verificar: incs.filter(i => i.severidad === "critica" && !i.verificado).length,
  consejo: filas[0] && filas[0].recurrencia_activa > 2 ? "el tipo '" + filas[0].tipo + "' recurre: es un problema sistémico, no anecdótico: arregla la CAUSA no el síntoma" : "sin recurrencia dominante",
});
  }
);

server.tool(
  "postmortem_list",
  "Lista incidentes con fix o críticos sin resolver, para reunión de retrospectiva.",
  {
  solo_abiertos: z.boolean().describe("Solo no resueltos/no verificados").default(false),
  },
  async (args: any) => {
    const { solo_abiertos } = args as any;
    const st = store.load();
let incs = st.incidentes || [];
if (solo_abiertos) incs = incs.filter(i => !i.verificado);
return ok({
  total: incs.length,
  incidentes: incs.slice(-15).reverse().map(i => ({ id: i.id, titulo: i.titulo, tipo: i.tipo, severidad: i.severidad, resuelto: !!i.resuelto, verificado: !!i.verificado, causa: i.causa_probable?.slice(0, 80), fix: i.fix?.slice(0, 80) || null })),
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor failure-tagger está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "failure-tagger", tools: 6, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[failure-tagger] fatal:", e);
  process.exit(1);
});

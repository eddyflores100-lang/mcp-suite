#!/usr/bin/env node
/**
 * MCP Server: Skill Forge
 * Convierte lecciones repetidas en skills/playbooks versionados: conocimiento procedural reutilizable
 *
 * Dolor que resuelve: Las lecciones sueltas no bastan para tareas complejas: el agente re-deriva el mismo procedimiento multi-paso cada vez porque nunca se empaquetó como skill con pasos, precondiciones y trampas.
 * Categoría: Aprendizaje de Habilidades | Generado por mcp-suite | id: skill-forge
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

// ——— persistencia local: ~/.mcp-suite/skill-forge/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "skill-forge");
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

const server = new McpServer({ name: "skill-forge", version: "1.0.0" });

server.tool(
  "forge_skill",
  "Crea una skill a partir de un procedimiento: pasos, precondiciones, trampas y criterio de éxito.",
  {
  nombre: z.string().describe("Nombre de la skill"),
  proposito: z.string().describe("Para qué sirve"),
  pasos: z.array(z.any()).describe("Pasos en orden"),
  precondiciones: z.array(z.any()).describe("Qué debe ser cierto antes de empezar").default([]),
  trampas: z.array(z.any()).describe("Errores conocidos que evitar").default([]),
  criterio_exito: z.string().describe("Cómo saber que funcionó"),
  },
  async (args: any) => {
    const { nombre, proposito, pasos, precondiciones, trampas, criterio_exito } = args as any;
    const st = store.load();
st.skills = st.skills || {};
if (st.skills[nombre]) return fail("skill existente: crea versión nueva o edítala");
if (!Array.isArray(pasos) || pasos.length < 2) return fail("una skill con <2 pasos es una nota, no un procedimiento");
st.skills[nombre] = {
  nombre, proposito,
  pasos: pasos.map((p, i) => ({ n: i + 1, paso: String(p) })),
  precondiciones: (precondiciones || []).map(String),
  trampas: (trampas || []).map(String),
  criterio_exito,
  version: 1, usos: 0, exitos: 0, creado: new Date().toISOString(),
};
store.save(st);
return ok({ skill: nombre, version: 1, pasos: pasos.length, trampas: (trampas || []).length });
  }
);

server.tool(
  "get_skill",
  "Recupera la skill completa para ejecutarla (con checklist de precondiciones).",
  {
  nombre: z.string().describe("Nombre de la skill"),
  },
  async (args: any) => {
    const { nombre } = args as any;
    const st = store.load();
const s = (st.skills || {})[nombre];
if (!s) return fail("skill no encontrada: " + nombre);
s.usos++;
store.save(st);
return ok({
  ...s,
  checklist_ejecucion: [
    ...s.precondiciones.map(p => "PRE: verifica " + p),
    ...s.pasos.map(p => "PASO " + p.n + ": " + p.paso),
    ...(s.trampas.length ? ["CUIDADO: " + s.trampas.join(" | ")] : []),
    "FIN: confirma criterio de éxito: " + s.criterio_exito,
  ],
  tasa_exito_historica: s.usos > 1 ? Number((s.exitos / (s.usos - 1)).toFixed(2)) : null,
});
  }
);

server.tool(
  "report_outcome",
  "Registra el resultado de usar la skill (éxito o fallo con paso del fallo) para su refinamiento.",
  {
  nombre: z.string().describe("Skill usada"),
  exito: z.boolean().describe("¿Funcionó?"),
  fallo_en_paso: z.number().describe("Si falló: número de paso").optional(),
  nota: z.string().describe("Contexto del resultado").optional(),
  },
  async (args: any) => {
    const { nombre, exito, fallo_en_paso, nota } = args as any;
    const st = store.load();
const s = (st.skills || {})[nombre];
if (!s) return fail("skill no encontrada");
if (exito) s.exitos++;
s.historial = s.historial || [];
s.historial.push({ exito, fallo_en_paso: fallo_en_paso || null, nota: nota || null, ts: new Date().toISOString() });
if (s.historial.length > 100) s.historial = s.historial.slice(-60);
store.save(st);
const usosEfectivos = Math.max(s.usos - 1, 1);
const tasa = Number((s.exitos / usosEfectivos).toFixed(2));
return ok({
  skill: nombre, exito,
  tasa_exito: tasa,
  paso_mas_fallido: (() => { const f = {}; for (const h of s.historial || []) if (h.fallo_en_paso) f[h.fallo_en_paso] = (f[h.fallo_en_paso] || 0) + 1; const e = __ents(f).sort((a, b) => b[1] - a[1])[0]; return e ? { paso: Number(e[0]), fallos: e[1] } : null; })(),
  aviso: tasa < 0.6 && s.usos > 5 ? "tasa de éxito <60% con 5+ usos: refactoriza el paso débil o la trampa no cubierta" : null,
});
  }
);

server.tool(
  "refine_skill",
  "Refina una skill: añade paso, trampa o ajusta criterio — crea versión nueva con historial de cambios.",
  {
  nombre: z.string().describe("Skill a refinar"),
  pasos_extra: z.array(z.any()).describe("Pasos a añadir al final").optional(),
  trampas_extra: z.array(z.any()).describe("Trampas nuevas descubiertas").optional(),
  criterio_exito: z.string().describe("Criterio actualizado").optional(),
  motivo: z.string().describe("Qué fallo motivó el refinamiento"),
  },
  async (args: any) => {
    const { nombre, pasos_extra, trampas_extra, criterio_exito, motivo } = args as any;
    const st = store.load();
const s = (st.skills || {})[nombre];
if (!s) return fail("skill no encontrada");
if (!motivo) return fail("todo refinamiento documenta su motivo");
let n = s.pasos.length;
for (const p of (pasos_extra || [])) { n++; s.pasos.push({ n, paso: String(p) }); }
s.trampas.push(...(trampas_extra || []).map(String));
if (criterio_exito) s.criterio_exito = criterio_exito;
s.version++;
s.changes = s.changes || [];
s.changes.push({ version: s.version, motivo, ts: new Date().toISOString() });
store.save(st);
return ok({ skill: nombre, version: s.version, pasos: s.pasos.length, trampas: s.trampas.length });
  }
);

server.tool(
  "skill_catalog",
  "Catálogo de skills con madurez (tasa de éxito y usos): qué está listo para delegar.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const skills = __vals(st.skills || {});
if (!skills.length) return ok({ skills: 0, sugerencia: "forja la primera skill con forge_skill" });
return ok({
  skills: skills.map(s => ({
    nombre: s.nombre, proposito: s.proposito.slice(0, 60), version: s.version,
    pasos: s.pasos.length, usos: s.usos,
    madurez: s.usos >= 5 && s.exitos / Math.max(s.usos - 1, 1) >= 0.8 ? "producción" : s.usos >= 2 ? "en prueba" : "sin validar",
  })).sort((a, b) => b.usos - a.usos),
});
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor skill-forge está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "skill-forge", tools: 6, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[skill-forge] fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Key Rotation Manager
 * Rotación de claves con ventana de gracia: rota sin romper verificaciones en curso y con historial auditable
 *
 * Dolor que resuelve: El agente rota su clave de golpe y todas las firmas/verificaciones en vuelo fallan de forma misteriosa; o peor: nunca rota y la clave eterna se filtra. La rotación segura es un proceso, no un comando.
 * Categoría: Identidad Federada | Generado por mcp-suite | id: key-rotation-manager
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

// ——— persistencia local: ~/.mcp-suite/key-rotation-manager/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "key-rotation-manager");
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

const server = new McpServer({ name: "key-rotation-manager", version: "1.0.0" });

server.tool(
  "register_identity",
  "Registra una identidad criptográfica con su clave inicial y política de rotación.",
  {
  identidad: z.string().describe("Nombre de la identidad/propósito de la clave"),
  clave_inicial: z.string().describe("Material o referencia de la clave inicial (id/hash, no el secreto)"),
  periodo_dias: z.number().describe("Rotar cada N días (0 = manual)").default(90),
  gracia_horas: z.number().describe("Horas que la clave vieja sigue VERIFICANDO tras rotar").default(72),
  },
  async (args: any) => {
    const { identidad, clave_inicial, periodo_dias, gracia_horas } = args as any;
    const st = store.load();
st.identidades = st.identidades || {};
if (st.identidades[identidad]) return fail("identidad ya registrada: " + identidad);
st.identidades[identidad] = { identidad, periodo_dias, gracia_horas, claves: [{ id: "k1", material: clave_inicial, rol: "activa", desde: new Date().toISOString() }], rotaciones: 0, historial: [] };
store.save(st);
return ok({ identidad, clave_activa: "k1", politica: { rotar_cada_dias: periodo_dias, gracia_verificacion_horas: gracia_horas } });
  }
);

server.tool(
  "perform_rotation",
  "Ejecuta la rotación: la clave activa pasa a gracia (solo verifica) y una nueva queda activa (solo firma).",
  {
  identidad: z.string().describe("Identidad a rotar"),
  nueva_clave: z.string().describe("Material/referencia de la nueva clave"),
  razon: z.string().describe("Por qué rotas (programada, sospecha, fuga)").default("programada"),
  },
  async (args: any) => {
    const { identidad, nueva_clave, razon } = args as any;
    const st = store.load();
const id = (st.identidades || {})[identidad];
if (!id) return fail("identidad no registrada");
const activa = id.claves.find(k => k.rol === "activa");
if (!activa) return fail("sin clave activa: estado corrupto, revisa historial");
activa.rol = "gracia";
activa.hasta = new Date(Date.now() + id.gracia_horas * 3600000).toISOString();
const nuevoId = "k" + (id.claves.length + 1);
id.claves.push({ id: nuevoId, material: nueva_clave, rol: "activa", desde: new Date().toISOString() });
id.rotaciones++;
id.historial.push({ rotacion: id.rotaciones, de: activa.id, a: nuevoId, razon, ts: new Date().toISOString() });
const enGracia = id.claves.filter(k => k.rol === "gracia");
store.save(st);
return ok({ identidad, nueva_clave_activa: nuevoId, clave_anterior: { id: activa.id, verifica_hasta: activa.hasta, aviso: "las firmas hechas con " + activa.id + " siguen verificando " + id.gracia_horas + "h" }, en_gracia: enGracia.map(k => k.id), total_rotaciones: id.rotaciones });
  }
);

server.tool(
  "check_key_status",
  "Consulta qué puede hacer cada clave: firmar (activa), solo verificar (gracia) o nada (muerta).",
  {
  identidad: z.string().describe("Identidad"),
  },
  async (args: any) => {
    const { identidad } = args as any;
    const st = store.load();
const id = (st.identidades || {})[identidad];
if (!id) return fail("identidad no registrada");
const ahora = Date.now();
const claves = id.claves.map(k => {
  let rolEfectivo = k.rol;
  if (k.rol === "gracia" && k.hasta && new Date(k.hasta).getTime() < ahora) rolEfectivo = "muerta";
  return { id: k.id, rol_declarado: k.rol, rol_efectivo: rolEfectivo, puede_firmar: rolEfectivo === "activa", puede_verificar: rolEfectivo === "activa" || rolEfectivo === "gracia", desde: k.desde, verifica_hasta: k.hasta || null };
});
const activa = claves.find(k => k.puede_firmar);
return ok({ identidad, rotaciones: id.rotaciones, claves, resumen: { firmables: claves.filter(k => k.puede_firmar).length, solo_verificacion: claves.filter(k => k.puede_verificar && !k.puede_firmar).length, muertas: claves.filter(k => !k.puede_verificar).length }, clave_para_firmar: activa ? activa.id : "NINGUNA: rota ya", politica: { cada_dias: id.periodo_dias, gracia_horas: id.gracia_horas } });
  }
);

server.tool(
  "rotation_due",
  "Detecta rotaciones vencidas o a punto de vencer según la política.",
  {
  margen_dias: z.number().describe("Días de aviso previo").default(7),
  },
  async (args: any) => {
    const { margen_dias } = args as any;
    const st = store.load();
const ids = __vals(st.identidades || {});
if (!ids.length) return ok({ identidades: 0, mensaje: "sin identidades registradas" });
const avisos = [];
ids.forEach(id => {
  if (id.periodo_dias === 0) return;
  const activa = id.claves.find(k => k.rol === "activa");
  if (!activa) { avisos.push({ identidad: id.identidad, estado: "SIN_CLAVE_ACTIVA", accion: "rota inmediatamente" }); return; }
  const edadDias = (Date.now() - new Date(activa.desde).getTime()) / 86400000;
  if (edadDias >= id.periodo_dias) avisos.push({ identidad: id.identidad, estado: "VENCIDA", edad_clave_dias: Number(edadDias.toFixed(1)), politica: id.periodo_dias + " días", accion: "rota HOY" });
  else if (edadDias >= id.periodo_dias - margen_dias) avisos.push({ identidad: id.identidad, estado: "PROXIMA", edad_clave_dias: Number(edadDias.toFixed(1)), vence_en_dias: Number((id.periodo_dias - edadDias).toFixed(1)), accion: "planifica la rotación" });
});
return ok({ identidades: ids.length, pendientes: avisos.length, avisos, sin_alerta: ids.filter(id => id.periodo_dias > 0 || id.claves.some(k => k.rol === "activa")).length - avisos.length });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor key-rotation-manager está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "key-rotation-manager", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[key-rotation-manager] fatal:", e);
  process.exit(1);
});

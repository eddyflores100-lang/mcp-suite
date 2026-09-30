#!/usr/bin/env node
/**
 * MCP Server: Tenant Isolator
 * Aislamiento de contexto por inquilino: cada sesión ligada a su tenant y todo acceso cruzado denegado con evidencia
 *
 * Dolor que resuelve: El agente atiende a ClienteA y ClienteB en la misma memoria: el contexto de una filtración de datos entre tenants es silenciosa y total. 'Confío en que el prompt lo evita' no es aislamiento, es fe.
 * Categoría: Multi-Tenant | Generado por mcp-suite | id: tenant-isolator
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

// ——— persistencia local: ~/.mcp-suite/tenant-isolator/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "tenant-isolator");
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

const server = new McpServer({ name: "tenant-isolator", version: "1.0.0" });

server.tool(
  "register_tenant",
  "Registra un inquilino (cliente, usuario, departamento) del agente.",
  {
  tenant: z.string().describe("Identificador único del tenant"),
  nombre_visible: z.string().describe("Nombre para mostrar").optional(),
  clasificacion: z.enum(["estandar","protegido","regulado"]).describe("Sensibilidad del tenant").default("estandar"),
  },
  async (args: any) => {
    const { tenant, nombre_visible, clasificacion } = args as any;
    const st = store.load();
st.tenants = st.tenants || {};
if (st.tenants[tenant]) return fail("tenant ya registrado: " + tenant);
st.tenants[tenant] = { tenant, nombre: nombre_visible || tenant, clasificacion, sesiones: [], creado: new Date().toISOString() };
store.save(st);
return ok({ tenant, clasificacion, nota: clasificacion === "regulado" ? "tenant REGULADO: todo acceso quedará auditado con mayor detalle" : "registrado" });
  }
);

server.tool(
  "bind_session",
  "Vincula una sesión/conversación a UN tenant (decisión inmutable por diseño).",
  {
  sesion: z.string().describe("Id de sesión/conversación"),
  tenant: z.string().describe("Tenant al que pertenece"),
  },
  async (args: any) => {
    const { sesion, tenant } = args as any;
    const st = store.load();
st.tenants = st.tenants || {};
st.bindings = st.bindings || {};
if (!st.tenants[tenant]) return fail("tenant no registrado: " + tenant);
const previo = st.bindings[sesion];
if (previo && previo.tenant !== tenant) return fail("LA SESIÓN YA ESTÁ LIGADA A '" + previo.tenant + "': el binding es inmutable por aislamiento. Abre sesión nueva para '" + tenant + "'");
if (previo) return ok({ sesion, tenant, ya_ligada: true, desde: previo.desde });
st.bindings[sesion] = { sesion, tenant, desde: new Date().toISOString() };
st.tenants[tenant].sesiones.push(sesion);
store.save(st);
return ok({ sesion, tenant, ligada: true, regla: "todo recurso que toque esta sesión debe pertenecer a '" + tenant + "' (verifica con check_access)" });
  }
);

server.tool(
  "check_access",
  "Verifica que una sesión puede tocar un recurso: el dueño del recurso debe ser su tenant.",
  {
  sesion: z.string().describe("Sesión que pide el acceso"),
  recurso: z.string().describe("Recurso al que se accede (id o ruta)"),
  dueño_recurso: z.string().describe("Tenant dueño del recurso"),
  operacion: z.string().describe("Operación (leer, escribir, borrar)").default("leer"),
  },
  async (args: any) => {
    const { sesion, recurso, dueño_recurso, operacion } = args as any;
    const st = store.load();
const b = (st.bindings || {})[sesion];
if (!b) return fail("sesión sin binding: lígala a un tenant con bind_session ANTES de tocar recursos");
if (b.tenant === dueño_recurso) {
  b.accesos = (b.accesos || 0) + 1;
  store.save(st);
  return ok({ permitido: true, sesion, tenant: b.tenant, recurso, operacion, razon: "recurso del propio tenant" });
}
st.violaciones = st.violaciones || [];
st.violaciones.push({ sesion, tenant_sesion: b.tenant, dueño_recurso, recurso, operacion, ts: new Date().toISOString() });
store.save(st);
const esRegulado = (st.tenants || {})[dueño_recurso]?.clasificacion === "regulado";
return ok({ permitido: false, sesion, tenant_sesion: b.tenant, dueño_recurso, recurso, operacion, razon: "CRUZADO: la sesión de '" + b.tenant + "' intenta tocar recurso de '" + dueño_recurso + "'" + (esRegulado ? " y el recurso es de tenant REGULADO: reportable" : ""), severidad: esRegulado ? "ALTA (tenant regulado)" : "media", violaciones_de_esta_sesion: st.violaciones.filter(v => v.sesion === sesion).length, accion: "DENIEGA la operación y no metas el contenido del recurso en el contexto de la sesión" });
  }
);

server.tool(
  "isolation_report",
  "Reporte de aislamiento: sesiones por tenant, violaciones y patrones sospechosos.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const bindings = __vals(st.bindings || {});
const violaciones = st.violaciones || [];
if (!bindings.length) return ok({ sesiones: 0, mensaje: "sin sesiones ligadas: nada que auditar aún" });
const porTenant = {};
bindings.forEach(b => { porTenant[b.tenant] = (porTenant[b.tenant] || 0) + 1; });
const porSesionViol = {};
violaciones.forEach(v => { porSesionViol[v.sesion] = (porSesionViol[v.sesion] || 0) + 1; });
const reincidentes = Object.keys(porSesionViol).filter(s => porSesionViol[s] >= 3);
return ok({ sesiones_totales: bindings.length, tenants_activos: Object.keys(porTenant).length, sesiones_por_tenant: porTenant, violaciones_totales: violaciones.length, por_dueno_del_recurso: violaciones.reduce((acc, v) => { acc[v.dueño_recurso] = (acc[v.dueño_recurso] || 0) + 1; return acc; }, {}), sesiones_reincidentes: reincidentes, alerta: reincidentes.length ? "sesiones con 3+ intentos cruzados: " + reincidentes.join(", ") + " — patrón de sondeo: congela y revisa" : violaciones.length > 0 ? "violaciones puntuales registradas: revisa por qué se tentaron" : "aislamiento limpio" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor tenant-isolator está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "tenant-isolator", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[tenant-isolator] fatal:", e);
  process.exit(1);
});

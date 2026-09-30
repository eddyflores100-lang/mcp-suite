#!/usr/bin/env node
/**
 * MCP Server: Rollback Manager
 * Volver atrás en un paso: snapshots nombrados de configuración del agente con restauración verificada
 *
 * Dolor que resuelve: El cambio de configuración rompe al agente a las 3am: 'volver atrás' significa recordar qué 6 archivos se tocaron y rezar. Sin snapshots nombrados ni rollback de un comando, cada regresión es arqueología manual.
 * Categoría: Agent CI/CD | Generado por mcp-suite | id: rollback-manager
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

// ——— persistencia local: ~/.mcp-suite/rollback-manager/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "rollback-manager");
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

const server = new McpServer({ name: "rollback-manager", version: "1.0.0" });

server.tool(
  "capture_snapshot",
  "Captura un snapshot nombrado de la configuración actual del agente.",
  {
  etiqueta: z.string().describe("Nombre del snapshot (ej: pre-migracion-router)"),
  config: z.any().describe("Objeto de configuración completo a congelar"),
  razon: z.string().describe("Por qué se captura (antes de cambiar X)").optional(),
  },
  async (args: any) => {
    const { etiqueta, config, razon } = args as any;
    const st = store.load();
st.snapshots = st.snapshots || [];
if (st.snapshots.some(s => s.etiqueta === etiqueta)) return fail("etiqueta ya usada: " + etiqueta + " (el historial es inmutable)");
const crypto = await import("node:crypto");
const hash = crypto.createHash("sha256").update(JSON.stringify(config)).digest("hex").slice(0, 16);
st.snapshots.push({ etiqueta, config, razon: razon || "", hash, ts: new Date().toISOString(), restaurado: 0 });
store.save(st);
return ok({ etiqueta, claves_congeladas: Object.keys(config || {}).length, hash, creado: st.snapshots[st.snapshots.length - 1].ts, uso: "rollback_to('" + etiqueta + "') si algo sale mal" });
  }
);

server.tool(
  "rollback_to",
  "Restaura la configuración a un snapshot: devuelve la config completa y verifica el hash.",
  {
  etiqueta: z.string().describe("Snapshot a restaurar"),
  verificacion: z.any().describe("Config actual para calcular qué cambirá (opcional, mejora el reporte)").optional(),
  },
  async (args: any) => {
    const { etiqueta, verificacion } = args as any;
    const st = store.load();
const s = (st.snapshots || []).find(x => x.etiqueta === etiqueta);
if (!s) return fail("snapshot no encontrado: " + etiqueta + " (disponibles: " + st.snapshots.map(x => x.etiqueta).join(", ") + ")");
const crypto = await import("node:crypto");
const hashAhora = crypto.createHash("sha256").update(JSON.stringify(s.config)).digest("hex").slice(0, 16);
const integro = hashAhora === s.hash;
if (!integro) return fail("snapshot CORRUPTO: hash no coincide, no restaures: re-captura de otra fuente");
s.restaurado++;
st.rollbacks = st.rollbacks || [];
st.rollbacks.push({ a: etiqueta, ts: new Date().toISOString() });
store.save(st);
let cambios = null;
if (verificacion !== undefined && verificacion !== null) {
  const clavesAntes = new Set(Object.keys(verificacion || {}));
  const clavesSnap = new Set(Object.keys(s.config || {}));
  cambios = {
    reapareceran: [...clavesSnap].filter(k => !clavesAntes.has(k)),
    desapareceran: [...clavesAntes].filter(k => !clavesSnap.has(k)),
    cambiaran: [...clavesSnap].filter(k => clavesAntes.has(k) && JSON.stringify((s.config || {})[k]) !== JSON.stringify((verificacion || {})[k]))
  };
}
return ok({ restaurado_a: etiqueta, config: s.config, integridad: "verificada (" + s.hash + ")", capturado: s.ts, razon_original: s.razon, restauraciones_previas: s.restaurado - 1, efectos: cambios, aviso: s.restaurado > 2 ? "este snapshot se restaura por " + (s.restaurado) + "ª vez: esa configuración es frágil, arregla la raíz" : null });
  }
);

server.tool(
  "list_snapshots",
  "Lista snapshots disponibles con antigüedad y frecuencia de restauración.",
  {
  // sin parámetros
  },
  async (args: any) => {
    const st = store.load();
const snaps = st.snapshots || [];
if (!snaps.length) return ok({ snapshots: 0, mensaje: "sin snapshots: captura ANTES de cambiar cosas" });
return ok({ snapshots: snaps.map(s => ({ etiqueta: s.etiqueta, razon: s.razon.slice(0, 60), capturado: s.ts, antiguedad_dias: Number(((Date.now() - new Date(s.ts).getTime()) / 86400000).toFixed(1)), veces_restaurado: s.restaurado, claves: Object.keys(s.config || {}).length })).reverse(), rollbacks_totales: (st.rollbacks || []).length });
  }
);

server.tool(
  "diff_against_snapshot",
  "Compara tu configuración actual contra un snapshot: qué se ha tocado desde entonces.",
  {
  etiqueta: z.string().describe("Snapshot de referencia"),
  config_actual: z.any().describe("Configuración actual"),
  },
  async (args: any) => {
    const { etiqueta, config_actual } = args as any;
    const st = store.load();
const s = (st.snapshots || []).find(x => x.etiqueta === etiqueta);
if (!s) return fail("snapshot no encontrado: " + etiqueta);
const antes = s.config || {}, ahora = config_actual || {};
const cambiadas = Object.keys(ahora).filter(k => k in antes && JSON.stringify(antes[k]) !== JSON.stringify(ahora[k]));
const nuevas = Object.keys(ahora).filter(k => !(k in antes));
const eliminadas = Object.keys(antes).filter(k => !(k in ahora));
return ok({ referencia: etiqueta, capturado: s.ts, cambian_valor: cambiadas.map(k => ({ clave: k, antes: JSON.stringify(antes[k]).slice(0, 60), ahora: JSON.stringify(ahora[k]).slice(0, 60) })), nuevas, eliminadas, estabilidad: cambiadas.length + nuevas.length + eliminadas.length === 0 ? "idéntica al snapshot" : cambiadas.length + nuevas.length + eliminadas.length < 4 ? "drift leve" : "drift fuerte: considera capturar NUEVO snapshot para fijar el estado real" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor rollback-manager está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "rollback-manager", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[rollback-manager] fatal:", e);
  process.exit(1);
});

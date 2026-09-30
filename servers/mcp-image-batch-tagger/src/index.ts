#!/usr/bin/env node
/**
 * MCP Server: Image Batch Tagger
 * Metadatos obligatorios para lotes de imágenes: procedencia, contenido, frescura y decisión de uso
 *
 * Dolor que resuelve: El agente recibe 20 imágenes sueltas sin origen ni fecha: las mete todas al contexto, mezcla capturas de hace un año con las de hoy y no puede justificar de dónde salió la que citó después.
 * Categoría: Multimodal & Voz | Generado por mcp-suite | id: image-batch-tagger
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

// ——— persistencia local: ~/.mcp-suite/image-batch-tagger/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "image-batch-tagger");
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

const server = new McpServer({ name: "image-batch-tagger", version: "1.0.0" });

server.tool(
  "register_batch",
  "Registra un lote de imágenes con metadatos mínimos por imagen.",
  {
  lote: z.string().describe("Nombre del lote"),
  origen: z.string().describe("Procedencia (URL, app, usuario, carpeta)"),
  imagenes: z.array(z.any()).describe("Imágenes {id, contenido?: descripción corta, tomada_ts?: fecha}"),
  },
  async (args: any) => {
    const { lote, origen, imagenes } = args as any;
    const st = store.load();
st.lotes = st.lotes || {};
if (st.lotes[lote]) return fail("lote ya registrado: " + lote);
const limpias = (imagenes || []).filter(i => i && i.id).map(i => ({ id: String(i.id), contenido: String(i.contenido || "sin describir"), tomada_ts: i.tomada_ts ? String(i.tomada_ts) : null, registrada: new Date().toISOString(), usada_en_contexto: false }));
if (!limpias.length) return fail("sin imágenes con id");
st.lotes[lote] = { lote, origen, imagenes: limpias, registrado: new Date().toISOString() };
store.save(st);
return ok({ lote, imagenes: limpias.length, origen, sin_descripcion: limpias.filter(i => i.contenido === "sin describir").length + " sin describir de contenido: descríbelas antes de usarlas" });
  }
);

server.tool(
  "tag_images",
  "Etiqueta imágenes del lote (contenido, sensibilidad, idoneidad de uso).",
  {
  lote: z.string().describe("Lote"),
  tags: z.array(z.any()).describe("Etiquetas a aplicar {id, contenido?, sensibilidad?: publica|interna|confidencial, apta_para?: contexto}"),
  },
  async (args: any) => {
    const { lote, tags } = args as any;
    const st = store.load();
const l = (st.lotes || {})[lote];
if (!l) return fail("lote no encontrado: " + lote);
let aplicadas = 0, noEncontradas = [];
(tags || []).forEach(t => {
  const img = l.imagenes.find(i => i.id === String(t.id));
  if (!img) { noEncontradas.push(String(t.id)); return; }
  if (t.contenido) img.contenido = String(t.contenido).slice(0, 120);
  if (t.sensibilidad) img.sensibilidad = t.sensibilidad;
  if (t.apta_para) img.apta_para = String(t.apta_para);
  aplicadas++;
});
store.save(st);
return ok({ lote, etiquetas_aplicadas: aplicadas, ids_no_encontrados: noEncontradas, por_sensibilidad: { publica: l.imagenes.filter(i => i.sensibilidad === "publica").length, interna: l.imagenes.filter(i => i.sensibilidad === "interna").length, confidencial: l.imagenes.filter(i => i.sensibilidad === "confidencial").length, sin_clasificar: l.imagenes.filter(i => !i.sensibilidad).length }, aviso: l.imagenes.filter(i => !i.sensibilidad).length > l.imagenes.length / 2 ? "más de la mitad sin clasificar de sensibilidad: clasifica antes de adjuntar nada al contexto" : null });
  }
);

server.tool(
  "select_by_tag",
  "Selecciona imágenes del lote por etiquetas y frescura para adjuntar al contexto.",
  {
  lote: z.string().describe("Lote"),
  requerir_contenido: z.string().describe("Filtrar por texto en contenido").optional(),
  max_frescura_dias: z.number().describe("Antigüedad máxima aceptable (0 = sin límite)").default(0),
  excluir_sensibilidad: z.array(z.any()).describe("Sensibilidades a excluir").optional(),
  },
  async (args: any) => {
    const { lote, requerir_contenido, max_frescura_dias, excluir_sensibilidad } = args as any;
    const st = store.load();
const l = (st.lotes || {})[lote];
if (!l) return fail("lote no encontrado");
let candidatas = l.imagenes.slice();
if (requerir_contenido) candidatas = candidatas.filter(i => i.contenido.toLowerCase().includes(requerir_contenido.toLowerCase()));
if (excluir_sensibilidad && excluir_sensibilidad.length) candidatas = candidatas.filter(i => !excluir_sensibilidad.includes(i.sensibilidad || ""));
let rechazadas_por_frescura = [];
if (max_frescura_dias > 0) {
  candidatas = candidatas.filter(i => {
    if (!i.tomada_ts) return true;
    const dias = (Date.now() - new Date(i.tomada_ts).getTime()) / 86400000;
    if (dias > max_frescura_dias) { rechazadas_por_frescura.push({ id: i.id, dias: Number(dias.toFixed(0)) }); return false; }
    return true;
  });
}
return ok({ lote, seleccionadas: candidatas.map(i => ({ id: i.id, contenido: i.contenido, sensibilidad: i.sensibilidad || "sin clasificar", tomada: i.tomada_ts || "desconocida" })), rechazadas_por_frescura, advertencia: candidatas.some(i => !i.sensibilidad) ? "hay seleccionadas SIN sensibilidad clasificada: clasifícalas o exclúyelas" : null, origen_para_cita: l.origen });
  }
);

server.tool(
  "batch_report",
  "Informe del lote: cobertura de metadatos, frescura y qué se ha usado ya en contexto.",
  {
  lote: z.string().describe("Lote"),
  },
  async (args: any) => {
    const { lote } = args as any;
    const st = store.load();
const l = (st.lotes || {})[lote];
if (!l) return fail("lote no encontrado");
const imgs = l.imagenes;
const conFecha = imgs.filter(i => i.tomada_ts);
const edades = conFecha.map(i => (Date.now() - new Date(i.tomada_ts).getTime()) / 86400000);
return ok({ lote, origen: l.origen, imagenes: imgs.length, cobertura_metadatos: { con_contenido: imgs.filter(i => i.contenido !== "sin describir").length + "/" + imgs.length, con_sensibilidad: imgs.filter(i => i.sensibilidad).length + "/" + imgs.length, con_fecha: conFecha.length + "/" + imgs.length }, frescura: conFecha.length ? { media_dias: Number((edades.reduce((a, b) => a + b, 0) / edades.length).toFixed(1)), maxima_dias: Number(Math.max(...edades).toFixed(1)) } : "sin fechas: no puedes confiar en la frescura", usadas_en_contexto: imgs.filter(i => i.usada_en_contexto).length, nunca_usadas: imgs.filter(i => !i.usada_en_contexto).map(i => i.id), recomendacion: imgs.filter(i => !i.sensibilidad).length > 0 ? "completa la clasificación de sensibilidad antes del próximo uso" : "lote en orden" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor image-batch-tagger está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "image-batch-tagger", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[image-batch-tagger] fatal:", e);
  process.exit(1);
});

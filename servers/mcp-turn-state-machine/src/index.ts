#!/usr/bin/env node
/**
 * MCP Server: Turn State Machine
 * Gobierno de turnos para agentes de voz: quién habla, cuándo callar, cómo procesar la interrupción sin perder el hilo
 *
 * Dolor que resuelve: El agente de voz sigue hablando cuando el usuario ya lo interrumpió, o responde al silencio con monólogos en cadena: el turn-taking es una máquina de estados y casi nadie la modela, se improvisa con ifs.
 * Categoría: Multimodal & Voz | Generado por mcp-suite | id: turn-state-machine
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

// ——— persistencia local: ~/.mcp-suite/turn-state-machine/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "turn-state-machine");
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

const server = new McpServer({ name: "turn-state-machine", version: "1.0.0" });

server.tool(
  "new_session",
  "Crea una sesión de diálogo de voz con política de turnos.",
  {
  sesion: z.string().describe("Id de sesión"),
  silencio_max_seg: z.number().describe("Segundos de silencio del usuario antes de ceder turno").default(6),
  tolera_interrupcion: z.boolean().describe("¿El usuario puede interrumpir al agente?").default(true),
  },
  async (args: any) => {
    const { sesion, silencio_max_seg, tolera_interrupcion } = args as any;
    const st = store.load();
st.dialogos = st.dialogos || {};
if (st.dialogos[sesion]) return fail("sesión ya existe: " + sesion);
st.dialogos[sesion] = { sesion, estado: "ESCUCHANDO", politica: { silencio_max_seg, tolera_interrupcion }, eventos: [], turnos_usuario: 0, turnos_agente: 0, interrupciones: 0, creado: new Date().toISOString() };
store.save(st);
return ok({ sesion, estado_inicial: "ESCUCHANDO", politica: { silencio_max_seg, tolera_interrupcion }, eventos_legales: ["usuario_habla", "silencio_detectado", "agente_listo_para_hablar", "agente_termino", "usuario_interrumpe", "fin_dialogo"] });
  }
);

server.tool(
  "handle_event",
  "Procesa un evento de turno y devuelve la transición con la acción correcta para el agente.",
  {
  sesion: z.string().describe("Sesión"),
  evento: z.enum(["usuario_habla","silencio_detectado","agente_listo_para_hablar","agente_termino","usuario_interrumpe","fin_dialogo"]).describe("Evento ocurrido"),
  detalle: z.string().describe("Detalle del evento (duración del silencio, texto escuchado...)").optional(),
  },
  async (args: any) => {
    const { sesion, evento, detalle } = args as any;
    const st = store.load();
const d = (st.dialogos || {})[sesion];
if (!d) return fail("sesión no encontrada: crea con new_session");
const transiciones = {
  ESCUCHANDO: { usuario_habla: { a: "PENSANDO", accion: "deja de escuchar: procesa el input del usuario completo antes de responder", turno: "usuario" }, silencio_detectado: { a: "ESCUCHANDO", accion: "sigue esperando: el silencio corto es pensamiento, no rendición" }, agente_listo_para_hablar: { a: "HABLANDO", accion: "habla: ten listo el texto TTS con anclas de pausa" } },
  PENSANDO: { agente_listo_para_hablar: { a: "HABLANDO", accion: "responde: marca el inicio con una señal audible breve si la latencia superó 2s" }, usuario_interrumpe: { a: "ESCUCHANDO", accion: "re-escucha: el usuario añadió información mientras pensabas, re-procesa TODO el input junto" } },
  HABLANDO: { usuario_interrumpe: { a: "ESCUCHANDO", accion: "CALLA INMEDIATAMENTE y guarda el punto exacto de corte: reanudar desde ahí solo si el usuario no aporta nada nuevo", critico: true }, agente_termino: { a: "ESPERANDO_CONFIRMACION", accion: "cierra el turno con pregunta corta o confirmación explícita y cede la palabra" } },
  ESPERANDO_CONFIRMACION: { usuario_habla: { a: "PENSANDO", accion: "procesa la confirmación o la nueva petición" }, silencio_detectado: { a: "ESCUCHANDO", accion: "tras el silencio máximo, resume y ofrece ayuda una sola vez: NO repitas lo mismo en bucle" } }
};
const desde = d.estado;
const t = (transiciones[desde] || {})[evento];
if (!t) {
  const legal = Object.keys(transiciones[desde] || {});
  return fail("evento '" + evento + "' ILEGAL en estado " + desde + ". Eventos legales: " + (legal.join(", ") || "ninguno (estado terminal)") + ". Forzarlo rompería el turn-taking");
}
if (evento === "usuario_interrumpe" && !d.politica.tolera_interrupcion) return fail("interrupción NO tolerada por política: el agente debe terminar su frase (y revisa la política, negar barge-in suele frustrar)");
d.estado = t.a;
if (evento === "usuario_habla") d.turnos_usuario++;
if (evento === "agente_termino") d.turnos_agente++;
if (evento === "usuario_interrumpe") { d.interrupciones++; d.ultimo_corte = { detalle: detalle || "", ts: new Date().toISOString() }; }
d.eventos.push({ desde, evento, a: t.a, detalle: detalle || "", ts: new Date().toISOString() });
store.save(st);
return ok({ sesion, transicion: desde + " --" + evento + "--> " + t.a, estado_actual: d.estado, accion_para_el_agente: t.accion, punto_de_corte: evento === "usuario_interrumpe" ? d.ultimo_corte : null, metricas: { turnos_usuario: d.turnos_usuario, turnos_agente: d.turnos_agente, interrupciones: d.interrupciones } });
  }
);

server.tool(
  "current_state",
  "Estado actual de la sesión y eventos legales desde ahí.",
  {
  sesion: z.string().describe("Sesión"),
  },
  async (args: any) => {
    const { sesion } = args as any;
    const st = store.load();
const d = (st.dialogos || {})[sesion];
if (!d) return fail("sesión no encontrada");
const legales = { ESCUCHANDO: ["usuario_habla", "silencio_detectado", "agente_listo_para_hablar"], PENSANDO: ["agente_listo_para_hablar", "usuario_interrumpe"], HABLANDO: ["usuario_interrumpe", "agente_termino"], ESPERANDO_CONFIRMACION: ["usuario_habla", "silencio_detectado"] };
return ok({ sesion, estado: d.estado, eventos_legales: legales[d.estado] || [], politica: d.politica, metricas: { turnos_usuario: d.turnos_usuario, turnos_agente: d.turnos_agente, interrupciones: d.interrupciones, balance: d.turnos_agente > d.turnos_usuario * 2 ? "DESEQUILIBRADO: el agente monopoliza, reduce respuestas" : "razonable" }, ultimo_evento: d.eventos[d.eventos.length - 1] || null });
  }
);

server.tool(
  "session_log",
  "Traza completa de transiciones para depurar el comportamiento del diálogo.",
  {
  sesion: z.string().describe("Sesión"),
  ultimos: z.number().describe("Últimos N eventos").default(30),
  },
  async (args: any) => {
    const { sesion, ultimos } = args as any;
    const st = store.load();
const d = (st.dialogos || {})[sesion];
if (!d) return fail("sesión no encontrada");
const eventos = d.eventos.slice(-ultimos);
const ratios = { interrupciones_por_turno_agente: d.turnos_agente ? Number((d.interrupciones / d.turnos_agente).toFixed(2)) : 0 };
return ok({ sesion, eventos_totales: d.eventos.length, eventos, diagnostico: ratios.interrupciones_por_turno_agente > 0.5 ? "el usuario interrumpe la MITAD de los turnos del agente: respuestas demasiado largas o fuera de punto, acórtalas" : d.eventos.filter(e => e.evento === "silencio_detectado").length > d.turnos_usuario ? "muchos silencios: el agente no deja espacio natural para hablar" : "dinámica de turnos sana" });
  }
);

server.tool(
  "health_check",
  "Verifica que el servidor turn-state-machine está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.",
  {},
  async () => ok({ ok: true, server: "turn-state-machine", tools: 5, ts: new Date().toISOString() })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error("[turn-state-machine] fatal:", e);
  process.exit(1);
});

// ═══ CATEGORÍA: Dolores de agentes · Herramientas y Resiliencia (A) ═══
// Dolor de fondo: tools fallan, se agotan, se cuelgan o simplemente no se
// sabe cuál usar. MCP promete 100s de tools → el modelo elige mal (merge.dev).
export default [
  {
    id: "tool-registry",
    title: "Tool Registry",
    tagline: "Registro local de herramientas: catálogo, tags y búsqueda semántica ligera",
    category: "Resiliencia de Tools",
    pain: "Con decenas de MCP instalados el agente no sabe qué tools existen ni qué hacen: falta un registro consultable.",
    persistent: true,
    tools: [
      {
        name: "register",
        desc: "Registra una herramienta: nombre, servidor MCP, descripción, tags y coste estimado por llamada.",
        params: { nombre: { t: "string", d: "Nombre de la tool" }, servidor: { t: "string", d: "Servidor MCP dueño" }, descripcion: { t: "string", d: "Qué hace" }, tags: { t: "array", d: "Tags para búsqueda", opt: true }, costo_llamada: { t: "string", d: "Coste/latencia estimada (ej: $0.001, 800ms)", opt: true } },
        code: `const st = store.load();
st.tools = st.tools || {};
st.tools[nombre] = { servidor, descripcion, tags: Array.isArray(tags) ? tags : [], costo: costo_llamada || "desconocido", registrado: new Date().toISOString() };
store.save(st);
return ok({ tool: nombre, total_tools: Object.keys(st.tools).length });`,
      },
      {
        name: "search",
        desc: "Busca tools por texto (nombre/desc/tags) y devuelve las mejores coincidencias con su servidor.",
        params: { consulta: { t: "string", d: "Qué necesitas hacer" }, limite: { t: "number", d: "Máx resultados", opt: true, def: 8 } },
        code: `const st = store.load();
const tools = Object.entries(st.tools || {});
if (!tools.length) return fail("registro vacío: registra tools primero");
const q = consulta.toLowerCase().split(/\\s+/).filter((w) => w.length > 2);
const scored = tools.map(([nombre, t]: [string, any]) => {
  const texto = (nombre + " " + t.descripcion + " " + (t.tags || []).join(" ")).toLowerCase();
  const hits = q.filter((w) => texto.includes(w)).length;
  return { nombre, servidor: t.servidor, descripcion: t.descripcion, score: hits };
}).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limite ?? 8);
return ok({ consulta, resultados: scored, sin_match: scored.length === 0 });`,
      },
      {
        name: "list_all",
        desc: "Lista todas las tools registradas agrupadas por servidor.",
        params: {},
        code: `const st = store.load();
const por_servidor: any = {};
for (const [nombre, t] of Object.entries((st.tools || {}) as Record<string, any>)) {
  por_servidor[t.servidor] = por_servidor[t.servidor] || [];
  por_servidor[t.servidor].push(nombre);
}
return ok({ total_tools: Object.keys(st.tools || {}).length, servidores: por_servidor });`,
      },
      {
        name: "unregister",
        desc: "Elimina una tool del registro (cuando desinstalas su servidor).",
        params: { nombre: { t: "string", d: "Tool a eliminar" } },
        code: `const st = store.load();
if (!st.tools?.[nombre]) return fail("no registrada");
delete st.tools[nombre];
store.save(st);
return ok({ eliminada: nombre, restantes: Object.keys(st.tools).length });`,
      },
    ],
  },
  {
    id: "tool-router",
    title: "Tool Router",
    tagline: "Enruta cada intención a la mejor tool: menos decisiones erróneas del modelo",
    category: "Resiliencia de Tools",
    pain: "Con 100+ tools disponibles el LLM elige mal o llama la incorrecta (dolor #1 reportado por merge.dev sobre MCP).",
    persistent: true,
    tools: [
      {
        name: "add_route",
        desc: "Define una regla de ruteo: patrón de intención → tool concreta (con prioridad).",
        params: { intencion: { t: "string", d: "Patrón de intención (ej: leer página web)" }, tool: { t: "string", d: "Tool a enrutar" }, prioridad: { t: "number", d: "Prioridad (mayor = primero)", opt: true, def: 1 } },
        code: `const st = store.load();
st.rutas = st.rutas || [];
st.rutas.push({ intencion, tool, prioridad: prioridad ?? 1, usos: 0 });
st.rutas.sort((a: any, b: any) => b.prioridad - a.prioridad);
store.save(st);
return ok({ rutas: st.rutas.length });`,
      },
      {
        name: "route",
        desc: "Dada una intención en texto, devuelve la tool recomendada (match por similitud de intención) y registra el uso.",
        params: { intencion: { t: "string", d: "Qué se quiere hacer" } },
        code: `const st = store.load();
const rutas: any[] = st.rutas || [];
if (!rutas.length) return fail("sin rutas definidas: add_route primero");
const q = intencion.toLowerCase();
const words = q.split(/\\s+/).filter((w) => w.length > 3);
const scored = rutas.map((r) => {
  const rtext = r.intencion.toLowerCase();
  const hits = words.filter((w) => rtext.includes(w)).length;
  return { r, score: hits + r.prioridad * 0.1 };
}).sort((a, b) => b.score - a.score);
const mejor = scored[0];
if (mejor.score <= 0) return ok({ tool: null, razon: "ninguna ruta matchea; define con add_route" });
mejor.r.usos = (mejor.r.usos || 0) + 1;
store.save(st);
return ok({ tool: mejor.r.tool, intencion_detectada: mejor.r.intencion, score: Math.round(mejor.score * 10) / 10, alternativas: scored.slice(1, 3).map((s) => s.r.tool) });`,
      },
      {
        name: "stats",
        desc: "Estadísticas de ruteo: qué rutas se usan más (para ajustar prioridades).",
        params: {},
        code: `const st = store.load();
const rutas = (st.rutas || []).map((r: any) => ({ intencion: r.intencion, tool: r.tool, usos: r.usos || 0, prioridad: r.prioridad }));
return ok({ rutas, total_usos: rutas.reduce((a: number, r: any) => a + r.usos, 0) });`,
      },
    ],
  },
  {
    id: "retry-orchestrator",
    title: "Retry Orchestrator",
    tagline: "Política de reintentos con backoff exponencial y jitter: calcula cuándo y si reintentar",
    category: "Resiliencia de Tools",
    pain: "Las tools fallan transitoriamente y el agente o abandona o spamea: falta una política de reintentos inteligente.",
    persistent: true,
    tools: [
      {
        name: "plan_retries",
        desc: "Calcula el plan de reintentos para una operación fallida: intentos, delays con backoff exponencial + jitter y timeout total.",
        params: { intento_actual: { t: "number", d: "En qué intento vas (empezando en 1)" }, max_intentos: { t: "number", d: "Máximo de intentos", opt: true, def: 5 }, base_ms: { t: "number", d: "Delay base", opt: true, def: 500 } },
        code: `const n = intento_actual;
const max = max_intentos ?? 5;
if (n >= max) return ok({ reintentar: false, razon: "máximo alcanzado (" + max + ")", siguiente_accion: "fallback o escalar" });
const delay = Math.min((base_ms ?? 500) * Math.pow(2, n - 1), 30000);
const jitter = Math.round(delay * 0.2 * Math.random());
const plan: any[] = [];
for (let i = n; i < max; i++) { const d = Math.min((base_ms ?? 500) * Math.pow(2, i - 1), 30000); plan.push({ intento: i + 1, delay_ms: d + Math.round(d * 0.2 * Math.random()) }); }
return ok({ reintentar: true, proximo_delay_ms: delay + jitter, plan_restante: plan, timeout_total_estimado_ms: plan.reduce((a, p) => a + p.delay_ms, 0) });`,
      },
      {
        name: "should_retry",
        desc: "Decide si un error es reintentable: clasifica por tipo (red= sí, 4xx= no, 429= sí con espera, 5xx= sí).",
        params: { error: { t: "string", d: "Mensaje o código de error" } },
        code: `const e = String(error).toLowerCase();
let tipo = "desconocido"; let reintentar = false; let espera = 0;
if (/econnrefused|enotfound|etimedout|timeout|network|fetch failed|econnreset/.test(e)) { tipo = "red"; reintentar = true; espera = 1000; }
else if (/429|rate.?limit|too many|quota/.test(e)) { tipo = "rate-limit"; reintentar = true; espera = 5000; }
else if (/5\\d\\d|internal|bad gateway|service unavailable/.test(e)) { tipo = "servidor"; reintentar = true; espera = 2000; }
else if (/40[0134]|unauthorized|forbidden|not found|invalid|bad request|schema/.test(e)) { tipo = "cliente"; reintentar = false; }
else if (/abort|cancel/.test(e)) { tipo = "cancelado"; reintentar = false; }
return ok({ tipo, reintentar, espera_sugerida_ms: espera, razon: reintentar ? "error transitorio" : "error determinista: corregir input o credenciales" });`,
      },
      {
        name: "record_attempt",
        desc: "Registra el resultado de un intento (éxito/fallo) para aprender qué operaciones suelen necesitar reintentos.",
        params: { operacion: { t: "string", d: "Nombre de la operación" }, exito: { t: "boolean", d: "Resultado" }, intento: { t: "number", d: "Número de intento", opt: true, def: 1 } },
        code: `const st = store.load();
st.operaciones = st.operaciones || {};
const op = st.operaciones[operacion] = st.operaciones[operacion] || { exitos: 0, fallos: 0, max_intentos: 0 };
if (exito) op.exitos++; else op.fallos++;
op.max_intentos = Math.max(op.max_intentos, intento ?? 1);
store.save(st);
return ok({ operacion, exitos: op.exitos, fallos: op.fallos, tasa_exito: Math.round((op.exitos / (op.exitos + op.fallos)) * 100) + "%" });`,
      },
    ],
  },
  {
    id: "circuit-breaker",
    title: "Circuit Breaker",
    tagline: "Disyuntor por servicio: deja de martillar lo que está caído",
    category: "Resiliencia de Tools",
    pain: "Cuando un servicio MCP cae, cada llamada espera su timeout completo: cascada de latencia. Falta circuit breaker.",
    persistent: true,
    notes: "Estados: CLOSED (normal) → OPEN tras N fallos (bloquea) → HALF-OPEN tras cooldown (prueba 1 llamada).",
    tools: [
      {
        name: "record_success",
        desc: "Registra un éxito del servicio (resetea contador de fallos; cierra el circuito si estaba half-open).",
        params: { servicio: { t: "string", d: "Nombre del servicio" } },
        code: `const st = store.load();
st.breakers = st.breakers || {};
const b = st.breakers[servicio] = st.breakers[servicio] || { estado: "closed", fallos: 0, exitos: 0 };
b.exitos = (b.exitos || 0) + 1;
b.fallos = 0;
if (b.estado === "half-open") b.estado = "closed";
b.ultimo_evento = new Date().toISOString();
store.save(st);
return ok({ servicio, estado: b.estado });`,
      },
      {
        name: "record_failure",
        desc: "Registra un fallo del servicio: al llegar al umbral, el circuito se ABRE (bloquea llamadas).",
        params: { servicio: { t: "string", d: "Servicio" }, umbral: { t: "number", d: "Fallos para abrir", opt: true, def: 5 } },
        code: `const st = store.load();
st.breakers = st.breakers || {};
const b = st.breakers[servicio] = st.breakers[servicio] || { estado: "closed", fallos: 0, exitos: 0 };
b.fallos = (b.fallos || 0) + 1;
if (b.estado === "half-open" || b.fallos >= (umbral ?? 5)) { b.estado = "open"; b.abierto = new Date().toISOString(); }
b.ultimo_evento = new Date().toISOString();
store.save(st);
return ok({ servicio, estado: b.estado, fallos_consecutivos: b.fallos });`,
      },
      {
        name: "check",
        desc: "Consulta el estado del circuito para un servicio: permite llamar (closed/half-open tras cooldown) o bloqueado (open).",
        params: { servicio: { t: "string", d: "Servicio" }, cooldown_ms: { t: "number", d: "Cooldown antes de half-open", opt: true, def: 30000 } },
        code: `const st = store.load();
const b = st.breakers?.[servicio];
if (!b) return ok({ servicio, estado: "closed", permitir: true, fallos: 0 });
let estado = b.estado; let permitir = estado !== "open";
if (estado === "open") {
  const desde = new Date(b.abierto || 0).getTime();
  if (Date.now() - desde >= (cooldown_ms ?? 30000)) { estado = "half-open"; permitir = true; }
}
return ok({ servicio, estado, permitir, fallos_consecutivos: b.fallos, exitos: b.exitos, ultima: b.ultimo_evento });`,
      },
      {
        name: "reset",
        desc: "Resetea manualmente el circuito de un servicio (tras confirmar que volvió).",
        params: { servicio: { t: "string", d: "Servicio" } },
        code: `const st = store.load();
if (st.breakers?.[servicio]) { st.breakers[servicio] = { estado: "closed", fallos: 0, exitos: 0 }; store.save(st); }
return ok({ servicio, reset: true });`,
      },
    ],
  },
  {
    id: "rate-limiter",
    title: "Rate Limiter",
    tagline: "Límite de llamadas por ventana deslizante: respeta cuotas de APIs",
    category: "Resiliencia de Tools",
    pain: "Las APIs te tiran 429 y bannean: el agente necesita respetar rate limits por servicio sin pensarlo.",
    persistent: true,
    tools: [
      {
        name: "configure",
        desc: "Configura el límite de un servicio: N llamadas por ventana (ms).",
        params: { servicio: { t: "string", d: "Servicio/API" }, max_llamadas: { t: "number", d: "Máx llamadas" }, ventana_ms: { t: "number", d: "Ventana en ms", opt: true, def: 60000 } },
        code: `const st = store.load();
st.limits = st.limits || {};
st.limits[servicio] = { max: max_llamadas, ventana: ventana_ms ?? 60000, llamadas: [] };
store.save(st);
return ok({ servicio, limite: max_llamadas + "/" + (ventana_ms ?? 60000) + "ms" });`,
      },
      {
        name: "acquire",
        desc: "Pide un slot: devuelve permitido=true y cuánto esperar si no (ventana deslizante real).",
        params: { servicio: { t: "string", d: "Servicio" } },
        code: `const st = store.load();
const cfg = st.limits?.[servicio];
if (!cfg) return ok({ servicio, permitido: true, razon: "sin límite configurado" });
const ahora = Date.now();
cfg.llamadas = (cfg.llamadas || []).filter((t: number) => ahora - t < cfg.ventana);
if (cfg.llamadas.length >= cfg.max) {
  const esperar = cfg.ventana - (ahora - cfg.llamadas[0]);
  store.save(st);
  return ok({ servicio, permitido: false, esperar_ms: esperar, en_ventana: cfg.llamadas.length });
}
cfg.llamadas.push(ahora);
store.save(st);
return ok({ servicio, permitido: true, restantes: cfg.max - cfg.llamadas.length });`,
      },
      {
        name: "status",
        desc: "Estado actual de uso de todos los límites configurados.",
        params: {},
        code: `const st = store.load();
const ahora = Date.now();
const estado = Object.entries(st.limits || {}).map(([servicio, c]: [string, any]) => {
  const activas = (c.llamadas || []).filter((t: number) => ahora - t < c.ventana).length;
  return { servicio, uso: activas + "/" + c.max, ventana_ms: c.ventana };
});
return ok({ limites: estado });`,
      },
    ],
  },
  {
    id: "timeout-guard",
    title: "Timeout Guard",
    tagline: "Deadlines y escalada: ninguna llamada sin reloj",
    category: "Resiliencia de Tools",
    pain: "Las tools lentas congelan al agente: falta gestión de deadlines, timeouts por clase de operación y escalada.",
    tools: [
      {
        name: "suggest_timeout",
        desc: "Sugiere timeout por clase de operación (lectura local, API rápida, scrapeo, LLM, batch) con justificación.",
        params: { clase: { t: "enum", values: ["local-io", "api-rapida", "api-lenta", "scraping", "llm", "batch"], d: "Clase de operación" } },
        code: `const tabla: any = {
  "local-io": { ms: 2000, razon: "disco local: si tarda más algo podrido" },
  "api-rapida": { ms: 8000, razon: "API JSON ligera: 8s cubre p99" },
  "api-lenta": { ms: 20000, razon: "procesamiento server-side" },
  "scraping": { ms: 30000, razon: "render + descarga de assets" },
  "llm": { ms: 120000, razon: "generación de tokens larga" },
  "batch": { ms: 300000, razon: "procesamiento masivo" },
};
const r = tabla[clase] || tabla["api-rapida"];
return ok({ clase, timeout_sugerido_ms: r.ms, razon: r.razon });`,
      },
      {
        name: "deadline_plan",
        desc: "Dado un presupuesto total de tiempo y una lista de pasos, reparte deadlines proporcionales y detecta pasos imposibles.",
        params: { presupuesto_ms: { t: "number", d: "Tiempo total disponible" }, pasos: { t: "array", d: "Lista de {nombre, peso (relativo)}" } },
        code: `const list = Array.isArray(pasos) ? pasos : [];
const total_peso = list.reduce((a: number, p: any) => a + (p.peso || 1), 0) || 1;
const plan = list.map((p: any) => {
  const ms = Math.round((presupuesto_ms * (p.peso || 1)) / total_peso);
  return { paso: p.nombre, deadline_ms: ms, ajustado: ms < 100 };
});
const imposibles = plan.filter((p) => p.ajustado);
return ok({ presupuesto_ms, plan, advertencia: imposibles.length ? "pasos con deadline < 100ms: redistribuye" : "ok" });`,
      },
    ],
  },
  {
    id: "fallback-chain",
    title: "Fallback Chain",
    tagline: "Cadenas de respaldo: si A falla prueba B, luego C — con registro",
    category: "Resiliencia de Tools",
    pain: "Cuando la tool primaria falla no hay plan B estructurado: el agente improvisa en vez de seguir una cadena de fallbacks.",
    persistent: true,
    tools: [
      {
        name: "build_chain",
        desc: "Define una cadena de fallback para una capacidad: lista ordenada de herramientas/métodos alternativos.",
        params: { capacidad: { t: "string", d: "Capacidad (ej: busqueda-web)" }, herramientas: { t: "array", d: "Tools alternativas en orden de preferencia" } },
        code: `const st = store.load();
st.cadenas = st.cadenas || {};
st.cadenas[capacidad] = { pasos: Array.isArray(herramientas) ? herramientas : [], creado: new Date().toISOString() };
store.save(st);
return ok({ capacidad, cadena: st.cadenas[capacidad].pasos });`,
      },
      {
        name: "next_fallback",
        desc: "Devuelve el siguiente paso a probar en la cadena dado el que falló (y registra el fallo para estadística).",
        params: { capacidad: { t: "string", d: "Capacidad" }, fallo_en: { t: "string", d: "Herramienta que falló" } },
        code: `const st = store.load();
const cadena = st.cadenas?.[capacidad];
if (!cadena) return fail("cadena no definida: build_chain primero");
const idx = cadena.pasos.indexOf(fallo_en);
const siguiente = idx >= 0 && idx < cadena.pasos.length - 1 ? cadena.pasos[idx + 1] : null;
st.fallos = st.fallos || [];
st.fallos.push({ capacidad, herramienta: fallo_en, ts: new Date().toISOString() });
store.save(st);
return ok({ siguiente, agotada: siguiente === null, cadena_completa: cadena.pasos });`,
      },
      {
        name: "report",
        desc: "Reporte de fallos por capacidad: qué eslabones fallan más (para reordenar cadenas).",
        params: {},
        code: `const st = store.load();
const conteo: any = {};
for (const f of st.fallos || []) { const k = f.capacidad + "::" + f.herramienta; conteo[k] = (conteo[k] || 0) + 1; }
return ok({ fallos_por_eslabon: Object.entries(conteo).sort((a: any, b: any) => b[1] - a[1]).map(([k, n]) => ({ eslabon: k, fallos: n })) });`,
      },
    ],
  },
];

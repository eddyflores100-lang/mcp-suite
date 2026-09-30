// ═══ CATEGORÍA: Dolores de agentes · Herramientas y Resiliencia (B) ═══
export default [
  {
    id: "queue-mcp",
    title: "Job Queue",
    tagline: "Cola de trabajos durable: encola, procesa y nunca pierde una tarea",
    category: "Resiliencia de Tools",
    pain: "Sin cola, un crash pierde las tareas en vuelo: el agente necesita encolar trabajos con reintentos y prioridad.",
    persistent: true,
    tools: [
      {
        name: "enqueue",
        desc: "Encola un trabajo {tipo, payload, prioridad}: devuelve posición e ID para seguimiento.",
        params: { tipo: { t: "string", d: "Tipo de trabajo" }, payload: { t: "any", d: "Datos del trabajo" }, prioridad: { t: "number", d: "Prioridad (mayor = antes)", opt: true, def: 0 } },
        code: `const st = store.load();
st.cola = st.cola || [];
st.seq = (st.seq || 0) + 1;
const job = { id: "job-" + st.seq, tipo, payload, prioridad: prioridad ?? 0, estado: "pendiente", encolado: new Date().toISOString(), intentos: 0 };
st.cola.push(job);
st.cola.sort((a: any, b: any) => b.prioridad - a.prioridad);
store.save(st);
return ok({ job_id: job.id, posicion: st.cola.findIndex((j: any) => j.id === job.id) + 1, pendientes: st.cola.filter((j: any) => j.estado === "pendiente").length });`,
      },
      {
        name: "dequeue",
        desc: "Saca el siguiente trabajo pendiente (mayor prioridad, FIFO entre iguales) y lo marca en_progreso.",
        params: {},
        code: `const st = store.load();
const job = (st.cola || []).find((j: any) => j.estado === "pendiente");
if (!job) return ok({ job: null, pendientes: 0 });
job.estado = "in_progress";
job.tomado = new Date().toISOString();
store.save(st);
return ok({ job, pendientes: st.cola.filter((j: any) => j.estado === "pendiente").length });`,
      },
      {
        name: "complete",
        desc: "Marca un trabajo como completado (o fallido: vuelve a pendiente si le quedan reintentos).",
        params: { job_id: { t: "string", d: "ID del trabajo" }, exito: { t: "boolean", d: "Resultado" }, resultado: { t: "string", d: "Detalle del resultado", opt: true }, max_reintentos: { t: "number", d: "Reintentos permitidos", opt: true, def: 3 } },
        code: `const st = store.load();
const job = (st.cola || []).find((j: any) => j.id === job_id);
if (!job) return fail("job no encontrado");
if (exito) { job.estado = "done"; job.resultado = resultado || ""; }
else { job.intentos = (job.intentos || 0) + 1; job.estado = job.intentos > (max_reintentos ?? 3) ? "failed" : "pendiente"; job.error = resultado || ""; }
job.finalizado = new Date().toISOString();
store.save(st);
return ok({ job_id, estado: job.estado, intentos: job.intentos });`,
      },
      {
        name: "stats",
        desc: "Estadísticas de la cola: pendientes, en progreso, completados, fallidos y oldest pendiente.",
        params: {},
        code: `const st = store.load();
const cola: any[] = st.cola || [];
const conteo: any = {};
for (const j of cola) conteo[j.estado] = (conteo[j.estado] || 0) + 1;
const pendientes = cola.filter((j) => j.estado === "pendiente");
return ok({ total: cola.length, ...conteo, pendiente_mas_viejo: pendientes[0]?.encolado || null });`,
      },
    ],
  },
  {
    id: "batch-runner",
    title: "Batch Runner",
    tagline: "Divide y vencerás: lotes y chunks con control de concurrencia",
    category: "Resiliencia de Tools",
    pain: "Procesar 1000 items de golpe revienta rate limits y memoria: falta división en lotes con concurrencia limitada.",
    tools: [
      {
        name: "make_batches",
        desc: "Divide una lista de items en lotes de tamaño N con opciones de stride/interleaved.",
        params: { items: { t: "array", d: "Items a dividir" }, tamano: { t: "number", d: "Items por lote", opt: true, def: 10 }, intercalado: { t: "boolean", d: "Reparto round-robin entre lotes", opt: true, def: false } },
        code: `const list = Array.isArray(items) ? items : [];
const n = Math.max(1, tamano ?? 10);
let lotes: any[] = [];
if (intercalado) {
  const num_lotes = Math.ceil(list.length / n);
  lotes = Array.from({ length: num_lotes }, () => []);
  list.forEach((item, i) => lotes[i % num_lotes].push(item));
} else {
  for (let i = 0; i < list.length; i += n) lotes.push(list.slice(i, i + n));
}
return ok({ total_items: list.length, total_lotes: lotes.length, tamano_lote: n, lotes });`,
      },
      {
        name: "concurrency_plan",
        desc: "Calcula plan de concurrencia: dado N items, costo por item y rate limit, cuántos en paralelo y cuánto tarda.",
        params: { total_items: { t: "number", d: "Total de items" }, ms_por_item: { t: "number", d: "Duración de un item (ms)" }, max_concurrencia: { t: "number", d: "Límite de paralelismo", opt: true, def: 5 }, rate_por_minuto: { t: "number", d: "Límite de llamadas/min", opt: true } },
        code: `const conc = Math.max(1, max_concurrencia ?? 5);
let efectiva = conc;
if (rate_por_minuto) efectiva = Math.min(conc, Math.max(1, Math.floor(rate_por_minuto / 60)));
const tandas = Math.ceil(total_items / efectiva);
const tiempo_total = tandas * (ms_por_item ?? 1000);
return ok({ concurrencia_efectiva: efectiva, tandas, tiempo_estimado_ms: tiempo_total, tiempo_estimado_legible: Math.round(tiempo_total / 1000) + "s", limitante: rate_por_minuto && efectiva < conc ? "rate-limit" : "paralelismo" });`,
      },
    ],
  },
  {
    id: "health-check-hub",
    title: "Health Check Hub",
    tagline: "Monitorea la salud de tus servicios MCP/HTTP con pings periódicos",
    category: "Resiliencia de Tools",
    pain: "Las dependencias caen silenciosamente: el agente se entera cuando ya falló la cadena completa.",
    persistent: true,
    needsFetch: true,
    tools: [
      {
        name: "register_target",
        desc: "Registra un endpoint a vigilar: nombre, URL y método esperado.",
        params: { nombre: { t: "string", d: "Nombre del target" }, url: { t: "string", d: "URL a vigilar" } },
        code: `const st = store.load();
st.targets = st.targets || {};
st.targets[nombre] = { url, registrado: new Date().toISOString(), ultimo_estado: null, historial: [] };
store.save(st);
return ok({ nombre, url, total_targets: Object.keys(st.targets).length });`,
      },
      {
        name: "check",
        desc: "Ejecuta un health check en vivo de un target (HTTP GET) y guarda el resultado en historial.",
        params: { nombre: { t: "string", d: "Target a chequear" }, timeout_ms: { t: "number", d: "Timeout", opt: true, def: 8000 } },
        code: `const st = store.load();
const t = st.targets?.[nombre];
if (!t) return fail("target no registrado");
const inicio = Date.now();
let estado: any = { ok: false };
try {
  const r = await fetchSmart(t.url, { timeoutMs: timeout_ms ?? 8000, retries: 0 });
  estado = { ok: r.status >= 200 && r.status < 400, http: r.status, ms: Date.now() - inicio };
} catch (e: any) { estado = { ok: false, error: e.message, ms: Date.now() - inicio }; }
estado.ts = new Date().toISOString();
t.ultimo_estado = estado;
t.historial = (t.historial || []).concat(estado).slice(-50);
store.save(st);
return ok({ nombre, ...estado });`,
      },
      {
        name: "report",
        desc: "Reporte de todos los targets: último estado, uptime estimado (últimos 50 checks) y latencia media.",
        params: {},
        code: `const st = store.load();
const reporte = Object.entries(st.targets || {}).map(([nombre, t]: [string, any]) => {
  const h = t.historial || [];
  const oks = h.filter((x: any) => x.ok).length;
  return { nombre, url: t.url, ultimo: t.ultimo_estado, checks: h.length, disponibilidad: h.length ? Math.round((oks / h.length) * 100) + "%" : "sin datos", latencia_media_ms: h.length ? Math.round(h.reduce((a: number, x: any) => a + (x.ms || 0), 0) / h.length) : null };
});
return ok({ targets: reporte });`,
      },
    ],
  },
  {
    id: "idempotency-guard",
    title: "Idempotency Guard",
    tagline: "Claves de idempotencia: la misma operación nunca se ejecuta dos veces",
    category: "Resiliencia de Tools",
    pain: "Los reintentos duplican efectos (cobros, emails, registros): falta control de idempotencia estilo header Idempotency-Key.",
    persistent: true,
    tools: [
      {
        name: "check_or_set",
        desc: "Antes de ejecutar: verifica si la clave ya se usó (devuelve el resultado previo) o la registra como usada.",
        params: { clave: { t: "string", d: "Clave de idempotencia única de la operación" }, resultado: { t: "string", d: "Resultado a memoizar (opcional, para devolver en duplicados)", opt: true } },
        code: `const st = store.load();
st.usadas = st.usadas || {};
if (st.usadas[clave]) return ok({ ya_ejecutada: true, resultado_previo: st.usadas[clave].resultado || null, ejecutada: st.usadas[clave].ts });
st.usadas[clave] = { ts: new Date().toISOString(), resultado: resultado || null };
store.save(st);
return ok({ ya_ejecutada: false, accion: "procede a ejecutar" });`,
      },
      {
        name: "stats",
        desc: "Cuántas claves registradas y cuántas colisiones (duplicados evitados) hasta ahora.",
        params: {},
        code: `const st = store.load();
return ok({ claves_registradas: Object.keys(st.usadas || {}).length });`,
      },
    ],
  },
  {
    id: "webhook-inspector",
    title: "Webhook Inspector",
    tagline: "Inspecciona webhooks entrantes: parse, verificación HMAC y log de eventos",
    category: "Resiliencia de Tools",
    pain: "Los webhooks llegan y nadie sabe si son legítimos ni qué trajeron: falta inspección y verificación de firma.",
    persistent: true,
    imports: ["crypto"],
    tools: [
      {
        name: "inspect",
        desc: "Inspecciona un webhook: headers normalizados, parsea el body (JSON) y detecta el proveedor por firma típica.",
        params: { headers: { t: "any", d: "Headers HTTP recibidos" }, body: { t: "string", d: "Body crudo" } },
        code: `let parsed: any = null;
try { parsed = JSON.parse(body); } catch { parsed = null; }
const h = headers || {};
const proveedores: Array<[string, string]> = [["stripe", "stripe-signature"], ["github", "x-hub-signature-256"], ["slack", "x-slack-signature"], ["shopify", "x-shopify-hmac-sha256"], ["generic", "x-signature"]];
const detectado = proveedores.find(([, header]) => Object.keys(h).some((k) => k.toLowerCase() === header))?.[0] || "desconocido";
const st = store.load();
st.eventos = st.eventos || [];
st.eventos.push({ ts: new Date().toISOString(), proveedor: detectado, tipo: parsed?.type || parsed?.event || null, keys: parsed ? Object.keys(parsed) : [] });
if (st.eventos.length > 300) st.eventos = st.eventos.slice(-300);
store.save(st);
return ok({ proveedor_detectado: detectado, body_parseado: parsed, headers_clave: Object.keys(h).filter((k) => k.toLowerCase().includes("sign") || k.toLowerCase().includes("hmac")) });`,
      },
      {
        name: "verify_hmac",
        desc: "Verifica la firma HMAC-SHA256 de un webhook dado el secreto compartido y la firma recibida.",
        params: { body: { t: "string", d: "Body crudo" }, secreto: { t: "string", d: "Secreto compartido" }, firma_recibida: { t: "string", d: "Firma (hex o base64)" } },
        code: `const esperada = createHmac("sha256", secreto).update(body).digest("hex");
const recibida = String(firma_recibida).replace(/^sha256=/, "").trim();
const b64 = createHmac("sha256", secreto).update(body).digest("base64");
const valida = esperada === recibida || b64 === recibida;
return ok({ valida, esperada_prefix: esperada.slice(0, 12) + "...", recibida_prefix: recibida.slice(0, 12) + "..." });`,
      },
      {
        name: "recent_events",
        desc: "Últimos webhooks inspeccionados (proveedor, tipo, timestamp).",
        params: { limite: { t: "number", d: "Máx eventos", opt: true, def: 20 } },
        code: `const st = store.load();
return ok({ eventos: (st.eventos || []).slice(-(limite ?? 20)).reverse() });`,
      },
    ],
  },
  {
    id: "poll-watcher",
    title: "Poll Watcher",
    tagline: "Vigila cambios de cualquier URL: detecta diffs entre visitas",
    category: "Resiliencia de Tools",
    pain: "El agente necesita saber cuándo cambia una página/API pero los webhooks no existen en la mayoría de sitios: falta polling con diff.",
    persistent: true,
    needsFetch: true,
    imports: ["crypto"],
    tools: [
      {
        name: "watch",
        desc: "Visita una URL y compara su hash con la última visita: detecta cambios (nuevo/actualizado/sin cambios) y guarda el snapshot.",
        params: { nombre: { t: "string", d: "Alias del watch" }, url: { t: "string", d: "URL a vigilar" }, timeout_ms: { t: "number", d: "Timeout", opt: true, def: 15000 } },
        code: `const st = store.load();
st.watches = st.watches || {};
const r = await fetchSmart(url, { timeoutMs: timeout_ms ?? 15000, retries: 1 });
if (r.status !== 200) return fail("HTTP " + r.status);
const hash = createHash("sha256").update(r.text).digest("hex");
const prev = st.watches[nombre];
const estado = !prev ? "nuevo" : prev.hash === hash ? "sin-cambios" : "cambiado";
st.watches[nombre] = { url, hash, tamano: r.text.length, ultima_visita: new Date().toISOString(), prev_hash: prev?.hash || null, cambios: ((prev?.cambios || 0)) + (estado === "cambiado" ? 1 : 0) };
store.save(st);
return ok({ nombre, estado, tamano: r.text.length, cambio_detectado: estado === "cambiado", total_cambios: st.watches[nombre].cambios });`,
      },
      {
        name: "list_watches",
        desc: "Lista todos los watches con su estado (hash, tamaño, última visita, cambios detectados).",
        params: {},
        code: `const st = store.load();
return ok({ watches: Object.entries(st.watches || {}).map(([nombre, w]: [string, any]) => ({ nombre, url: w.url, tamano: w.tamano, ultima_visita: w.ultima_visita, cambios: w.cambios })) });`,
      },
    ],
  },
];

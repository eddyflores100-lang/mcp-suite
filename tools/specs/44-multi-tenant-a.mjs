// ═══ CATEGORÍA: Dolores FUTUROS · Multi-Tenant (A) ═══
// Evidencia: un agente que sirve a varios inquilinos (clientes, usuarios,
// departamentos) sin aislamiento contextual, cuotas y detección de
// vecino-ruidoso es una fuga de datos con patas.
export default [
  {
    id: "tenant-isolator",
    title: "Tenant Isolator",
    tagline: "Aislamiento de contexto por inquilino: cada sesión ligada a su tenant y todo acceso cruzado denegado con evidencia",
    category: "Multi-Tenant",
    pain: "El agente atiende a ClienteA y ClienteB en la misma memoria: el contexto de una filtración de datos entre tenants es silenciosa y total. 'Confío en que el prompt lo evita' no es aislamiento, es fe.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/tenant-isolator/. Registro de tenants y vinculación sesión→tenant; check_access valida que la sesión que pide un recurso pertenece al tenant dueño; reporte de intentos cruzados.",
    tools: [
      {
        name: "register_tenant",
        desc: "Registra un inquilino (cliente, usuario, departamento) del agente.",
        params: { tenant: { t: "string", d: "Identificador único del tenant" }, nombre_visible: { t: "string", d: "Nombre para mostrar", opt: true }, clasificacion: { t: "enum", d: "Sensibilidad del tenant", values: ["estandar", "protegido", "regulado"], opt: true, def: "estandar" } },
        code: `const st = store.load();
st.tenants = st.tenants || {};
if (st.tenants[tenant]) return fail("tenant ya registrado: " + tenant);
st.tenants[tenant] = { tenant, nombre: nombre_visible || tenant, clasificacion, sesiones: [], creado: new Date().toISOString() };
store.save(st);
return ok({ tenant, clasificacion, nota: clasificacion === "regulado" ? "tenant REGULADO: todo acceso quedará auditado con mayor detalle" : "registrado" });`,
      },
      {
        name: "bind_session",
        desc: "Vincula una sesión/conversación a UN tenant (decisión inmutable por diseño).",
        params: { sesion: { t: "string", d: "Id de sesión/conversación" }, tenant: { t: "string", d: "Tenant al que pertenece" } },
        code: `const st = store.load();
st.tenants = st.tenants || {};
st.bindings = st.bindings || {};
if (!st.tenants[tenant]) return fail("tenant no registrado: " + tenant);
const previo = st.bindings[sesion];
if (previo && previo.tenant !== tenant) return fail("LA SESIÓN YA ESTÁ LIGADA A '" + previo.tenant + "': el binding es inmutable por aislamiento. Abre sesión nueva para '" + tenant + "'");
if (previo) return ok({ sesion, tenant, ya_ligada: true, desde: previo.desde });
st.bindings[sesion] = { sesion, tenant, desde: new Date().toISOString() };
st.tenants[tenant].sesiones.push(sesion);
store.save(st);
return ok({ sesion, tenant, ligada: true, regla: "todo recurso que toque esta sesión debe pertenecer a '" + tenant + "' (verifica con check_access)" });`,
      },
      {
        name: "check_access",
        desc: "Verifica que una sesión puede tocar un recurso: el dueño del recurso debe ser su tenant.",
        params: { sesion: { t: "string", d: "Sesión que pide el acceso" }, recurso: { t: "string", d: "Recurso al que se accede (id o ruta)" }, dueño_recurso: { t: "string", d: "Tenant dueño del recurso" }, operacion: { t: "string", d: "Operación (leer, escribir, borrar)", opt: true, def: "leer" } },
        code: `const st = store.load();
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
return ok({ permitido: false, sesion, tenant_sesion: b.tenant, dueño_recurso, recurso, operacion, razon: "CRUZADO: la sesión de '" + b.tenant + "' intenta tocar recurso de '" + dueño_recurso + "'" + (esRegulado ? " y el recurso es de tenant REGULADO: reportable" : ""), severidad: esRegulado ? "ALTA (tenant regulado)" : "media", violaciones_de_esta_sesion: st.violaciones.filter(v => v.sesion === sesion).length, accion: "DENIEGA la operación y no metas el contenido del recurso en el contexto de la sesión" });`,
      },
      {
        name: "isolation_report",
        desc: "Reporte de aislamiento: sesiones por tenant, violaciones y patrones sospechosos.",
        params: {},
        code: `const st = store.load();
const bindings = __vals(st.bindings || {});
const violaciones = st.violaciones || [];
if (!bindings.length) return ok({ sesiones: 0, mensaje: "sin sesiones ligadas: nada que auditar aún" });
const porTenant = {};
bindings.forEach(b => { porTenant[b.tenant] = (porTenant[b.tenant] || 0) + 1; });
const porSesionViol = {};
violaciones.forEach(v => { porSesionViol[v.sesion] = (porSesionViol[v.sesion] || 0) + 1; });
const reincidentes = Object.keys(porSesionViol).filter(s => porSesionViol[s] >= 3);
return ok({ sesiones_totales: bindings.length, tenants_activos: Object.keys(porTenant).length, sesiones_por_tenant: porTenant, violaciones_totales: violaciones.length, por_dueno_del_recurso: violaciones.reduce((acc, v) => { acc[v.dueño_recurso] = (acc[v.dueño_recurso] || 0) + 1; return acc; }, {}), sesiones_reincidentes: reincidentes, alerta: reincidentes.length ? "sesiones con 3+ intentos cruzados: " + reincidentes.join(", ") + " — patrón de sondeo: congela y revisa" : violaciones.length > 0 ? "violaciones puntuales registradas: revisa por qué se tentaron" : "aislamiento limpio" });`,
      },
    ],
  },
  {
    id: "tenant-quota-manager",
    title: "Tenant Quota Manager",
    tagline: "Cuotas por inquilino: tokens, llamadas y almacenaje con contadores que se agotan de verdad",
    category: "Multi-Tenant",
    pain: "Un tenant consume el 80% del presupuesto compartido y el resto ve respuestas lentas o errores: sin cuotas duras por inquilino, el recurso compartido es una tragedia de los comunes garantizada.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/tenant-quota-manager/. Cuotas por tenant (tokens, llamadas, MB) con ventana diaria renovable; consume() incrementa y check_quota() devuelve techo/restante con estado.",
    tools: [
      {
        name: "set_quota",
        desc: "Define la cuota de un tenant para el período actual.",
        params: { tenant: { t: "string", d: "Tenant" }, tokens: { t: "number", d: "Máximo de tokens (0 = ilimitado)", opt: true, def: 0 }, llamadas: { t: "number", d: "Máximo de llamadas/tools", opt: true, def: 0 }, almacenaje_mb: { t: "number", d: "Máximo de MB en store", opt: true, def: 0 } },
        code: `const st = store.load();
st.tenants = st.tenants = st.tenants || {};
st.cuotas = st.cuotas || {};
const dia = new Date().toISOString().slice(0, 10);
st.cuotas[tenant] = st.cuotas[tenant] || { contador: { tokens: 0, llamadas: 0, almacenaje_mb: 0 } };
st.cuotas[tenant].limite = { tokens, llamadas, almacenaje_mb };
st.cuotas[tenant].ventana = dia;
store.save(st);
return ok({ tenant, cuota: { tokens: tokens || "∞", llamadas: llamadas || "∞", almacenaje_mb: almacenaje_mb || "∞" }, ventana: dia, reinicio: "a medianoche (renueva la ventana con roll si cambia el día)" });`,
      },
      {
        name: "consume",
        desc: "Consume cuota: registra el gasto real del tenant en esta operación.",
        params: { tenant: { t: "string", d: "Tenant" }, tokens: { t: "number", d: "Tokens gastados", opt: true, def: 0 }, llamadas: { t: "number", d: "Llamadas gastadas", opt: true, def: 1 }, almacenaje_mb: { t: "number", d: "MB añadidos", opt: true, def: 0 } },
        code: `const st = store.load();
const c = (st.cuotas || {})[tenant];
if (!c) return fail("sin cuota definida para " + tenant + ": fíjala con set_quota");
const hoy = new Date().toISOString().slice(0, 10);
if (c.ventana !== hoy) { c.ventana = hoy; c.contador = { tokens: 0, llamadas: 0, almacenaje_mb: c.contador.almacenaje_mb }; }
c.contador.tokens += tokens;
c.contador.llamadas += llamadas;
c.contador.almacenaje_mb += almacenaje_mb;
const excede = (usado, max) => max > 0 && usado > max;
const bloqueos = [];
if (excede(c.contador.tokens, c.limite.tokens)) bloqueos.push("tokens: " + c.contador.tokens + "/" + c.limite.tokens);
if (excede(c.contador.llamadas, c.limite.llamadas)) bloqueos.push("llamadas: " + c.contador.llamadas + "/" + c.limite.llamadas);
if (excede(c.contador.almacenaje_mb, c.limite.almacenaje_mb)) bloqueos.push("almacenaje: " + Number(c.contador.almacenaje_mb.toFixed(1)) + "/" + c.limite.almacenaje_mb + "MB");
store.save(st);
return ok({ tenant, ventana: hoy, consumo_acumulado: { tokens: c.contador.tokens, llamadas: c.contador.llamadas, almacenaje_mb: Number(c.contador.almacenaje_mb.toFixed(2)) }, EN_CUOTA: bloqueos.length === 0, bloqueos_excedidos: bloqueos, accion_si_bloqueado: "degrada el servicio del tenant (respuestas más cortas, caché) o pausa hasta la próxima ventana: NO sigas gastando" });`,
      },
      {
        name: "check_quota",
        desc: "Consulta el margen restante del tenant ANTES de emprender una tarea grande.",
        params: { tenant: { t: "string", d: "Tenant" }, tarea_requeriria: { t: "any", d: "Estimación de la tarea {tokens?, llamadas?}", opt: true } },
        code: `const st = store.load();
const c = (st.cuotas || {})[tenant];
if (!c) return fail("sin cuota definida: " + tenant);
const hoy = new Date().toISOString().slice(0, 10);
const activa = c.ventana === hoy ? c.contador : { tokens: 0, llamadas: 0, almacenaje_mb: c.contador.almacenaje_mb };
const restante = {
  tokens: c.limite.tokens > 0 ? c.limite.tokens - activa.tokens : null,
  llamadas: c.limite.llamadas > 0 ? c.limite.llamadas - activa.llamadas : null
};
const req = tarea_requeriria || {};
const cabe = (restante.tokens === null || (req.tokens || 0) <= restante.tokens) && (restante.llamadas === null || (req.llamadas || 0) <= restante.llamadas);
return ok({ tenant, ventana: hoy, consumido: activa, restante: { tokens: restante.tokens ?? "∞", llamadas: restante.llamadas ?? "∞" }, tarea_estimada: req, cabe_la_tarea: cabe, uso_pct: { tokens: c.limite.tokens > 0 ? Number((activa.tokens / c.limite.tokens * 100).toFixed(0)) + "%" : "n/a", llamadas: c.limite.llamadas > 0 ? Number((activa.llamadas / c.limite.llamadas * 100).toFixed(0)) + "%" : "n/a" }, recomendacion: cabe ? "procede" : "NO cabe: divide la tarea, espera la renovación o renegocia cuota" });`,
      },
      {
        name: "quota_report",
        desc: "Panorama de cuotas: quién se acerca al límite, quién no usa la suya.",
        params: {},
        code: `const st = store.load();
const cuotas = __ents(st.cuotas || {});
if (!cuotas.length) return ok({ cuotas: 0, mensaje: "sin cuotas definidas" });
const hoy = new Date().toISOString().slice(0, 10);
const filas = cuotas.map(([tenant, c]) => {
  const cont = c.ventana === hoy ? c.contador : { tokens: 0, llamadas: 0 };
  const usoTokens = c.limite.tokens > 0 ? cont.tokens / c.limite.tokens : 0;
  const usoLlamadas = c.limite.llamadas > 0 ? cont.llamadas / c.limite.llamadas : 0;
  const uso = Math.max(usoTokens, usoLlamadas);
  return { tenant, uso_tokens_pct: c.limite.tokens ? Number((usoTokens * 100).toFixed(0)) + "%" : "∞", uso_llamadas_pct: c.limite.llamadas ? Number((usoLlamadas * 100).toFixed(0)) + "%" : "∞", estado: uso >= 1 ? "AGOTADO" : uso >= 0.85 ? "CRÍTICO (>85%)" : uso >= 0.6 ? "alto" : uso > 0 ? "normal" : "sin uso" };
}).sort((a, b) => (b.uso_tokens_pct === "∞" ? 0 : 1) - (a.uso_tokens_pct === "∞" ? 0 : 1));
const criticos = filas.filter(f => f.estado === "CRÍTICO (>85%)" || f.estado === "AGOTADO");
const sinUso = filas.filter(f => f.estado === "sin uso");
return ok({ tenants: filas.length, filas, criticos, sin_uso: sinUso, redistribucion: criticos.length && sinUso.length ? "hay " + sinUso.length + " tenants sin uso y " + criticos.length + " al límite: el presupuesto compartido está mal repartido, renegocia" : "reparto razonable" });`,
      },
    ],
  },
  {
    id: "noisy-neighbor-detector",
    title: "Noisy Neighbor Detector",
    tagline: "Detecta al inquilino ruidoso: quién consume más de lo justo y degrada la experiencia de los demás",
    category: "Multi-Tenant",
    pain: "Todos los tenants ven 'el agente va lento' pero nadie ve quién lo causa: sin medición de consumo relativo por inquilino, el vecino ruidoso es invisible y la degradación se achaca al sistema.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/noisy-neighbor-detector/. Eventos de uso por tenant con coste (tokens/ms); índice de desequilibrio tipo Gini sobre el consumo; flaggeo de tenants por encima del umbral de su cuota relativa.",
    tools: [
      {
        name: "record_usage_event",
        desc: "Registra un evento de uso con su coste para atribución por tenant.",
        params: { tenant: { t: "string", d: "Tenant" }, tokens: { t: "number", d: "Tokens consumidos", opt: true, def: 0 }, latencia_ms: { t: "number", d: "Latencia añadida al sistema", opt: true, def: 0 }, operacion: { t: "string", d: "Operación", opt: true } },
        code: `const st = store.load();
st.eventos = st.eventos || [];
st.eventos.push({ tenant, tokens, latencia_ms, operacion: operacion || "", ts: new Date().toISOString() });
if (st.eventos.length > 5000) st.eventos = st.eventos.slice(-4000);
store.save(st);
return ok({ registrado: true, eventos: st.eventos.length });`,
      },
      {
        name: "analyze_fairness",
        desc: "Índice de equidad del consumo (Gini) y ranking de contribución al coste total.",
        params: { ventana_minutos: { t: "number", d: "Ventana de análisis", opt: true, def: 60 } },
        code: `const st = store.load();
const desde = Date.now() - ventana_minutos * 60000;
const eventos = (st.eventos || []).filter(e => new Date(e.ts).getTime() >= desde);
if (eventos.length < 10) return ok({ eventos: eventos.length, mensaje: "datos insuficientes en la ventana" });
const peso = {};
eventos.forEach(e => { peso[e.tenant] = (peso[e.tenant] || 0) + e.tokens + e.latencia_ms / 100; });
const tenants = __vals(peso);
const total = tenants.reduce((a, b) => a + b, 0) || 1;
const ordenados = tenants.slice().sort((a, b) => a - b);
const n = ordenados.length;
let acumulado = 0;
ordenados.forEach(v => { acumulado += v; });
let gini = 0;
ordenados.forEach((v, i) => { gini += (2 * (i + 1) - n - 1) * v; });
gini = gini / (n * acumulado);
const porTenant = {};
__ents(peso).forEach(([t, v]) => { porTenant[t] = { peso: v, share: Number((v / total * 100).toFixed(1)) + "%" }; });
return ok({ ventana_minutos, eventos: eventos.length, tenants: n, indice_gini: Number(gini.toFixed(3)), equidad: gini < 0.3 ? "equitativa" : gini < 0.6 ? "concentrada" : "ALTAMENTE DESIGUAL: un tenant domina el consumo", consumo_por_tenant: porTenant, top_consumidor: Object.keys(porTenant).sort((a, b) => peso[b] - peso[a])[0] });`,
      },
      {
        name: "flag_noisy",
        desc: "Marca a los tenants ruidosos: consumo desproporcionado frente a su cuota o frente a la mediana.",
        params: { umbral_x_mediana: { t: "number", d: "Veces la mediana para ser ruidoso", opt: true, def: 3 } },
        code: `const st = store.load();
const eventos = st.eventos || [];
if (eventos.length < 20) return ok({ eventos: eventos.length, mensaje: "insuficiente histórico" });
const peso = {};
eventos.forEach(e => { peso[e.tenant] = (peso[e.tenant] || 0) + e.tokens + e.latencia_ms / 100; });
const ruidosos = __ents(peso).map(([t, v]) => {
  const otros = __vals(peso).filter(x => x !== v).sort((a, b) => a - b);
  const medianaOtros = otros.length ? otros[Math.floor(otros.length / 2)] : v;
  return { tenant: t, peso: v, mediana_de_los_demas: medianaOtros, vs_mediana: Number((v / Math.max(medianaOtros, 1)).toFixed(1)) + "x", eventos: eventos.filter(e => e.tenant === t).length, ruidoso: v > medianaOtros * umbral_x_mediana };
}).filter(x => x.ruidoso);
const latenciaAportada = {};
eventos.forEach(e => { latenciaAportada[e.tenant] = (latenciaAportada[e.tenant] || 0) + e.latencia_ms; });
return ok({ umbral: umbral_x_mediana + "x la mediana de los demás", ruidosos, aportacion_latencia_ms: __ents(latenciaAportada).map(([t, v]) => ({ tenant: t, latencia_total_ms: Math.round(v) })).sort((a, b) => b.latencia_total_ms - a.latencia_total_ms).slice(0, 5), accion: ruidosos.length ? "aplica throttle al tenant marcado o revisa su patrón (¿bucle?, ¿tareas redundantes?)" : "sin vecinos ruidosos" });`,
      },
    ],
  },
]

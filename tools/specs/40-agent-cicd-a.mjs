// ═══ CATEGORÍA: Dolores FUTUROS · Agent CI/CD (A) ═══
// Evidencia: los prompts y configuraciones de agentes cambian igual que el
// código: sin versionado, canary y rollback, cada edición es un deploy a
// producción a ciegas. Las lecciones de CI/CD clásico aplican al prompting.
export default [
  {
    id: "prompt-versioner",
    title: "Prompt Versioner",
    tagline: "Control de versiones para prompts y system prompts: commits con diff, semántica y puntero de despliegue",
    category: "Agent CI/CD",
    pain: "El prompt se 'mejora' editando el archivo a mano: no hay diff, ni versión previa, ni forma de volver. Si el agente empeora, nadie sabe qué línea cambió ni cuándo: el prompt es el código más editado y el menos versionado del planeta.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/prompt-versioner/. Cada prompt tiene historia de versiones inmutables con mensaje de commit, diff automático (línea a línea) y bump semántico (major = cambia comportamiento esperado).",
    tools: [
      {
        name: "register_prompt",
        desc: "Registra un prompt nuevo con su contenido inicial (versión 0.1.0).",
        params: { nombre: { t: "string", d: "Identificador del prompt" }, contenido: { t: "string", d: "Texto completo del prompt" }, proposito: { t: "string", d: "Para qué sirve", opt: true } },
        code: `const st = store.load();
st.prompts = st.prompts || {};
if (st.prompts[nombre]) return fail("prompt ya registrado: " + nombre + " (usa commit_version para evolucionarlo)");
if (!contenido || contenido.trim().length < 10) return fail("contenido demasiado corto para versionar");
st.prompts[nombre] = { nombre, proposito: proposito || "", versiones: [{ version: "0.1.0", contenido, commit: "registro inicial", ts: new Date().toISOString() }], puntero: "0.1.0" };
store.save(st);
return ok({ nombre, version: "0.1.0", lineas: contenido.split("\\n").length, caracteres: contenido.length });`,
      },
      {
        name: "commit_version",
        desc: "Commit de una nueva versión con bump semántico y mensaje explicando el cambio.",
        params: { nombre: { t: "string", d: "Prompt a versionar" }, contenido: { t: "string", d: "Texto COMPLETO de la nueva versión" }, commit: { t: "string", d: "Mensaje del commit (qué y por qué)" }, bump: { t: "enum", d: "Severidad del cambio", values: ["patch", "minor", "major"] } },
        code: `const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado: " + nombre);
const anterior = p.versiones[p.versiones.length - 1];
if (anterior.contenido === contenido) return fail("contenido idéntico a la versión " + anterior.version + ": nada que commitear");
const [ma, mi, pa] = anterior.version.split(".").map(Number);
const nueva = bump === "major" ? [ma + 1, 0, 0] : bump === "minor" ? [ma, mi + 1, 0] : [ma, mi, pa + 1];
const version = nueva.join(".");
p.versiones.push({ version, contenido, commit, bump, ts: new Date().toISOString(), parent: anterior.version });
store.save(st);
return ok({ nombre, version, parent: anterior.version, commit, total_versiones: p.versiones.length, desplegada: p.puntero === version ? "SI (el puntero ya apunta aquí)" : "NO: usa set_pointer para desplegarla" });`,
      },
      {
        name: "diff_versions",
        desc: "Diff línea a línea entre dos versiones del prompt.",
        params: { nombre: { t: "string", d: "Prompt" }, desde: { t: "string", d: "Versión origen", opt: true }, hasta: { t: "string", d: "Versión destino", opt: true } },
        code: `const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado");
const vs = p.versiones;
const a = vs.find(v => v.version === (desde || vs[vs.length - 2]?.version));
const b = vs.find(v => v.version === (hasta || vs[vs.length - 1]?.version));
if (!a || !b) return fail("versiones no encontradas: disponibles " + vs.map(v => v.version).join(", "));
const la = a.contenido.split("\\n"), lb = b.contenido.split("\\n");
const setA = new Map(la.map((l, i) => [l + "#" + i, l]));
const borradas = la.filter(l => !lb.includes(l));
const añadidas = lb.filter(l => !la.includes(l));
const comunes = la.filter(l => lb.includes(l)).length;
return ok({ nombre, desde: a.version, hasta: b.version, lineas_antes: la.length, lineas_despues: lb.length, eliminadas: borradas.length, añadidas: añadidas.length, intactas: comunes, detalle_eliminadas: borradas.slice(0, 15).map(l => "- " + l.slice(0, 90)), detalle_añadidas: añadidas.slice(0, 15).map(l => "+ " + l.slice(0, 90)), riesgo: añadidas.length + borradas.length > la.length * 0.4 ? "ALTO: más del 40% del prompt cambió: valida con canary antes de desplegar" : "moderado/bajo" });`,
      },
      {
        name: "set_pointer",
        desc: "Mueve el puntero de despliegue a una versión concreta (deploy explícito, auditable).",
        params: { nombre: { t: "string", d: "Prompt" }, version: { t: "string", d: "Versión a desplegar" }, razon: { t: "string", d: "Por qué se despliega", opt: true } },
        code: `const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado");
const v = p.versiones.find(x => x.version === version);
if (!v) return fail("versión inexistente: " + version + " (disponibles: " + p.versiones.map(x => x.version).join(", ") + ")");
const anterior = p.puntero;
p.puntero = version;
p.despliegues = p.despliegues || [];
p.despliegues.push({ desde: anterior, a: version, razon: razon || "", ts: new Date().toISOString() });
store.save(st);
return ok({ nombre, desplegada: version, anterior, con_rollback_rapido: "rollback_manager puede volver a " + anterior + " en un paso" });`,
      },
      {
        name: "history",
        desc: "Historia completa del prompt con commits y despliegues.",
        params: { nombre: { t: "string", d: "Prompt" } },
        code: `const st = store.load();
const p = (st.prompts || {})[nombre];
if (!p) return fail("prompt no registrado");
return ok({ nombre, desplegada_actualmente: p.puntero, proposito: p.proposito, versiones: p.versiones.map(v => ({ version: v.version, commit: v.commit, bump: v.bump || "init", ts: v.ts, caracteres: v.contenido.length })), despliegues: (p.despliegues || []).slice(-10), crecimiento: Number((p.versiones[p.versiones.length - 1].contenido.length / p.versiones[0].contenido.length).toFixed(2)) + "x desde la primera versión" });`,
      },
    ],
  },
  {
    id: "canary-deployer",
    title: "Canary Deployer",
    tagline: "Despliega cambios de agente al 10% del tráfico, mide, y decide con datos: promover o revertir",
    category: "Agent CI/CD",
    pain: "El prompt nuevo se despliega al 100% de golpe: si degrada la calidad, se entera por las quejas de los usuarios con horas de daño. El canary clásico del backend jamás llegó al mundo de los agentes.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/canary-deployer/. Lanzamientos canary con % de tráfico, resultados por variante (éxito, latencia, calidad) y criterio de decisión estadístico (banda de tolerancia) para promover o abortar.",
    tools: [
      {
        name: "start_canary",
        desc: "Inicia un canary: variante A (control) vs B (candidata) con % inicial de tráfico.",
        params: { sistema: { t: "string", d: "Qué se despliega (prompt, herramienta, configuración)" }, control: { t: "string", d: "Identificador de la versión estable (A)" }, candidata: { t: "string", d: "Identificador de la versión nueva (B)" }, pct_inicial: { t: "number", d: "% de tráfico inicial a la candidata", opt: true, def: 10 }, min_muestras: { t: "number", d: "Muestras mínimas por variante antes de decidir", opt: true, def: 30 }, tolerancia_pct: { t: "number", d: "Pérdida máxima tolerada en la métrica principal", opt: true, def: 5 } },
        code: `const st = store.load();
st.canaries = st.canaries || [];
const activo = st.canaries.find(c => c.sistema === sistema && c.estado === "ACTIVO");
if (activo) return fail("ya hay un canary ACTIVO para " + sistema + " (id " + activo.id + "): ciérralo primero");
const id = "cny_" + String(st.canaries.length + 1).padStart(4, "0");
st.canaries.push({ id, sistema, control, candidata, pct: pct_inicial, min_muestras, tolerancia_pct, estado: "ACTIVO", resultados: { A: [], B: [] }, decision: null, iniciado: new Date().toISOString() });
store.save(st);
return ok({ id, sistema, reparto: { A: 100 - pct_inicial + "%", B: pct_inicial + "%" }, min_muestras_por_variante: min_muestras, tolerancia: tolerancia_pct + "% de pérdida máxima", siguiente: "envía resultados con record_result etiquetando la variante" });`,
      },
      {
        name: "record_result",
        desc: "Registra el resultado de una ejecución real bajo una variante.",
        params: { id: { t: "string", d: "Id del canary" }, variante: { t: "enum", d: "Variante que sirvió la ejecución", values: ["A", "B"] }, exito: { t: "boolean", d: "¿La ejecución cumplió su objetivo?" }, latencia_ms: { t: "number", d: "Tiempo total", opt: true }, calidad: { t: "number", d: "Score de calidad 0-100 si lo mides", opt: true } },
        code: `const st = store.load();
const c = (st.canaries || []).find(x => x.id === id);
if (!c) return fail("canary no encontrado");
if (c.estado !== "ACTIVO") return fail("canary " + c.estado + ": no admite resultados");
c.resultados[variante].push({ exito, latencia_ms: latencia_ms ?? null, calidad: calidad ?? null, ts: new Date().toISOString() });
store.save(st);
const nA = c.resultados.A.length, nB = c.resultados.B.length;
return ok({ id, variante, muestras: { A: nA, B: nB }, listas_para_decidir: nA >= c.min_muestras && nB >= c.min_muestras });`,
      },
      {
        name: "evaluate_canary",
        desc: "Evalúa el canary con banda de tolerancia: PROMOVER, MANTENER (más muestras) o ABORTAR.",
        params: { id: { t: "string", d: "Id del canary" }, auto_escala: { t: "boolean", d: "Si se mantiene: sugerir subir el % de tráfico", opt: true, def: true } },
        code: `const st = store.load();
const c = (st.canaries || []).find(x => x.id === id);
if (!c) return fail("canary no encontrado");
const A = c.resultados.A, B = c.resultados.B;
if (A.length < c.min_muestras || B.length < c.min_muestras) return ok({ estado: "MANTENER", razon: "muestras insuficientes (A:" + A.length + " B:" + B.length + " de " + c.min_muestras + ")", accion: "sigue registrando resultados" });
const tasa = (arr) => arr.filter(r => r.exito).length / arr.length;
const tA = tasa(A), tB = tasa(B);
const deltaRel = tA > 0 ? (tB - tA) / tA * 100 : tB > 0 ? 100 : 0;
const latA = A.filter(r => r.latencia_ms).length ? A.filter(r => r.latencia_ms).reduce((s, r) => s + r.latencia_ms, 0) / A.filter(r => r.latencia_ms).length : null;
const latB = B.filter(r => r.latencia_ms).length ? B.filter(r => r.latencia_ms).reduce((s, r) => s + r.latencia_ms, 0) / B.filter(r => r.latencia_ms).length : null;
let estado, razon, accion;
if (deltaRel >= 0) { estado = "PROMOVER"; razon = "la candidata mejora la tasa de éxito en " + Number(deltaRel.toFixed(1)) + "% (" + Number((tB * 100).toFixed(1)) + "% vs " + Number((tA * 100).toFixed(1)) + "%)"; accion = "sube a 100% con promote"; }
else if (Math.abs(deltaRel) <= c.tolerancia_pct) { estado = "MANTENER"; razon = "pérdida de " + Number(Math.abs(deltaRel).toFixed(1)) + "% dentro de la tolerancia de " + c.tolerancia_pct + "%"; accion = auto_escala ? "sube el tráfico a " + Math.min(c.pct * 2, 50) + "% para ganar confianza" : "continúa recogiendo muestras"; }
else { estado = "ABORTAR"; razon = "la candidata PEORA la tasa de éxito en " + Number(Math.abs(deltaRel).toFixed(1)) + "%, muy por encima de la tolerancia"; accion = "vuelve todo el tráfico a A YA y etiqueta la candidata como rechazada"; }
return ok({ id, sistema: c.sistema, estado, razon, accion, metricas: { tasa_exito_A: Number((tA * 100).toFixed(1)) + "%", tasa_exito_B: Number((tB * 100).toFixed(1)) + "%", delta_relativo: Number(deltaRel.toFixed(1)) + "%", latencia_media_A: latA ? Math.round(latA) + "ms" : "n/d", latencia_media_B: latB ? Math.round(latB) + "ms" : "n/d" }, muestras: { A: A.length, B: B.length } });`,
      },
      {
        name: "close_canary",
        desc: "Cierra el canary con la decisión final aplicada (promovido o abortado).",
        params: { id: { t: "string", d: "Id del canary" }, decision: { t: "enum", d: "Decisión final", values: ["promovida", "abortada", "empate_manual"] }, nota: { t: "string", d: "Nota de cierre", opt: true } },
        code: `const st = store.load();
const c = (st.canaries || []).find(x => x.id === id);
if (!c) return fail("canary no encontrado");
if (c.estado !== "ACTIVO") return fail("ya cerrado");
c.estado = decision === "promovida" ? "PROMOVIDA" : decision === "abortada" ? "ABORTADA" : "EMPATE";
c.decision = { decision, nota: nota || "", ts: new Date().toISOString(), muestras_A: c.resultados.A.length, muestras_B: c.resultados.B.length };
store.save(st);
return ok({ id, cerrado: true, decision, efecto: decision === "promovida" ? "la candidata " + c.candidata + " es la nueva estable" : decision === "abortada" ? "todo el tráfico vuelve a " + c.control : "decisión humana documentada", leccion: decision === "abortada" ? "registra POR QUÉ falló la candidata: alimenta la próxima iteración" : null });`,
      },
    ],
  },
  {
    id: "rollback-manager",
    title: "Rollback Manager",
    tagline: "Volver atrás en un paso: snapshots nombrados de configuración del agente con restauración verificada",
    category: "Agent CI/CD",
    pain: "El cambio de configuración rompe al agente a las 3am: 'volver atrás' significa recordar qué 6 archivos se tocaron y rezar. Sin snapshots nombrados ni rollback de un comando, cada regresión es arqueología manual.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/rollback-manager/. Snapshots de configuración (conjuntos clave-valor) con etiqueta; rollback atómico a cualquier snapshot con verificación de integridad y registro de quién/por qué.",
    tools: [
      {
        name: "capture_snapshot",
        desc: "Captura un snapshot nombrado de la configuración actual del agente.",
        params: { etiqueta: { t: "string", d: "Nombre del snapshot (ej: pre-migracion-router)" }, config: { t: "any", d: "Objeto de configuración completo a congelar" }, razon: { t: "string", d: "Por qué se captura (antes de cambiar X)", opt: true } },
        code: `const st = store.load();
st.snapshots = st.snapshots || [];
if (st.snapshots.some(s => s.etiqueta === etiqueta)) return fail("etiqueta ya usada: " + etiqueta + " (el historial es inmutable)");
const crypto = await import("node:crypto");
const hash = crypto.createHash("sha256").update(JSON.stringify(config)).digest("hex").slice(0, 16);
st.snapshots.push({ etiqueta, config, razon: razon || "", hash, ts: new Date().toISOString(), restaurado: 0 });
store.save(st);
return ok({ etiqueta, claves_congeladas: Object.keys(config || {}).length, hash, creado: st.snapshots[st.snapshots.length - 1].ts, uso: "rollback_to('" + etiqueta + "') si algo sale mal" });`,
      },
      {
        name: "rollback_to",
        desc: "Restaura la configuración a un snapshot: devuelve la config completa y verifica el hash.",
        params: { etiqueta: { t: "string", d: "Snapshot a restaurar" }, verificacion: { t: "any", d: "Config actual para calcular qué cambirá (opcional, mejora el reporte)", opt: true } },
        code: `const st = store.load();
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
return ok({ restaurado_a: etiqueta, config: s.config, integridad: "verificada (" + s.hash + ")", capturado: s.ts, razon_original: s.razon, restauraciones_previas: s.restaurado - 1, efectos: cambios, aviso: s.restaurado > 2 ? "este snapshot se restaura por " + (s.restaurado) + "ª vez: esa configuración es frágil, arregla la raíz" : null });`,
      },
      {
        name: "list_snapshots",
        desc: "Lista snapshots disponibles con antigüedad y frecuencia de restauración.",
        params: {},
        code: `const st = store.load();
const snaps = st.snapshots || [];
if (!snaps.length) return ok({ snapshots: 0, mensaje: "sin snapshots: captura ANTES de cambiar cosas" });
return ok({ snapshots: snaps.map(s => ({ etiqueta: s.etiqueta, razon: s.razon.slice(0, 60), capturado: s.ts, antiguedad_dias: Number(((Date.now() - new Date(s.ts).getTime()) / 86400000).toFixed(1)), veces_restaurado: s.restaurado, claves: Object.keys(s.config || {}).length })).reverse(), rollbacks_totales: (st.rollbacks || []).length });`,
      },
      {
        name: "diff_against_snapshot",
        desc: "Compara tu configuración actual contra un snapshot: qué se ha tocado desde entonces.",
        params: { etiqueta: { t: "string", d: "Snapshot de referencia" }, config_actual: { t: "any", d: "Configuración actual" } },
        code: `const st = store.load();
const s = (st.snapshots || []).find(x => x.etiqueta === etiqueta);
if (!s) return fail("snapshot no encontrado: " + etiqueta);
const antes = s.config || {}, ahora = config_actual || {};
const cambiadas = Object.keys(ahora).filter(k => k in antes && JSON.stringify(antes[k]) !== JSON.stringify(ahora[k]));
const nuevas = Object.keys(ahora).filter(k => !(k in antes));
const eliminadas = Object.keys(antes).filter(k => !(k in ahora));
return ok({ referencia: etiqueta, capturado: s.ts, cambian_valor: cambiadas.map(k => ({ clave: k, antes: JSON.stringify(antes[k]).slice(0, 60), ahora: JSON.stringify(ahora[k]).slice(0, 60) })), nuevas, eliminadas, estabilidad: cambiadas.length + nuevas.length + eliminadas.length === 0 ? "idéntica al snapshot" : cambiadas.length + nuevas.length + eliminadas.length < 4 ? "drift leve" : "drift fuerte: considera capturar NUEVO snapshot para fijar el estado real" });`,
      },
    ],
  },
]

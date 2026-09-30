// ═══ CATEGORÍA: Dolores FUTUROS · Pre-Vuelo de Acciones (A) ═══
// Evidencia: los agentes autónomos ejecutan acciones destructivas sin estimar
// alcance (blast radius), sin ensayo previo (dry-run) y sin registrar efectos
// secundarios para poder deshacer. La literatura de agent safety pide
// "pre-flight checks" y compensación de efectos antes de actuar.
export default [
  {
    id: "blast-radius-estimator",
    title: "Blast Radius Estimator",
    tagline: "Antes de ejecutar una acción: estima cuántos sistemas, datos y usuarios quedan dentro del radio de impacto",
    category: "Pre-Vuelo",
    pain: "El agente borra una tabla 'inocente' y descubre que alimentaba 3 servicios: nadie le dijo que estimara el radio de explosión de sus acciones antes de pulsar el botón.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/blast-radius-estimator/. Grafo de sistemas con dependencias y criticidad; la propagación transitiva calcula el radio de impacto real de una acción.",
    tools: [
      {
        name: "register_system",
        desc: "Registra un sistema/recurso del entorno con criticidad y dependientes directos.",
        params: { sistema: { t: "string", d: "Nombre del sistema/recurso (ej: db-usuarios)" }, criticidad: { t: "enum", d: "Criticidad del sistema", values: ["baja", "media", "alta", "critica"] }, descripcion: { t: "string", d: "Qué es y para qué sirve", opt: true }, dependientes: { t: "array", d: "Sistemas que dependen de este {sistema, porque}", opt: true } },
        code: `const st = store.load();
st.sistemas = st.sistemas || {};
if (st.sistemas[sistema]) return fail("sistema ya registrado: " + sistema + " (usa add_dependency para extenderlo)");
const pesos = { baja: 1, media: 2, alta: 3, critica: 5 };
st.sistemas[sistema] = { sistema, criticidad, peso: pesos[criticidad] || 2, descripcion: descripcion || "", dependientes: (dependientes || []).map(d => ({ sistema: String(d.sistema || d), porque: String(d.porque || "dependencia no documentada") })), creado: new Date().toISOString() };
store.save(st);
return ok({ sistema, criticidad, dependientes_registrados: st.sistemas[sistema].dependientes.length });`,
      },
      {
        name: "add_dependency",
        desc: "Añade una dependencia: 'consumidor' depende de 'proveedor'. Alimenta la propagación del radio.",
        params: { proveedor: { t: "string", d: "Sistema del que se depende" }, consumidor: { t: "string", d: "Sistema que depende del proveedor" }, porque: { t: "string", d: "Por qué depende (dato, servicio, colateral)" } },
        code: `const st = store.load();
st.sistemas = st.sistemas || {};
if (!st.sistemas[proveedor]) return fail("proveedor no registrado: " + proveedor + " (regístralo primero con register_system)");
if (!st.sistemas[consumidor]) return fail("consumidor no registrado: " + consumidor);
st.sistemas[proveedor].dependientes.push({ sistema: consumidor, porque });
store.save(st);
return ok({ edge: consumidor + " -> " + proveedor, porque, total_dependientes: st.sistemas[proveedor].dependientes.length });`,
      },
      {
        name: "estimate",
        desc: "Calcula el blast radius de una acción: propagación transitiva por el grafo con pesos y veredicto de aprobación.",
        params: { accion: { t: "string", d: "Acción a evaluar (ej: DROP TABLE usuarios)" }, objetivos: { t: "array", d: "Sistemas/recursos que la acción toca directamente" }, modo: { t: "enum", d: "Modo de acceso", values: ["lectura", "escritura", "borrado", "configuracion"] } },
        code: `const st = store.load();
const sis = st.sistemas || {};
if (!Object.keys(sis).length) return fail("grafo vacío: registra sistemas con register_system");
const objetivosValidos = (objetivos || []).filter(o => sis[String(o)]);
const desconocidos = (objetivos || []).filter(o => !sis[String(o)]).map(String);
if (!objetivosValidos.length) return fail("ningún objetivo está en el grafo" + (desconocidos.length ? " (desconocidos: " + desconocidos.join(", ") + ")" : ""));
const multi = { lectura: 0.3, escritura: 1, borrado: 1.6, configuracion: 1.3 };
const factor = multi[modo] || 1;
const afectados = {};
const cola = objetivosValidos.map(o => String(o));
let profundidad = 0;
while (cola.length && profundidad < 6) {
  const actual = cola.shift();
  if (afectados[actual] !== undefined) continue;
  afectados[actual] = profundidad;
  const deps = (sis[actual].dependientes || []).map(d => d.sistema).filter(s => sis[s] && afectados[s] === undefined);
  deps.forEach(d => cola.push(d));
  profundidad++;
}
const lista = Object.keys(afectados).map(s => ({ sistema: s, criticidad: sis[s].criticidad, nivel_propagacion: afectados[s], por_que: afectados[s] === 0 ? "objetivo directo" : "depende de nivel " + (afectados[s] - 1) }));
const score = Math.round(lista.reduce((acc, a) => acc + sis[a.sistema].peso * (1 + 0.4 / (a.nivel_propagacion + 1)), 0) * factor);
const criticos = lista.filter(a => a.criticidad === "critica" || a.criticidad === "alta");
const veredicto = score >= 40 || criticos.some(c => c.nivel_propagacion === 0) ? "BLOQUEAR: requiere aprobación humana explícita antes de ejecutar" : score >= 15 ? "PRECAUCIÓN: notifica a los sistemas afectados y captura punto de restauración" : "BAJO: procede con registro de efectos en side-effect-ledger";
st.historial = st.historial || [];
st.historial.push({ accion, objetivos: objetivosValidos.map(String), modo, score, veredicto, ts: new Date().toISOString() });
store.save(st);
return ok({ accion, modo, factor_amplificacion: factor, sistemas_en_radio: lista.length, radio: lista, score_impacto: score, sistemas_criticos_alcanzados: criticos, objetivos_fuera_del_grafo: desconocidos, veredicto });`,
      },
      {
        name: "blast_history",
        desc: "Historial de estimaciones: qué acciones tuvieron mayor radio estimado.",
        params: { limite: { t: "number", d: "Máximo a mostrar", opt: true, def: 10 } },
        code: `const st = store.load();
const h = (st.historial || []).slice().sort((a, b) => b.score - a.score).slice(0, limite);
return ok({ estimaciones: (st.historial || []).length, top_estimaciones: h });`,
      },
      {
        name: "coverage_report",
        desc: "Qué parte del entorno real está modelado en el grafo (anti-puntos-ciegos).",
        params: {},
        code: `const st = store.load();
const sis = st.sistemas || {};
const nombres = Object.keys(sis);
if (!nombres.length) return ok({ modelados: 0, aviso: "grafo vacío: todo es punto ciego" });
const sinDependientes = nombres.filter(n => !(sis[n].dependientes || []).length);
const huerfanos = nombres.filter(n => !nombres.some(m => (sis[m].dependientes || []).some(d => d.sistema === n)));
return ok({ sistemas_modelados: nombres.length, por_criticidad: { critica: nombres.filter(n => sis[n].criticidad === "critica").length, alta: nombres.filter(n => sis[n].criticidad === "alta").length }, sin_dependientes_declarados: sinDependientes, huerfanos_nadie_depende: huerfanos, aviso: huerfanos.length > nombres.length / 2 ? "más de la mitad del grafo está aislado: el radio se subestima, completa las dependencias" : "grafo razonablemente conectado" });`,
      },
    ],
  },
  {
    id: "dry-run-executor",
    title: "Dry-Run Executor",
    tagline: "Ensayo el plan ANTES de ejecutarlo: detecta pasos fuera de orden, efectos sin deshacer y dependencias faltantes",
    category: "Pre-Vuelo",
    pain: "El plan del agente se ve bien en texto pero al ejecutarlo el paso 4 depende de un dato que el paso 7 produce: el agente descubre el error con la mitad del mundo ya modificada.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/dry-run-executor/. Modela pasos con: lee (inputs), escribe (outputs), destruye (irreversible), requiere (precondición). El motor valida orden, disponibilidad de datos y cobertura de deshacer.",
    tools: [
      {
        name: "define_plan",
        desc: "Registra un plan como lista de pasos declarativos con lo que leen/escriben/destruyen/requieren.",
        params: { plan: { t: "string", d: "Nombre del plan" }, pasos: { t: "array", d: "Pasos {nombre, lee:[], escribe:[], destruye:[], requiere:[]}" }, proposito: { t: "string", d: "Objetivo del plan", opt: true } },
        code: `const st = store.load();
st.planes = st.planes || {};
const limpios = (pasos || []).map((p, i) => ({
  nombre: String(p.nombre || ("paso_" + (i + 1))),
  lee: (p.lee || []).map(String),
  escribe: (p.escribe || []).map(String),
  destruye: (p.destruye || []).map(String),
  requiere: (p.requiere || []).map(String)
}));
if (!limpios.length) return fail("plan sin pasos");
st.planes[plan] = { plan, proposito: proposito || "", pasos: limpios, creado: new Date().toISOString(), ensayos: 0 };
store.save(st);
return ok({ plan, pasos: limpios.length, aviso: "ejecuta dry_run para validarlo antes de la ejecución real" });`,
      },
      {
        name: "dry_run",
        desc: "Ensaya el plan: verifica orden de datos, precondiciones, pasos destructivos sin compensación y variables huérfanas.",
        params: { plan: { t: "string", d: "Plan a ensayar" }, datos_iniciales: { t: "array", d: "Datos/recursos que existen antes de empezar", opt: true } },
        code: `const st = store.load();
const p = (st.planes || {})[plan];
if (!p) return fail("plan no definido: " + plan);
p.ensayos = (p.ensayos || 0) + 1;
const disponibles = new Set((datos_iniciales || []).map(String));
const problemas = [];
const huérfanas = new Set();
p.pasos.forEach((paso, i) => {
  (paso.requiere || []).forEach(r => { if (!disponibles.has(r)) problemas.push({ paso: i + 1, nombre: paso.nombre, tipo: "PRECONDICION_FALTA", detalle: "requiere '" + r + "' que no existe aún" }); });
  (paso.lee || []).forEach(l => { if (!disponibles.has(l)) { problemas.push({ paso: i + 1, nombre: paso.nombre, tipo: "LEE_INEXISTENTE", detalle: "lee '" + l + "' que nadie produce ni está en los datos iniciales" }); huérfanas.add(l); } });
  (paso.destruye || []).forEach(d => { if (!disponibles.has(d)) problemas.push({ paso: i + 1, nombre: paso.nombre, tipo: "DESTRUYE_INEXISTENTE", detalle: "destruye '" + d + "' que no existe" }); });
  (paso.escribe || []).forEach(e => disponibles.add(e));
  (paso.lee || []).forEach(l => disponibles.add(l));
  (paso.requiere || []).forEach(r => disponibles.add(r));
});
const destructivosSinCompensar = [];
p.pasos.forEach((paso, i) => {
  (paso.destruye || []).forEach(d => {
    const compensado = p.pasos.some(o => (o.escribe || []).includes(d));
    if (!compensado) destructivosSinCompensar.push({ paso: i + 1, nombre: paso.nombre, recurso: d });
  });
});
destructivosSinCompensar.forEach(dc => problemas.push({ paso: dc.paso, nombre: dc.nombre, tipo: "DESTRUCTIVO_SIN_COMPENSAR", detalle: "destruye '" + dc.recurso + "' y ningún paso lo regenera: irreversible dentro del plan" }));
const escribeSinLeer = [];
p.pasos.forEach((paso, i) => (paso.escribe || []).forEach(e => { const loUsaAlguien = p.pasos.some(o => (o.lee || []).includes(e) || (o.requiere || []).includes(e)); if (!loUsaAlguien) escribeSinLeer.push({ paso: i + 1, dato: e }); }));
const veredicto = problemas.some(pr => pr.tipo === "PRECONDICION_FALTA" || pr.tipo === "LEE_INEXISTENTE" || pr.tipo === "DESTRUCTIVO_SIN_COMPENSAR") ? "NO_EJECUTAR: corrige el plan primero" : problemas.length ? "EJECUTAR_CON_CUIDADO: hay avisos menores" : "LISTO: el plan ensaya limpio";
store.save(st);
return ok({ plan, ensayo_numero: p.ensayos, pasos: p.pasos.length, problemas, variables_huerfanas: [...huérfanas], pasos_destructivos_sin_compensar: destructivosSinCompensar, escribe_sin_consumir: escribeSinLeer, veredicto });`,
      },
      {
        name: "reorder_suggestion",
        desc: "Sugiere un reordenamiento de pasos que resuelve dependencias de datos por orden topológico.",
        params: { plan: { t: "string", d: "Plan a reordenar" } },
        code: `const st = store.load();
const p = (st.planes || {})[plan];
if (!p) return fail("plan no definido");
const pasos = p.pasos.map((x, i) => ({ idx: i, ...x }));
const prod = new Map();
(datos => { pasos.forEach(paso => (paso.escribe || []).forEach(e => { if (!prod.has(e)) prod.set(e, paso.idx); })); })();
const antes = (a, b) => {
  const depsA = [...(a.lee || []), ...(a.requiere || [])].filter(d => prod.has(d) && prod.get(d) !== a.idx);
  const depsB = [...(b.lee || []), ...(b.requiere || [])].filter(d => prod.has(d) && prod.get(d) !== b.idx);
  return depsA.length - depsB.length;
};
const ordenado = pasos.slice().sort(antes);
const cambiadas = ordenado.filter((x, i) => x.idx !== i).length;
return ok({ plan, orden_actual: pasos.map(x => x.nombre), orden_sugerido: ordenado.map(x => x.nombre), pasos_reubicados: cambiadas, nota: "el orden sugerido pone primero los pasos que más dependencias de datos satisfacen; re-ensaya con dry_run tras aplicar" });`,
      },
      {
        name: "post_execution_check",
        desc: "Tras ejecutar: compara lo declarado en el ensayo con lo que realmente pasó (pasos saltados, efectos extra).",
        params: { plan: { t: "string", d: "Plan ejecutado" }, pasos_reales: { t: "array", d: "Nombres de pasos realmente ejecutados en orden" }, efectos_extra: { t: "array", d: "Efectos observados no declarados {paso, detalle}", opt: true } },
        code: `const st = store.load();
const p = (st.planes || {})[plan];
if (!p) return fail("plan no definido");
const declarados = p.pasos.map(x => x.nombre);
const reales = (pasos_reales || []).map(String);
const saltados = declarados.filter(n => !reales.includes(n));
const inventados = reales.filter(n => !declarados.includes(n));
const ordenDeclarado = declarados.map((n, i) => ({ n, i })).filter(x => reales.includes(x.n));
let ordenRoto = false;
let pos = -1;
ordenDeclarado.forEach(x => { const rp = reales.indexOf(x.n); if (rp < pos) ordenRoto = true; pos = Math.max(pos, rp); });
return ok({ plan, pasos_declarados: declarados.length, pasos_reales: reales.length, saltados, pasos_no_declarados: inventados, orden_respetado: !ordenRoto, efectos_no_declarados: efectos_extra || [], desviacion: saltados.length + inventados.length === 0 && !ordenRoto ? "ejecución fiel al ensayo" : "desviación detectada: registra por qué y actualiza el plan" });`,
      },
    ],
  },
  {
    id: "side-effect-ledger",
    title: "Side-Effect Ledger",
    tagline: "Libro mayor de efectos secundarios: cada cambio queda registrado con su receta de deshacer",
    category: "Pre-Vuelo",
    pain: "El agente hizo 14 cambios y solo recuerda 3: cuando hay que volver atrás no existe un registro de qué tocó ni cómo se deshace cada cosa. Los 'action logs' genéricos guardan qué pasó, no cómo revertirlo.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/side-effect-ledger/. Cada efecto guarda: target, tipo, cómo deshacer (comando/receta), si ya se deshizo y caducidad de la receta (algunos undos expiran).",
    tools: [
      {
        name: "register_effect",
        desc: "Registra un efecto secundario con su receta de reversión. Úsalo INMEDIATAMENTE después de cada acción con impacto.",
        params: { target: { t: "string", d: "Recurso afectado (archivo, registro, cuenta, estado)" }, tipo: { t: "enum", d: "Tipo de efecto", values: ["creado", "modificado", "eliminado", "estado_cambiado", "externo_enviado", "permiso_otorgado"] }, como_deshacer: { t: "string", d: "Receta concreta para revertir (comando, API, secuencia)" }, paso: { t: "string", d: "Paso/acción del agente que lo causó", opt: true }, caducidad_horas: { t: "number", d: "Horas tras las que la receta de deshacer deja de ser válida (0 = nunca)", opt: true, def: 0 }, dificultad: { t: "enum", d: "Dificultad de reversión", values: ["trivial", "media", "dificil", "imposible"], opt: true, def: "media" } },
        code: `const st = store.load();
st.efectos = st.efectos || [];
const id = "fx_" + String(st.efectos.length + 1).padStart(4, "0");
st.efectos.push({ id, target, tipo, como_deshacer, paso: paso || "", dificultad, caducidad_horas, creado: new Date().toISOString(), deshecho: false });
store.save(st);
return ok({ id, target, tipo, dificultad, registrado: true, abiertos: st.efectos.filter(e => !e.deshecho).length });`,
      },
      {
        name: "undo_info",
        desc: "Recupera la receta de deshacer para un target (o por id de efecto).",
        params: { target: { t: "string", d: "Recurso a revertir", opt: true }, id: { t: "string", d: "Id del efecto exacto", opt: true } },
        code: `const st = store.load();
const efectos = st.efectos || [];
let e = id ? efectos.find(x => x.id === id) : null;
if (!e && target) { const cands = efectos.filter(x => !x.deshecho && x.target.includes(target)); if (!cands.length) return fail("sin efectos abiertos para: " + target); e = cands[cands.length - 1]; }
if (!e) return fail("indica target o id");
if (e.deshecho) return ok({ id: e.id, aviso: "ya está deshecho", deshecho_en: e.deshecho_ts });
const vence = e.caducidad_horas > 0 ? new Date(new Date(e.creado).getTime() + e.caducidad_horas * 3600000).toISOString() : null;
const expirado = vence && new Date(vence).getTime() < Date.now();
return ok({ id: e.id, target: e.target, tipo: e.tipo, dificultad: e.dificultad, receta_deshacer: e.como_deshacer, creado: e.creado, vence_en: vence, receta_expirada: expirado, aviso: expirado ? "LA RECETA EXPIRÓ: revertir manualmente con conocimiento del dominio" : e.dificultad === "imposible" ? "IRREVERSIBLE declarado: solo queda compensación, no reversión" : "receta válida" });`,
      },
      {
        name: "mark_undone",
        desc: "Marca un efecto como deshecho (con nota de verificación).",
        params: { id: { t: "string", d: "Id del efecto (fx_0001)" }, verificado_por: { t: "string", d: "Cómo se verificó que quedó revertido", opt: true } },
        code: `const st = store.load();
const e = (st.efectos || []).find(x => x.id === id);
if (!e) return fail("efecto no encontrado: " + id);
if (e.deshecho) return fail("ya estaba deshecho desde " + e.deshecho_ts);
e.deshecho = true;
e.deshecho_ts = new Date().toISOString();
e.verificado_por = verificado_por || "no verificado";
store.save(st);
return ok({ id, target: e.target, deshecho: true, abiertos: st.efectos.filter(x => !x.deshecho).length });`,
      },
      {
        name: "list_open_effects",
        desc: "Todos los efectos sin deshacer, agrupados por dificultad y con los más urgentes primero.",
        params: { solo_tipo: { t: "string", d: "Filtrar por tipo", opt: true } },
        code: `const st = store.load();
let abiertos = (st.efectos || []).filter(e => !e.deshecho);
if (solo_tipo) abiertos = abiertos.filter(e => e.tipo === solo_tipo);
const orden = { imposible: 0, dificil: 1, media: 2, trivial: 3 };
const vencidos = abiertos.filter(e => e.caducidad_horas > 0 && new Date(new Date(e.creado).getTime() + e.caducidad_horas * 3600000).getTime() < Date.now());
return ok({ abiertos: abiertos.length, por_dificultad: { imposible: abiertos.filter(e => e.dificultad === "imposible").length, dificil: abiertos.filter(e => e.dificultad === "dificil").length, media: abiertos.filter(e => e.dificultad === "media").length, trivial: abiertos.filter(e => e.dificultad === "trivial").length }, recetas_expiradas: vencidos.length, efectos: abiertos.sort((a, b) => (orden[a.dificultad] ?? 2) - (orden[b.dificultad] ?? 2)).map(e => ({ id: e.id, target: e.target, tipo: e.tipo, dificultad: e.dificultad, creado: e.creado, paso: e.paso })) });`,
      },
      {
        name: "rollback_plan",
        desc: "Genera el plan de reversión total: deshacer todos los efectos abiertos en orden inverso (LIFO).",
        params: { desde_id: { t: "string", d: "Revertir desde este efecto (inclusive) hacia atrás", opt: true } },
        code: `const st = store.load();
const abiertos = (st.efectos || []).filter(e => !e.deshecho);
if (!abiertos.length) return ok({ pasos: 0, mensaje: "no hay efectos abiertos: nada que revertir" });
let secuencia = abiertos.slice().reverse();
if (desde_id) {
  const idx = secuencia.findIndex(e => e.id === desde_id);
  if (idx === -1) return fail("efecto no encontrado o ya deshecho: " + desde_id);
  secuencia = secuencia.slice(idx);
}
const pasos = secuencia.map((e, i) => ({ orden: i + 1, id: e.id, target: e.target, receta: e.como_deshacer, dificultad: e.dificultad, alerta: e.dificultad === "imposible" ? "IRREVERSIBLE: este paso no tiene reversión, evalúa compensación" : e.caducidad_horas > 0 ? "verifica que la receta no haya expirado" : null }));
return ok({ total_pasos: pasos.length, estrategia: "LIFO: deshacer en orden inverso a como se aplicaron", pasos, estimacion: pasos.filter(p => p.alerta).length + " pasos con alerta de " + pasos.length });`,
      },
    ],
  },
]

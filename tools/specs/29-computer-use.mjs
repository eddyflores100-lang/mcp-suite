// ═══ CATEGORÍA: Dolores FUTUROS · Computer Use ═══
// Evidencia: los agentes de computer/browser use fallan por cambios del DOM,
// selectores frágiles, acciones destructivas sin rollback y no verificación
// del estado visible. Fiabilidad de la automatización = el dolor central.
export default [
  {
    id: "dom-baseline",
    title: "DOM Baseline",
    tagline: "Baselines de páginas: snapshots estructurales y detección de qué cambió desde la última vez",
    category: "Computer Use",
    pain: "El agente de navegador memoriza la estructura de la página y esta cambia sin aviso: el flujo se rompe y el agente no sabe QUÉ cambió exactamente ni cuándo.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/dom-baseline/. Guarda snapshots estructurales (lista de selectores estables con hash de estructura) por página/flujo; el diff revela elementos añadidos/eliminados/movidos.",
    tools: [
      {
        name: "save_snapshot",
        desc: "Guarda un snapshot de la página: lista de elementos clave (selector, rol, texto visible) extraídos por el navegador.",
        params: { pagina: { t: "string", d: "Identificador de la página (url o nombre)" }, flujo: { t: "string", d: "Flujo al que pertenece", opt: true, def: "default" }, elementos: { t: "array", d: "Elementos {selector, texto, tipo} observados" } },
        code: `const st = store.load();
st.paginas = st.paginas || {};
const clave = flujo + "::" + pagina;
const elems = (elementos || []).map(e => ({ selector: String(e.selector || ""), texto: String(e.texto || "").slice(0, 80), tipo: String(e.tipo || "generico") })).filter(e => e.selector);
if (!elems.length) return fail("sin elementos observables: extrae {selector, texto, tipo} primero");
const hash = "" + elems.length + "-" + elems.map(e => e.selector).join("|").length;
st.paginas[clave] = { pagina, flujo, elementos: elems, hash, version: (st.paginas[clave]?.version || 0) + 1, ts: new Date().toISOString() };
store.save(st);
return ok({ pagina, version: st.paginas[clave].version, elementos: elems.length, hash });`,
      },
      {
        name: "diff_page",
        desc: "Compara la observación actual contra el baseline: elementos desaparecidos, nuevos y con texto cambiado.",
        params: { pagina: { t: "string", d: "Página a comparar" }, flujo: { t: "string", d: "Flujo", opt: true, def: "default" }, elementos_actuales: { t: "array", d: "Elementos {selector, texto, tipo} observados ahora" } },
        code: `const st = store.load();
const clave = flujo + "::" + pagina;
const base = (st.paginas || {})[clave];
if (!base) return fail("sin baseline para " + clave + ": grábalo con save_snapshot");
const actuales = (elementos_actuales || []).map(e => ({ selector: String(e.selector || ""), texto: String(e.texto || "").slice(0, 80) })).filter(e => e.selector);
const baseMap = new Map(base.elementos.map(e => [e.selector, e]));
const actMap = new Map(actuales.map(e => [e.selector, e]));
const desaparecidos = [...baseMap.keys()].filter(s => !actMap.has(s));
const nuevos = [...actMap.keys()].filter(s => !baseMap.has(s));
const cambiados = [...actMap.entries()].filter(([s, e]) => baseMap.has(s) && baseMap.get(s).texto !== e.texto).map(([s, e]) => ({ selector: s, antes: baseMap.get(s).texto, ahora: e.texto }));
const rotos_importantes = desaparecidos.filter(s => /button|btn|input|form|submit|login|checkout|cart|pay|pagar|comprar|cta|enviar/i.test(s));
return ok({
  estabilidad: Number((actMap.size / Math.max(baseMap.size, 1) * 100).toFixed(0)) + "%",
  desaparecidos, nuevos, texto_cambiado: cambiados,
  criticos_para_el_flujo: rotos_importantes,
  veredicto: rotos_importantes.length ? "ROTO: elementos críticos desaparecieron: el flujo fallará; re-graba baseline tras verificar manualmente" : desaparecidos.length === 0 ? "página estable desde el baseline" : "cambios menores: revisa si afectan selectores que usas",
});`,
      },
      {
        name: "get_baseline",
        desc: "Recupera el baseline actual de una página (selectores estables conocidos).",
        params: { pagina: { t: "string", d: "Página" }, flujo: { t: "string", d: "Flujo", opt: true, def: "default" } },
        code: `const st = store.load();
const b = (st.paginas || {})[flujo + "::" + pagina];
if (!b) return fail("sin baseline");
return ok({ pagina, flujo, version: b.version, grabado: b.ts, elementos: b.elementos });`,
      },
      {
        name: "stability_report",
        desc: "Reporte de estabilidad global: qué páginas cambian más (fragilidad del suite de automatización).",
        params: {},
        code: `const st = store.load();
const paginas = Object.values(st.paginas || {});
if (!paginas.length) return ok({ paginas: 0 });
const regrabs = paginas.map(p => ({ pagina: p.pagina, flujo: p.flujo, versiones: p.version, antiguedad_dias: Number(((Date.now() - new Date(p.ts)) / 86400000).toFixed(1)) })).sort((a, b) => b.versiones - a.versiones);
return ok({
  paginas_baselinadas: paginas.length,
  mas_volatiles: regrabs.slice(0, 5),
  mas_estables: regrabs.slice(-3),
  consejo: regrabs[0]?.versiones > 5 ? "una página exige >5 regrabs: pide selectores data-testid al equipo o fija otra estrategia de localización" : "volatilidad razonable",
});`,
      },
    ],
  },
  {
    id: "selector-healer",
    title: "Selector Healer",
    tagline: "Repara selectores rotos por similitud: encuentra el elemento renombrado sin reescribir el flujo",
    category: "Computer Use",
    pain: "Un botón cambió de id (#btn-submit → #submit-btn) y el flujo entero muere: el agente no tiene forma de mapear 'el botón de antes' al elemento nuevo sin rehacer todo.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/selector-healer/. Guarda selectores con metadatos (texto visible, posición ordinal, atributos); ante un fallo propone el candidato más similar del DOM actual con score.",
    tools: [
      {
        name: "register_selector",
        desc: "Registra un selector con metadatos ricos para poder curarlo después (texto, ordinal, atributos, página).",
        params: { nombre: { t: "string", d: "Nombre lógico (ej: boton_enviar)" }, selector: { t: "string", d: "Selector CSS/XPath actual" }, texto_visible: { t: "string", d: "Texto del elemento", opt: true }, pagina: { t: "string", d: "Página/flujo", opt: true, def: "default" }, atributos: { t: "any", d: "Atributos relevantes {id, class, name...}", opt: true } },
        code: `const st = store.load();
st.selectores = st.selectores || {};
st.selectores[nombre] = { nombre, selector, texto_visible: texto_visible || "", pagina, atributos: atributos || {}, curaciones: 0, creado: new Date().toISOString() };
store.save(st);
return ok({ selector: nombre, registrado: true });`,
      },
      {
        name: "heal",
        desc: "Dado un selector roto y los candidatos actuales del DOM, devuelve el mejor match con score de confianza.",
        params: { nombre: { t: "string", d: "Nombre lógico del selector roto" }, candidatos: { t: "array", d: "Candidatos actuales {selector, texto, atributos}" } },
        code: `const st = store.load();
const s = (st.selectores || {})[nombre];
if (!s) return fail("selector no registrado: " + nombre);
const cands = (candidatos || []).filter(c => c && c.selector);
if (!cands.length) return fail("sin candidatos: extrae los elementos del DOM actual primero");
const tokens = (x) => new Set(String(x || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2));
const scored = cands.map(c => {
  let score = 0;
  const selTokens = tokens(s.selector), candSel = tokens(c.selector);
  const overlapSel = [...selTokens].filter(w => candSel.has(w)).length;
  score += overlapSel / Math.max(selTokens.size, 1) * 40;
  if (s.texto_visible && c.texto) {
    const t1 = tokens(s.texto_visible), t2 = tokens(c.texto);
    score += [...t1].filter(w => t2.has(w)).length / Math.max(t1.size, 1) * 35;
  } else if (s.texto_visible && !c.texto) score -= 5;
  if (s.atributos && c.atributos) {
    const claves = Object.keys(s.atributos);
    if (claves.length) {
      const hits = claves.filter(k => c.atributos[k] && String(c.atributos[k]) === String(s.atributos[k])).length;
      score += hits / claves.length * 25;
    }
  }
  return { selector: c.selector, texto: (c.texto || "").slice(0, 40), score: Number(score.toFixed(1)) };
}).sort((a, b) => b.score - a.score);
const mejor = scored[0];
const confianza = mejor.score >= 65 ? "ALTA: aplica" : mejor.score >= 40 ? "MEDIA: aplica con verificación visual posterior" : "BAJA: intervención humana";
if (mejor.score >= 40 && mejor.selector !== s.selector) {
  s.historial = s.historial || [];
  s.historial.push({ desde: s.selector, hacia: mejor.selector, score: mejor.score, ts: new Date().toISOString() });
  s.selector = mejor.selector;
  s.curaciones = (s.curaciones || 0) + 1;
  store.save(st);
}
return ok({ roto: nombre, mejor_candidato: mejor, confianza, top3: scored.slice(0, 3), curaciones_totales: s.curaciones });`,
      },
      {
        name: "fragility_report",
        desc: "Qué selectores se rompen más y con qué patrón (ids dinámicos, clases hash, textos volátiles).",
        params: {},
        code: `const st = store.load();
const sels = Object.values(st.selectores || {});
if (!sels.length) return ok({ selectores: 0 });
const analisis = sels.map(s => {
  const patrones = [];
  if (/\\d{4,}|\\$\\{.*\\}|[a-f0-9]{8,}/i.test(s.selector)) patrones.push("id/clase dinámico");
  if (/nth-child|nth-of-type/.test(s.selector)) patrones.push("posición ordinal frágil");
  if (/\\/\\/ul\\/\\/li\\//.test(s.selector)) patrones.push("xpath profundo");
  if (s.texto_visible && s.texto_visible.length > 25) patrones.push("texto largo volátil");
  return { nombre: s.nombre, curaciones: s.curaciones || 0, patrones_riesgo: patrones, selector: s.selector.slice(0, 70) };
}).sort((a, b) => b.curaciones - a.curaciones);
return ok({
  selectores: sels.length,
  curaciones_totales: sels.reduce((a, s) => a + (s.curaciones || 0), 0),
  mas_fragiles: analisis.slice(0, 8),
  consejo: "prioriza data-testid > id estable > aria-label > texto corto > ordinal",
});`,
      },
      {
        name: "export_map",
        desc: "Exporta el mapa lógico→selector actual (para el orquestador de navegador).",
        params: {},
        code: `const st = store.load();
const sels = Object.values(st.selectores || {});
return ok({ total: sels.length, mapa: Object.fromEntries(sels.map(s => [s.nombre, { selector: s.selector, pagina: s.pagina, texto: s.texto_visible }])) });`,
      },
    ],
  },
  {
    id: "action-recorder",
    title: "Action Recorder",
    tagline: "Graba y reproduce secuencias de acciones con verificación de cada paso: flujos deterministas, no improvisados",
    category: "Computer Use",
    pain: "Cada corrida del agente de navegador improvisa el camino: hoy hace click en A→B→C, mañana prueba A→C. Sin grabación verificable, los fallos no se reproducen y nadie sabe qué hizo exactamente.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/action-recorder/. Flujos = lista de pasos {accion, objetivo, verificacion}; cada replay valida la verificación de cada paso y registra desviaciones.",
    tools: [
      {
        name: "create_flow",
        desc: "Crea un flujo grabado (nombre + descripción del objetivo de negocio).",
        params: { nombre: { t: "string", d: "Nombre del flujo" }, objetivo: { t: "string", d: "Qué logra el flujo" } },
        code: `const st = store.load();
st.flujos = st.flujos || {};
if (st.flujos[nombre]) return fail("flujo existente");
st.flujos[nombre] = { nombre, objetivo, pasos: [], replays: [], creado: new Date().toISOString() };
store.save(st);
return ok({ flujo: nombre, pasos: 0 });`,
      },
      {
        name: "record_step",
        desc: "Añade un paso al flujo: acción, objetivo (selector/coords) y verificación esperada tras el paso.",
        params: { flujo: { t: "string", d: "Nombre del flujo" }, accion: { t: "enum", d: "Tipo de acción", values: ["navegar", "click", "escribir", "seleccionar", "esperar", "extraer", "scroll", "descargar"] }, objetivo: { t: "string", d: "Sobre qué (url, selector, texto a escribir)" }, verificacion: { t: "string", d: "Qué debe ser cierto DESPUÉS del paso (observable)" } },
        code: `const st = store.load();
const f = (st.flujos || {})[flujo];
if (!f) return fail("flujo no encontrado");
if (!verificacion) return fail("un paso sin verificación no es reproducible: ¿qué debe verse después?");
f.pasos.push({ n: f.pasos.length + 1, accion, objetivo, verificacion });
store.save(st);
return ok({ flujo, paso: f.pasos.length, total: f.pasos.length });`,
      },
      {
        name: "replay_report",
        desc: "Registra el resultado de un replay: cada paso verificado, fallido o desviado; devuelve salud del flujo.",
        params: { flujo: { t: "string", d: "Nombre del flujo" }, resultados_pasos: { t: "array", d: "Resultado por paso: true/false/otro" } },
        code: `const st = store.load();
const f = (st.flujos || {})[flujo];
if (!f) return fail("flujo no encontrado");
const rs = resultados_pasos || [];
if (rs.length !== f.pasos.length) return fail("esperaba " + f.pasos.length + " resultados, recibí " + rs.length);
const norm = rs.map(r => r === true ? "ok" : r === false ? "fallo" : String(r || "desviado"));
const primerFallo = norm.findIndex(r => r !== "ok");
const okCount = norm.filter(r => r === "ok").length;
f.replays.push({ ok: okCount, total: norm.length, primer_fallo: primerFallo + 1 || null, norm, ts: new Date().toISOString() });
if (f.replays.length > 50) f.replays = f.replays.slice(-30);
store.save(st);
return ok({
  flujo,
  salud: Math.round(okCount / norm.length * 100) + "%",
  primer_fallo_en_paso: primerFallo >= 0 ? { n: primerFallo + 1, accion: f.pasos[primerFallo].accion, objetivo: f.pasos[primerFallo].objetivo, verificacion: f.pasos[primerFallo].verificacion } : null,
  veredicto: okCount === norm.length ? "replay limpio" : primerFallo === 0 ? "falla al arranque: entorno o url cambiados" : "falla a mitad: revisa el paso " + (primerFallo + 1) + " y su verificación",
});`,
      },
      {
        name: "flow_health",
        desc: "Salud histórica del flujo: tasa de éxito por replay y paso más frágil acumulado.",
        params: { flujo: { t: "string", d: "Nombre del flujo" } },
        code: `const st = store.load();
const f = (st.flujos || {})[flujo];
if (!f) return fail("flujo no encontrado");
const replays = f.replays || [];
if (!replays.length) return ok({ flujo, replays: 0 });
const exitoTotal = replays.filter(r => r.ok === r.total).length;
const fragilidad = new Array(f.pasos.length).fill(0);
for (const r of replays) r.norm.forEach((v, i) => { if (v !== "ok") fragilidad[i]++; });
const masFragil = fragilidad.indexOf(Math.max(...fragilidad));
return ok({
  flujo, replays: replays.length,
  exito_completo_pct: Math.round(exitoTotal / replays.length * 100),
  paso_mas_fragil: { n: masFragil + 1, accion: f.pasos[masFragil]?.accion, fallos: fragilidad[masFragil] },
  fallos_por_paso: f.pasos.map((p, i) => ({ n: i + 1, accion: p.accion, fallos: fragilidad[i] })).filter(x => x.fallos > 0),
});`,
      },
      {
        name: "list_flows",
        desc: "Lista los flujos grabados con su salud agregada.",
        params: {},
        code: `const st = store.load();
const flujos = Object.values(st.flujos || {});
if (!flujos.length) return ok({ flujos: 0 });
return ok({ flujos: flujos.map(f => ({ nombre: f.nombre, objetivo: f.objetivo.slice(0, 60), pasos: f.pasos.length, replays: (f.replays || []).length, exito_pct: f.replays?.length ? Math.round(f.replays.filter(r => r.ok === r.total).length / f.replays.length * 100) : null })) });`,
      },
    ],
  },
  {
    id: "checkpoint-undo",
    title: "Checkpoint Undo",
    tagline: "Checkpoints antes de acciones destructivas + rollback: el botón de 'deshacer' para agentes",
    category: "Computer Use",
    pain: "El agente borra una fila, envía un email o confirma un pago por error y no hay Ctrl+Z: el daño es irreversible porque ninguna acción destructiva fue precedida de checkpoint.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/checkpoint-undo/. Checkpoints de estado antes de acciones riesgosas con nivel de destructividad; gateo pre-acción y plan de rollback estructurado.",
    tools: [
      {
        name: "gate_action",
        desc: "Evalúa una acción ANTES de ejecutarla: nivel de riesgo y si exige checkpoint o confirmación humana.",
        params: { accion: { t: "string", d: "Acción contemplada" }, contexto: { t: "string", d: "Dónde/sobre qué", opt: true } },
        code: `const CRITICAS = /(borrar|eliminar|delete|drop|enviar|submit|confirmar|pagar|payment|comprar|deploy|publicar|merge|sobrescribir|overwrite|reset|cerrar cuenta|cancelar)/i;
const MODERADAS = /(escribir|editar|update|modificar|crear|nuevo|subir|upload|mover|mover|renombrar)/i;
const texto = accion + " " + (contexto || "");
let nivel, requisito;
if (CRITICAS.test(texto)) { nivel = "destructivo"; requisito = "checkpoint OBLIGATORIO + confirmación si toca datos de otros"; }
else if (MODERADAS.test(texto)) { nivel = "modificado"; requisito = "checkpoint recomendado (barato de tomar)"; }
else { nivel = "lectura"; requisito = "sin checkpoint"; }
return ok({ accion: accion.slice(0, 80), nivel, requisito, procede: nivel === "lectura" ? true : false, aviso: nivel === "destructivo" ? "NO ejecutes sin checkpoint previo (save_checkpoint) y plan de rollback" : null });`,
      },
      {
        name: "save_checkpoint",
        desc: "Graba un checkpoint de estado pre-acción: qué se va a tocar, estado previo y cómo deshacerlo.",
        params: { etiqueta: { t: "string", d: "Etiqueta del checkpoint" }, accion_planned: { t: "string", d: "Acción destructiva que sigue" }, estado_previo: { t: "any", d: "Estado serializable ANTES de actuar (valores, texto, flags)" }, plan_rollback: { t: "string", d: "Cómo restaurar el estado_previo manualmente" } },
        code: `const st = store.load();
st.checkpoints = st.checkpoints || [];
if (!plan_rollback) return fail("sin plan de rollback el checkpoint no sirve: ¿cómo se restaura el estado?");
const cp = { n: st.checkpoints.length + 1, etiqueta, accion: accion_planned, estado_previo, plan_rollback, ts: new Date().toISOString(), restaurado: false };
st.checkpoints.push(cp);
if (st.checkpoints.length > 200) st.checkpoints = st.checkpoints.slice(-150);
store.save(st);
return ok({ checkpoint: cp.n, etiqueta, creado: true, ahora_puedes: "ejecuta la acción; si sale mal: restore(" + cp.n + ")" });`,
      },
      {
        name: "restore",
        desc: "Marca un checkpoint como restaurado y devuelve el estado previo + plan de rollback a ejecutar.",
        params: { n: { t: "number", d: "Número del checkpoint" }, motivo: { t: "string", d: "Por qué se revierte", opt: true } },
        code: `const st = store.load();
const cp = (st.checkpoints || []).find(x => x.n === n);
if (!cp) return fail("checkpoint inexistente");
cp.restaurado = true;
cp.restaurado_ts = new Date().toISOString();
cp.motivo = motivo || null;
store.save(st);
return ok({ checkpoint: cp.n, etiqueta: cp.etiqueta, estado_previo: cp.estado_previo, plan_rollback: cp.plan_rollback, pasos: [ "1. detén la acción en curso", "2. aplica el plan_rollback literal", "3. verifica contra estado_previo", "4. registra el fallo (failure-tagger) antes de reintentar" ] });`,
      },
      {
        name: "undo_stack",
        desc: "Pila de checkpoints recientes (los no restaurados primero): el historial de puntos de retorno.",
        params: {},
        code: `const st = store.load();
const cps = st.checkpoints || [];
if (!cps.length) return ok({ checkpoints: 0 });
const vivos = cps.filter(c => !c.restaurado).slice(-10).reverse();
return ok({
  checkpoints: cps.length,
  restaurados: cps.length - vivos.length,
  puntos_de_retorno_vivos: vivos.map(c => ({ n: c.n, etiqueta: c.etiqueta, accion: c.accion.slice(0, 60), ts: c.ts })),
  ultimo_restaurado: [...cps].reverse().find(c => c.restaurado)?.etiqueta || null,
});`,
      },
      {
        name: "risk_stats",
        desc: "Estadísticas de riesgo: acciones destructivas emprendidas, rollbacks necesarios y tasa de arrepentimiento.",
        params: {},
        code: `const st = store.load();
const cps = st.checkpoints || [];
if (!cps.length) return ok({ checkpoints: 0, sugerencia: "toma checkpoints antes de acciones destructivas" });
const restaurados = cps.filter(c => c.restaurado);
return ok({
  checkpoints_totales: cps.length,
  acciones_destructivas_cubiertas: cps.length,
  rollbacks_ejecutados: restaurados.length,
  tasa_arrepentimiento: Number((restaurados.length / cps.length).toFixed(2)),
  veredicto: restaurados.length / cps.length > 0.4 ? "40%+ de acciones destructivas se revierten: el agente es demasiado agresivo, endurece gate_action" : "tasa de reversión razonable",
});`,
      },
    ],
  },
  {
    id: "viewport-verifier",
    title: "Viewport Verifier",
    tagline: "Verifica el estado visible esperado tras cada acción: el navegador dice lo que realmente se ve",
    category: "Computer Use",
    pain: "El agente asume que su acción funcionó porque no hubo error: pero el toast se cerró, el modal tapaba el botón, o el spinner seguía girando. Sin verificar el estado visible, el flujo 'avanza' roto.",
    persistent: false,
    notes: "Sin persistencia. Expectativas declaradas (qué debe ser visible/ausente/contenido) y verificación contra la observación del viewport con explicación de discrepancias.",
    tools: [
      {
        name: "declare_expectation",
        desc: "Declara la expectativa de estado visible tras una acción (para verificarla inmediatamente).",
        params: { tras_accion: { t: "string", d: "Acción realizada" }, debe_aparecer: { t: "array", d: "Elementos/textos que deben ser visibles", opt: true, def: [] }, debe_desaparecer: { t: "array", d: "Lo que ya no debe verse", opt: true, def: [] }, debe_contener_texto: { t: "string", d: "Texto que debe existir en la página", opt: true } },
        code: `const exp = { tras_accion, debe_aparecer: debe_aparecer || [], debe_desaparecer: debe_desaparecer || [], debe_contener_texto: debe_contener_texto || null };
if (!exp.debe_aparecer.length && !exp.debe_desaparecer.length && !exp.debe_contener_texto) return fail("expectativa vacía: declara al menos una condición observable");
return ok({ expectativa: exp, siguiente: "observa el viewport y verifica con verify_viewport" });`,
      },
      {
        name: "verify_viewport",
        desc: "Verifica la expectativa contra lo observado (texto visible y elementos detectados) y explica discrepancias.",
        params: { expectativa: { t: "any", d: "Expectativa declarada (objeto de declare_expectation)" }, texto_visible: { t: "string", d: "Texto visible actual del viewport" }, elementos_detectados: { t: "array", d: "Selectores/textos de elementos visibles", opt: true, def: [] } },
        code: `if (!expectativa || typeof expectativa !== "object") return fail("expectativa inválida");
const vis = String(texto_visible || "");
const elems = (elementos_detectados || []).map(String);
const visiblesTodos = elems.concat([vis]);
const fallos = [];
const okList = [];
for (const esp of expectativa.debe_aparecer || []) {
  const hit = visiblesTodos.some(v => v && v.toLowerCase().includes(String(esp).toLowerCase()));
  (hit ? okList : fallos).push({ esperaba_ver: esp, tipo: "aparecer" });
}
for (const esp of expectativa.debe_desaparecer || []) {
  const hit = visiblesTodos.some(v => v && v.toLowerCase().includes(String(esp).toLowerCase()));
  (hit ? fallos : okList).push({ esperaba_ver: esp, tipo: "desaparecer", problema: "SIGUE PRESENTE" });
}
if (expectativa.debe_contener_texto && !vis.toLowerCase().includes(String(expectativa.debe_contener_texto).toLowerCase())) fallos.push({ esperaba_ver: expectativa.debe_contener_texto, tipo: "texto", problema: "texto no encontrado en viewport" });
const verdicto = fallos.length === 0 ? "CONFIRMADO: la acción produjo el estado esperado" : fallos.length <= 2 ? "PARCIAL: condiciones sin cumplir, posible lentitud/animación: re-verifica tras esperar" : "FALLIDO: la acción NO produjo el efecto: NO continúes el flujo";
return ok({
  accion: expectativa.tras_accion,
  confirmadas: okList.length,
  fallidas: fallos.length,
  fallos,
  veredicto: verdicto,
  siguiente_paso: fallos.length === 0 ? "continúa el flujo" : "espera 1-2s y re-verifica; si persiste: checkpoint-undo y diagnostica (dom-baseline diff)",
});`,
      },
      {
        name: "assert_page_ready",
        desc: "Comprueba señales de página lista vs página ocupada (spinners, overlays, disabled) contra el texto/estado actual.",
        params: { texto_o_estado: { t: "string", d: "Texto visible o snapshot de atributos del viewport" } },
        code: `const t = String(texto_o_estado || "");
const OCUPADO = /(cargando|loading|spinner|procesando|por favor espere|sincronizando|guardando...)/i;
const BLOQUEADO = /(deshabilitado|disabled|no disponible|intenta de nuevo más tarde|error 5\\d\\d|algo salió mal)/i;
const LISTO = /(listo|completado|guardado|enviado|correcto|success|resultado)/i;
const señales = { ocupado: OCUPADO.test(t), bloqueado: BLOQUEADO.test(t), listo: LISTO.test(t) };
let estado;
if (señales.bloqueado) estado = "BLOQUEADO: hay error visible: captura y aborta";
else if (señales.ocupado && !señales.listo) estado = "OCUPADO: espera 1-3s y vuelve a comprobar";
else if (señales.listo) estado = "LISTO: puedes interactuar";
else estado = "INDETERMINADO: sin señales claras: verifica elementos clave a mano";
return ok({ señales, estado, regla: "jamás interactúes con una página en estado OCUPADO o BLOQUEADO" });`,
      },
      {
        name: "observed_report",
        desc: "Compara lo que el agente CREE que pasó vs lo observado: convierte suposiciones en evidencia.",
        params: { suposicion: { t: "string", d: "Lo que el agente cree que logró" }, observado: { t: "string", d: "Lo que realmente se ve en pantalla" } },
        code: `const tokens = (s) => new Set(String(s).toLowerCase().split(/\\W+/).filter(w => w.length > 3));
const a = tokens(suposicion), b = tokens(observado);
const inter = [...a].filter(w => b.has(w)).length;
const union = new Set([...a, ...b]).size || 1;
const jaccard = inter / union;
return ok({
  coincidencia: Number(jaccard.toFixed(2)),
  tokens_suposicion_sostenidos: [...a].filter(w => b.has(w)),
  tokens_suposicion_sin_evidencia: [...a].filter(w => !b.has(w)),
  veredicto: jaccard >= 0.5 ? "la suposición está sostenida por lo observable" : jaccard >= 0.25 ? "parcialmente sostenida: confirmando con verify_viewport" : "SIN EVIDENCIA: lo que crees NO se ve en pantalla: no declares éxito",
});`,
      },
    ],
  },
];

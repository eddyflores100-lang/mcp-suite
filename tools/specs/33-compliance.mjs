// ═══ CATEGORÍA: Dolores FUTUROS · Cumplimiento (Compliance) ═══
// Evidencia: "Compliance layer for AI agents in regulated industries" —
// servidores MCP de cumplimiento emergiendo JUSTO ahora (2026) como gap
// detectado en la investigación de ecosistema. Ninguno local ni transversal.
export default [
  {
    id: "policy-as-code",
    title: "Policy As Code",
    tagline: "Políticas ejecutables para agentes regulados: cada acción se valida contra reglas, no contra intuición",
    category: "Cumplimiento",
    pain: "En industrias reguladas la política vive en PDFs que el agente nunca lee: cada acción es un riesgo de incumplimiento porque las reglas no son ejecutables por la máquina.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/policy-as-code/. Reglas condición→permitir/negar/requerir_aprobación sobre acciones con atributos; evaluación determinista con auditoría de cada decisión y reglas en conflicto.",
    tools: [
      {
        name: "add_policy",
        desc: "Añade una política ejecutable: condición sobre atributos de la acción y veredicto.",
        params: { nombre: { t: "string", d: "Nombre de la política" }, descripcion: { t: "string", d: "Qué controla" }, condicion: { t: "string", d: "Condición sobre atributos (ej: 'datos=pii y destino=externo')" }, veredicto: { t: "enum", d: "Resultado si aplica", values: ["permitir", "negar", "requerir_aprobacion", "registrar"] }, marco: { t: "string", d: "Marco de referencia (HIPAA, GDPR, SOX, interno)", opt: true, def: "interno" } },
        code: `const st = store.load();
st.politicas = st.politicas || [];
if (st.politicas.some(p => p.nombre === nombre)) return fail("política existente");
st.politicas.push({ nombre, descripcion, condicion, veredicto, marco, disparos: 0, ts: new Date().toISOString() });
store.save(st);
return ok({ politica: nombre, veredicto, marco });`,
      },
      {
        name: "evaluate_action",
        desc: "Evalúa una acción contra todas las políticas: veredicto final (más restrictivo gana) con trazas.",
        params: { accion: { t: "string", d: "Acción contemplada" }, atributos: { t: "any", d: "Atributos {datos, destino, volumen, usuario...}" } },
        code: `const st = store.load();
const politicas = st.politicas || [];
if (!politicas.length) return fail("sin políticas: añade con add_policy");
const atr = atributos || {};
const texto = (accion + " " + JSON.stringify(atr)).toLowerCase();
function aplica(cond) {
  const c = String(cond).toLowerCase();
  if (c.includes(" y ")) return c.split(" y ").every(clausula => clausulaSimple(clausula));
  if (c.includes(" o ")) return c.split(" o ").some(clausula => clausulaSimple(clausula));
  return clausulaSimple(c);
  function clausulaSimple(cl) {
    const m = cl.match(/^(\\w+)\\s*=\\s*(\\w+)$/);
    if (m) return String(atr[m[1]] ?? "").toLowerCase() === m[2];
    return texto.includes(cl.trim());
  }
}
const trazas = [];
let veredicto = "permitir";
const ORDEN = { permitir: 0, registrar: 1, requerir_aprobacion: 2, negar: 3 };
for (const p of politicas) {
  if (!aplica(p.condicion)) continue;
  p.disparos++;
  trazas.push({ politica: p.nombre, marco: p.marco, veredicto: p.veredicto });
  if (ORDEN[p.veredicto] > ORDEN[veredicto]) veredicto = p.veredicto;
}
st.auditoria = st.auditoria || [];
st.auditoria.push({ accion, atributos: atr, veredicto, trazas, ts: new Date().toISOString() });
if (st.auditoria.length > 300) st.auditoria = st.auditoria.slice(-200);
store.save(st);
return ok({
  accion: accion.slice(0, 80),
  veredicto,
  politicas_disparadas: trazas,
  significado: { permitir: "puedes ejecutar", registrar: "ejecuta y registra evidencia", requerir_aprobacion: "PAUSA: pide aprobación humana documentada", negar: "PROHIBIDO: no ejecutes ni intentes workaround" }[veredicto],
});`,
      },
      {
        name: "conflict_scan",
        desc: "Detecta políticas que pueden disparar veredictos contradictorios para la misma acción.",
        params: {},
        code: `const st = store.load();
const ps = st.politicas || [];
if (ps.length < 2) return ok({ politicas: ps.length });
const conflictos = [];
for (let i = 0; i < ps.length; i++) {
  for (let j = i + 1; j < ps.length; j++) {
    const tokensA = new Set(String(ps[i].condicion).toLowerCase().split(/\\s+/));
    const tokensB = new Set(String(ps[j].condicion).toLowerCase().split(/\\s+/));
    const overlap = [...tokensA].filter(w => tokensB.has(w) && w.length > 2).length;
    if (overlap >= 1 && ps[i].veredicto !== ps[j].veredicto && (ps[i].veredicto === "negar" || ps[j].veredicto === "negar")) {
      conflictos.push({ a: ps[i].nombre, b: ps[j].nombre, veredictos: ps[i].veredicto + " vs " + ps[j].veredicto, solucion: "especifica qué política prevalece (añade condición más estrecha)" });
    }
  }
}
return ok({ politicas: ps.length, conflictos_potenciales: conflictos.length, detalle: conflictos.slice(0, 6) });`,
      },
      {
        name: "compliance_log",
        desc: "Registro de auditoría de decisiones de política: qué se evaluó, cuándo y con qué veredicto.",
        params: { solo_bloqueos: { t: "boolean", d: "Solo negadas/requiere aprobación", opt: true, def: false } },
        code: `const st = store.load();
let log = st.auditoria || [];
if (solo_bloqueos) log = log.filter(a => a.veredicto === "negar" || a.veredicto === "requerir_aprobacion");
return ok({
  evaluaciones: log.length,
  por_veredicto: log.reduce((acc, a) => { acc[a.veredicto] = (acc[a.veredicto] || 0) + 1; return acc; }, {}),
  ultimas: log.slice(-10).reverse().map(a => ({ ts: a.ts, accion: a.accion.slice(0, 70), veredicto: a.veredicto, politicas: a.trazas.map(t => t.politica) })),
});`,
      },
    ],
  },
  {
    id: "data-residency-check",
    title: "Data Residency Check",
    tagline: "Verifica a dónde van los datos: restricciones de residencia geográfica y transferencias válidas",
    category: "Cumplimiento",
    pain: "El agente envía datos a APIs sin saber en qué país procesan: viola requisitos de residencia de datos (GDPR, soberanía) sin enterarse hasta la auditoría.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/data-residency-check/. Catálogo de destinos con jurisdicción/region; valida transferencias contra restricciones del dato (solo-UE, solo-local, no-China...) y genera mapa de flujos.",
    tools: [
      {
        name: "register_destination",
        desc: "Registra un destino de datos (API/servicio) con su jurisdicción y regiones de procesamiento.",
        params: { destino: { t: "string", d: "Nombre del servicio/API" }, jurisdiccion: { t: "string", d: "País/jurisdicción principal (US, EU, CN, LOCAL...)" }, regiones: { t: "array", d: "Regiones donde procesa datos", opt: true, def: [] }, nota: { t: "string", d: "Detalles del procesamiento", opt: true } },
        code: `const st = store.load();
st.destinos = st.destinos || {};
st.destinos[destino] = { destino, jurisdiccion, regiones: regiones || [], nota: nota || null, registrado: new Date().toISOString() };
store.save(st);
return ok({ destino, jurisdiccion, regiones: (regiones || []).length });`,
      },
      {
        name: "check_transfer",
        desc: "Valida enviar un dato a un destino según su restricción de residencia.",
        params: { dato: { t: "string", d: "Tipo de dato (pii_ec, salud, financiero, anonimizado...)" }, restriccion: { t: "enum", d: "Restricción del dato", values: ["sin_restriccion", "solo_local", "solo_ue", "no_cn", "no_us"] }, destino: { t: "string", d: "Destino registrado" } },
        code: `const st = store.load();
const d = (st.destinos || {})[destino];
if (!d) return fail("destino no registrado: usa register_destination");
const j = d.jurisdiccion.toUpperCase();
const REGIONES = (d.regiones || []).join(",").toUpperCase();
let permitido = true, razon;
switch (restriccion) {
  case "solo_local": permitido = j === "LOCAL" || j === "ONPREM"; razon = permitido ? "procesamiento local" : "el dato exige procesamiento local y el destino es " + j; break;
  case "solo_ue": permitido = ["EU", "UE", "DE", "FR", "ES", "IE", "NL"].includes(j) || REGIONES.includes("EU"); razon = permitido ? "dentro del espacio UE" : "dato con residencia UE enviado a " + j; break;
  case "no_cn": permitido = !["CN", "CHINA"].includes(j) && !REGIONES.includes("CN"); razon = permitido ? "sin procesamiento en China" : "transferencia a China prohibida para este dato"; break;
  case "no_us": permitido = !["US", "USA", "ESTADOS UNIDOS"].includes(j) && !REGIONES.includes("US"); razon = permitido ? "sin procesamiento en US" : "transferencia a US prohibida (Schrems) para este dato"; break;
  default: razon = "sin restricción de residencia";
}
st.transferencias = st.transferencias || [];
st.transferencias.push({ dato, restriccion, destino, permitido, ts: new Date().toISOString() });
store.save(st);
return ok({ dato, destino: { jurisdiccion: d.jurisdiccion, regiones: d.regiones }, permitido, razon, accion: permitido ? "puedes enviar" : "NO envíes: busca destino alternativo o anonimiza antes (data-anonymizer)" });`,
      },
      {
        name: "flow_map",
        desc: "Mapa de flujos de datos: qué tipo de datos va a qué destinos y con qué estado de cumplimiento.",
        params: {},
        code: `const st = store.load();
const trans = st.transferencias || [];
if (!trans.length) return ok({ transferencias: 0, sugerencia: "valida transferencias con check_transfer" });
const porDato = {};
for (const t of trans) {
  porDato[t.dato] = porDato[t.dato] || { total: 0, permitidas: 0 };
  porDato[t.dato].total++;
  if (t.permitido) porDato[t.dato].permitidas++;
}
return ok({
  destinos_registrados: Object.keys(st.destinos || {}).length,
  transferencias_evaluadas: trans.length,
  violaciones: trans.filter(t => !t.permitido).length,
  por_tipo_de_dato: Object.entries(porDato).map(([k, v]) => ({ dato: k, transferencias: v.total, permitidas: v.permitidas })),
  violaciones_detalle: trans.filter(t => !t.permitido).slice(-5).map(t => ({ dato: t.dato, destino: t.destino, restriccion: t.restriccion })),
});`,
      },
    ],
  },
  {
    id: "consent-ledger",
    title: "Consent Ledger",
    tagline: "Libro mayor de consentimientos con propósito: cada uso de datos personales amparado por un consentimiento vivo",
    category: "Cumplimiento",
    pain: "El agente usa datos personales sin saber si el titular consintió ese uso: no hay ledger de consentimientos con propósito, vigencia y alcance, así que el 'sí dijo que sí' es imaginario.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/consent-ledger/. Consentimientos {titular, propósitos, vigencia, estado}; cada uso de datos verifica propósito + vigencia, y todo queda auditado.",
    tools: [
      {
        name: "record_consent",
        desc: "Registra un consentimiento: titular, propósitos autorizados, vigencia y base legal.",
        params: { titular: { t: "string", d: "Identificador del titular (anonimizado)" }, propositos: { t: "array", d: "Propósitos autorizados (analitica, soporte, marketing...)" }, vigencia_meses: { t: "number", d: "Vigencia del consentimiento", opt: true, def: 12 }, base_legal: { t: "string", d: "Base legal (consentimiento, contrato...)", opt: true, def: "consentimiento" } },
        code: `const st = store.load();
st.consentimientos = st.consentimientos || [];
const c = {
  id: "cs_" + Date.now().toString(36),
  titular, propositos: (propositos || []).map(String), base_legal,
  vigente_hasta: new Date(Date.now() + (vigencia_meses ?? 12) * 2592000000).toISOString(),
  revocado: null, creado: new Date().toISOString(),
};
st.consentimientos.push(c);
store.save(st);
return ok({ consentimiento_id: c.id, titular, propositos: c.propositos.length, vigente_hasta: c.vigente_hasta.slice(0, 10) });`,
      },
      {
        name: "verify_use",
        desc: "Verifica que un uso de datos concreto está amparado: titular + propósito dentro de la vigencia.",
        params: { titular: { t: "string", d: "Titular de los datos" }, proposito: { t: "string", d: "Propósito del uso previsto" } },
        code: `const st = store.load();
const cs = (st.consentimientos || []).filter(c => c.titular === titular);
if (!cs.length) return ok({ amparado: false, razon: "sin consentimiento registrado para este titular", accion: "NO uses los datos: solicita consentimiento o anonimiza" });
const ahora = Date.now();
const activos = cs.filter(c => !c.revocado && new Date(c.vigente_hasta).getTime() > ahora);
if (!activos.length) return ok({ amparado: false, razon: "consentimientos vencidos o revocados", accion: "NO uses los datos" });
const conProposito = activos.find(c => c.propositos.some(p => p.toLowerCase() === String(proposito).toLowerCase()));
if (!conProposito) return ok({
  amparado: false,
  razon: "consentimiento activo pero SIN el propósito '" + proposito + "' (autorizados: " + activos[0].propositos.join(", ") + ")",
  accion: "NO amplíes propósito sin nuevo consentimiento (purpose limitation)",
});
st.usos = st.usos || [];
st.usos.push({ titular, proposito, consentimiento: conProposito.id, amparado: true, ts: new Date().toISOString() });
store.save(st);
return ok({ amparado: true, consentimiento: conProposito.id, vigente_hasta: conProposito.vigente_hasta.slice(0, 10), nota: "uso legítimo registrado en auditoría" });`,
      },
      {
        name: "revoke",
        desc: "Revoca el consentimiento de un titular (total o de un propósito concreto).",
        params: { titular: { t: "string", d: "Titular" }, proposito: { t: "string", d: "Solo revocar este propósito (vacío = todo)", opt: true } },
        code: `const st = store.load();
const cs = (st.consentimientos || []).filter(c => c.titular === titular);
if (!cs.length) return fail("sin consentimientos para este titular");
let afectados = 0;
for (const c of cs) {
  if (!proposito) { c.revocado = { total: true, ts: new Date().toISOString() }; afectados++; }
  else {
    c.revocado = c.revocado || { propositos: [] };
    c.revocado.propositos = [...new Set([...(c.revocado.propositos || []), proposito])];
    c.propositos = c.propositos.filter(p => p !== proposito);
    afectados++;
  }
}
store.save(st);
return ok({ titular, revocado: true, afectados, obligacion: "todo uso posterior de este dato en el alcance revocado queda PROHIBIDO desde ya" });`,
      },
      {
        name: "consent_audit",
        desc: "Auditoría de usos: cada uso de datos con su consentimiento amparador y usos fuera de amparo.",
        params: {},
        code: `const st = store.load();
const usos = st.usos || [];
const cs = st.consentimientos || [];
const revocados = cs.filter(c => c.revocado).length;
return ok({
  consentimientos: cs.length, revocados,
  usos_registrados: usos.length,
  usos_amparados: usos.filter(u => u.amparado).length,
  titulares_cubiertos: new Set(cs.map(c => c.titular)).size,
  vencen_en_30_dias: cs.filter(c => !c.revocado && new Date(c.vigente_hasta) - Date.now() < 30 * 86400000).map(c => ({ titular: c.titular, hasta: c.vigente_hasta.slice(0, 10) })),
  accion: "contacta a los titulares con consentimiento por vencer si el uso sigue siendo necesario",
});`,
      },
    ],
  },
  {
    id: "compliance-report",
    title: "Compliance Report",
    tagline: "Reportes de cumplimiento por marco (HIPAA/GDPR/SOX-like): evidencia estructurada para el auditor",
    category: "Cumplimiento",
    pain: "Cuando llega la auditoría no hay nada que entregar: los controles existieron 'en teoría' pero no hay evidencia estructurada de qué control aplicó cuándo y con qué resultado.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/compliance-report/. Controles por marco con estado (implementado/parcial/faltante) y evidencia ligada; genera reporte ejecutable por marco.",
    tools: [
      {
        name: "define_control",
        desc: "Define un control de cumplimiento para un marco: qué exige y cómo se satisface.",
        params: { marco: { t: "enum", d: "Marco de referencia", values: ["gdpr", "hipaa", "sox", "iso27001", "interno"] }, control_id: { t: "string", d: "Identificador del control (ej: Art.32)" }, exige: { t: "string", d: "Qué exige el control" }, como_se_cumple: { t: "string", d: "Cómo lo cubre el agente/sistema" } },
        code: `const st = store.load();
st.controles = st.controles || [];
if (st.controles.some(c => c.marco === marco && c.control_id === control_id)) return fail("control ya definido en " + marco);
st.controles.push({ marco, control_id, exige, como_se_cumple, estado: "declarado", evidencias: [], ts: new Date().toISOString() });
store.save(st);
return ok({ marco, control: control_id, estado: "declarado" });`,
      },
      {
        name: "attach_evidence",
        desc: "Adjunta evidencia a un control (prueba de que se aplicó) y actualiza su estado.",
        params: { marco: { t: "string", d: "Marco" }, control_id: { t: "string", d: "Control" }, evidencia: { t: "string", d: "Evidencia (log, artefacto, test)" }, estado: { t: "enum", d: "Estado resultante", values: ["implementado", "parcial", "faltante"], opt: true, def: "implementado" } },
        code: `const st = store.load();
const c = (st.controles || []).find(x => x.marco === marco && x.control_id === control_id);
if (!c) return fail("control no definido: usa define_control primero");
c.evidencias.push({ evidencia, ts: new Date().toISOString() });
c.estado = estado;
store.save(st);
return ok({ marco, control: control_id, evidencias: c.evidencias.length, estado: c.estado });`,
      },
      {
        name: "generate_report",
        desc: "Genera el reporte de cumplimiento de un marco: cobertura, controles sin evidencia y brechas.",
        params: { marco: { t: "string", d: "Marco a reportar (o 'todos')" } },
        code: `const st = store.load();
let cs = st.controles || [];
if (marco !== "todos") cs = cs.filter(c => c.marco === marco);
if (!cs.length) return fail("sin controles definidos para " + marco);
const implementados = cs.filter(c => c.estado === "implementado" && c.evidencias.length > 0);
const sinEvidencia = cs.filter(c => c.estado !== "implementado" || c.evidencias.length === 0);
return ok({
  marco: marco === "todos" ? "todos" : marco,
  controles: cs.length,
  cobertura_pct: Math.round(implementados.length / cs.length * 100),
  implementados_con_evidencia: implementados.length,
  brechas: sinEvidencia.map(c => ({ control: c.control_id, exige: c.exige.slice(0, 80), estado: c.estado, evidencias: c.evidencias.length })),
  veredicto: sinEvidencia.length === 0 ? "listo para auditoría: todos los controles con evidencia" : "NO entregues esto a un auditor: " + sinEvidencia.length + " controles sin evidencia real",
  nota: "la evidencia debe generarse DURANTE la operación (logs, decisiones de policy-as-code), no fabricarse después",
});`,
      },
      {
        name: "gap_plan",
        desc: "Plan de cierre de brechas: qué controlar primero según criticidad del control.",
        params: { marco: { t: "string", d: "Marco", opt: true, def: "todos" } },
        code: `const st = store.load();
let cs = st.controles || [];
if (marco !== "todos") cs = cs.filter(c => c.marco === marco);
const brechas = cs.filter(c => c.estado !== "implementado" || c.evidencias.length === 0);
if (!brechas.length) return ok({ brechas: 0, mensaje: "sin brechas: cobertura completa" });
const CRITICO = /(32|seguridad|seguridad|encript|cifrad|acceso|consentimiento|brecha|notificación|notificacion)/i;
const priorizadas = brechas.map(b => ({
  marco: b.marco, control: b.control_id, exige: b.exige.slice(0, 70),
  criticidad: CRITICO.test(b.control_id + " " + b.exige) ? "alta" : "media",
  accion: "implementa el control Y su generación de evidencia simultáneamente",
})).sort((a, b) => (a.criticidad === "alta" ? 0 : 1) - (b.criticidad === "alta" ? 0 : 1));
return ok({ brechas: brechas.length, plan: priorizadas, primero: priorizadas[0]?.control });`,
      },
    ],
  },
];

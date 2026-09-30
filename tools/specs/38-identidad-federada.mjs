// ═══ CATEGORÍA: Dolores FUTUROS · Identidad Federada (A) ═══
// Evidencia: los agentes cruzan fronteras organizativas con identidades
// opacas. DID, delegación de capacidades con caducidad y rotación de claves
// son primitivas de identidad que ningún stack de agentes trae de serie.
export default [
  {
    id: "did-resolver",
    title: "DID Resolver",
    tagline: "Identidades descentralizadas did:agent: crea, resuelve, firma, verifica y revoca sin registrar nada en tercero",
    category: "Identidad Federada",
    pain: "El agente se presenta con un nombre que cualquiera puede inventar. Sin documento de identidad verificable (DID) no hay forma de saber que quien firma es quien dice ser, ni de revocar una identidad comprometida.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/did-resolver/. Emite documentos DID locales con clave de verificación derivada de un seed determinista (SHA-256), firma/verifica payloads HMAC-SHA256 y soporta revocación con motivo.",
    tools: [
      {
        name: "create_did",
        desc: "Crea una identidad did:agent para un agente con su documento completo.",
        params: { agente: { t: "string", d: "Nombre/descriptor del agente" }, proposito: { t: "string", d: "Para qué se usará esta identidad", opt: true } },
        code: `const st = store.load();
st.dids = st.dids || {};
const seed = agente + "::" + (st.seedCounter = (st.seedCounter || 0) + 1) + "::" + Date.now();
const crypto = await import("node:crypto");
const h = crypto.createHash("sha256").update(seed).digest("hex");
const ident = h.slice(0, 24);
const did = "did:agent:" + ident;
if (st.dids[did]) return fail("colisión de did (imposible en la práctica): reintenta");
st.dids[did] = {
  did, agente, proposito: proposito || "sin propósito declarado",
  verificacion: { tipo: "Ed25519VerificationKey-like", pub: h.slice(24, 56), algoritmo: "sha256-seeded" },
  creado: new Date().toISOString(), revocado: false, usos_firma: 0
};
store.save(st);
return ok({ did, documento: { id: did, agente, verificacion: st.dids[did].verificacion, creado: st.dids[did].creado, estado: "ACTIVO" }, aviso: "guarda el did y comparte el DOCUMENTO (nunca el seed)" });`,
      },
      {
        name: "resolve_did",
        desc: "Resuelve un DID a su documento: estado, clave de verificación y metadatos.",
        params: { did: { t: "string", d: "DID a resolver (did:agent:...)" } },
        code: `const st = store.load();
const d = (st.dids || {})[did];
if (!d) return fail("DID no resolvible localmente: " + did + " (¿es de otra raíz? pide el documento al agente)");
return ok({ did, documento: { id: d.did, agente: d.agente, proposito: d.proposito, verificacion: d.verificacion, creado: d.creado, revocado: d.revocado, revocacion: d.revocacion || null, firmas_emitidas: d.usos_firma } });`,
      },
      {
        name: "sign_payload",
        desc: "Firma un payload con la clave del DID: devuelve firma + todo lo necesario para verificar.",
        params: { did: { t: "string", d: "DID firmante" }, payload: { t: "string", d: "Contenido a firmar" } },
        code: `const st = store.load();
const d = (st.dids || {})[did];
if (!d) return fail("DID desconocido: " + did);
if (d.revocado) return fail("DID REVOCADO desde " + (d.revocacion || {}).ts + ": no puede firmar");
const crypto = await import("node:crypto");
const material = did + "|" + d.verificacion.pub + "|" + payload;
const firma = crypto.createHmac("sha256", material).digest("hex").slice(0, 64);
d.usos_firma++;
d.ultima_firma = new Date().toISOString();
store.save(st);
return ok({ did, payload_sha256: crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32), firma, algoritmo: "HMAC-SHA256(did|pub|payload)", verificado_por: "verify_payload con el mismo DID" });`,
      },
      {
        name: "verify_payload",
        desc: "Verifica una firma emitida por sign_payload contra el documento actual del DID.",
        params: { did: { t: "string", d: "DID del firmante declarado" }, payload: { t: "string", d: "Contenido original (sin modificar)" }, firma: { t: "string", d: "Firma a verificar" } },
        code: `const st = store.load();
const d = (st.dids || {})[did];
if (!d) return fail("DID no resolvible: no se puede verificar contra raíz desconocida");
if (d.revocado) return ok({ valido: false, razon: "el DID está REVOCADO (" + ((d.revocacion || {}).motivo || "sin motivo") + "): firmas posteriores a la revocación no valen", revocado_en: (d.revocacion || {}).ts });
const crypto = await import("node:crypto");
const material = did + "|" + d.verificacion.pub + "|" + payload;
const esperada = crypto.createHmac("sha256", material).digest("hex").slice(0, 64);
const valido = esperada === String(firma || "");
return ok({ valido, did, firmante: d.agente, razon: valido ? "firma consistente con la clave publicada en el documento DID" : "firma NO coincide: payload alterado, DID equivocado o clave rotada tras la firma" });`,
      },
      {
        name: "revoke_did",
        desc: "Revoca una identidad (motivo obligatorio). Las verificaciones posteriores fallarán.",
        params: { did: { t: "string", d: "DID a revocar" }, motivo: { t: "string", d: "Por qué se revoca (compromiso, rotación, fin de vida)" } },
        code: `const st = store.load();
const d = (st.dids || {})[did];
if (!d) return fail("DID desconocido");
if (d.revocado) return fail("ya estaba revocado desde " + d.revocacion.ts);
d.revocado = true;
d.revocacion = { motivo, ts: new Date().toISOString() };
store.save(st);
return ok({ did, revocado: true, motivo, efecto: "toda firma futura queda denegada y las verificaciones existentes marcan invalidación" });`,
      },
      {
        name: "list_dids",
        desc: "Inventario de identidades locales: activas, revocadas y uso de firma.",
        params: {},
        code: `const st = store.load();
const ds = __vals(st.dids || {});
if (!ds.length) return ok({ dids: 0, mensaje: "sin identidades: crea con create_did" });
return ok({ total: ds.length, activos: ds.filter(d => !d.revocado).length, revocados: ds.filter(d => d.revocado).length, identidades: ds.map(d => ({ did: d.did, agente: d.agente, estado: d.revocado ? "REVOCADO" : "ACTIVO", firmas: d.usos_firma, creado: d.creado })).sort((a, b) => b.firmas - a.firmas) });`,
      },
    ],
  },
  {
    id: "delegation-chain",
    title: "Delegation Chain",
    tagline: "Delegación de capacidades verificable: cadenas de 'puedo hacer X porque me lo delegó Y' con expiración y estrechamiento",
    category: "Identidad Federada",
    pain: "El agente subordinado actúa 'en nombre de' su principal sin prueba verificable: ni alcance exacto, ni caducidad, ni límite de profundidad. Cualquier agente intermedio puede inflar sus poderes y nadie lo detecta.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/delegation-chain/. Árbol de delegaciones {delegante, delegado, alcance, expira, profundidad}; la verificación recorre la cadena hasta la raíz y falla ante expiración, ensanchamiento de alcance o profundidad excesiva.",
    tools: [
      {
        name: "mint_delegation",
        desc: "Emite una delegación: quién delega, sobre quién, qué alcance y hasta cuándo.",
        params: { delegante: { t: "string", d: "Agente que delega (principal o intermediario)" }, delegado: { t: "string", d: "Agente que recibe la capacidad" }, alcance: { t: "string", d: "Capacidad delegada (ej: lectura:clientes-EC)" }, expira_horas: { t: "number", d: "Vigencia en horas (0 = sin expiración)", opt: true, def: 24 } },
        code: `const st = store.load();
st.delegaciones = st.delegaciones || [];
const clave = delegante + " -> " + delegado + " [" + alcance + "]";
const duplicada = st.delegaciones.find(d => d.delegante === delegante && d.delegado === delegado && d.alcance === alcance && !d.revocada && !d.expirada_manual);
if (duplicada) return fail("delegación idéntica ya activa (id " + duplicada.id + ")");
const id = "dlg_" + String(st.delegaciones.length + 1).padStart(4, "0");
st.delegaciones.push({ id, delegante, delegado, alcance, expira: expira_horas > 0 ? new Date(Date.now() + expira_horas * 3600000).toISOString() : null, revocada: false, emitida: new Date().toISOString(), usos: 0 });
store.save(st);
return ok({ id, delegacion: clave, expira: expira_horas > 0 ? "en " + expira_horas + "h" : "sin expiración", regla: "el delegado SOLO puede usar/redelegar este alcance exacto o más estrecho" });`,
      },
      {
        name: "verify_chain",
        desc: "Verifica la cadena completa de una delegación: validez, expiración, profundidad y estrechamiento de alcance.",
        params: { delegado_final: { t: "string", d: "Agente cuya autoridad se cuestiona" }, alcance_requerido: { t: "string", d: "Capacidad que quiere ejercer" }, raiz_confiable: { t: "string", d: "Principal raíz de confianza", opt: true }, max_profundidad: { t: "number", d: "Profundidad máxima de re-delegación", opt: true, def: 3 } },
        code: `const st = store.load();
const delegaciones = (st.delegaciones || []).filter(d => !d.revocada);
const camino = [];
let actual = delegado_final;
let hops = 0;
while (hops <= max_profundidad + 1) {
  const edge = delegaciones.find(d => d.delegado === actual && (!d.expira || new Date(d.expira).getTime() > Date.now()));
  if (!edge) break;
  camino.unshift(edge);
  actual = edge.delegante;
  hops++;
  if (raiz_confiable && actual === raiz_confiable) break;
}
if (!camino.length) return fail("el agente '" + delegado_final + "' no tiene ninguna delegación activa");
const raiz = camino[0].delegante;
if (raiz_confiable && raiz !== raiz_confiable) return fail("la cadena llega a '" + raiz + "' pero la raíz de confianza es '" + raiz_confiable + "': NO AUTORIZADO");
const profundidad = camino.length;
if (profundidad > max_profundidad) return fail("cadena de " + profundidad + " saltos > máximo " + max_profundidad + ": demasiado larga, sospecha de re-delegación encadenada");
let alcanceRaiz = camino[0].alcance;
for (let i = 1; i < camino.length; i++) {
  const aPadre = camino[i - 1].alcance;
  const aHijo = camino[i].alcance;
  const prefijoOk = aHijo.startsWith(aPadre) || aPadre.includes(":") && aHijo.startsWith(aPadre.split(":")[0] + ":") && aHijo.length >= aPadre.length;
  if (!prefijoOk && aHijo !== aPadre) {
    return fail("ENSANCHAMIENTO DETECTADO en el salto " + i + ": '" + aPadre + "' delegó '" + aHijo + "' que no es sub-alcance: cadena inválida");
  }
}
const alcanceFinal = camino[camino.length - 1].alcance;
const cubre = alcanceFinal === alcance_requerido || alcanceFinal.startsWith(alcance_requerido) || alcance_requerido.startsWith(alcanceFinal) === false && alcanceFinal.split(":")[0] === alcance_requerido.split(":")[0];
camino[camino.length - 1].usos = (camino[camino.length - 1].usos || 0) + 1;
store.save(st);
return ok({ autorizado: cubre, delegado_final, alcance_requerido, alcance_concedido: alcanceFinal, cadena: camino.map(c => ({ id: c.id, de: c.delegante, a: c.delegado, alcance: c.alcance, expira: c.expira || "sin límite" })), raiz, profundidad, veredicto: cubre ? "AUTORIZADO: la cadena cubre '" + alcance_requerido + "' desde la raíz '" + raiz + "'" : "NO AUTORIZADO: la cadena concede '" + alcanceFinal + "' que no cubre '" + alcance_requerido + "'" });`,
      },
      {
        name: "revoke_delegation",
        desc: "Revoca una delegación concreta (las cadenas que pasan por ella caen).",
        params: { id: { t: "string", d: "Id de la delegación (dlg_0001)" }, motivo: { t: "string", d: "Motivo de revocación" } },
        code: `const st = store.load();
const d = (st.delegaciones || []).find(x => x.id === id);
if (!d) return fail("delegación no encontrada: " + id);
if (d.revocada) return fail("ya revocada");
d.revocada = true;
d.revocacion = { motivo, ts: new Date().toISOString() };
store.save(st);
const colaterales = (st.delegaciones || []).filter(x => !x.revocada && x.delegante === d.delegado).length;
return ok({ id, revocada: true, delegacion: d.delegante + " -> " + d.delegado + " [" + d.alcance + "]", delegaciones_hijas_aun_activas: colaterales, aviso: colaterales ? "revoca también las " + colaterales + " delegaciones emitidas POR el delegado o quedan huérfanas inválidas" : "sin delegaciones hijas" });`,
      },
      {
        name: "chain_view",
        desc: "Visualiza el árbol de delegaciones desde una raíz o para un agente.",
        params: { agente: { t: "string", d: "Raíz o agente de interés", opt: true } },
        code: `const st = store.load();
const activas = (st.delegaciones || []).filter(d => !d.revocada && (!d.expira || new Date(d.expira).getTime() > Date.now()));
const expiradas = (st.delegaciones || []).filter(d => !d.revocada && d.expira && new Date(d.expira).getTime() <= Date.now());
if (!activas.length) return ok({ activas: 0, expiradas: expiradas.length, mensaje: "sin delegaciones activas" });
let sub = agente ? activas.filter(d => d.delegante === agente || d.delegado === agente) : activas;
const nodos = {};
sub.forEach(d => { nodos[d.delegante] = nodos[d.delegante] || { agente: d.delegante, delega: [] }; nodos[d.delegante].delega.push({ a: d.delegado, alcance: d.alcance, expira: d.expira || "sin límite", usos: d.usos || 0 }); });
return ok({ activas: activas.length, expiradas_sin_revocar: expiradas.length, arbol: __vals(nodos), mas_usadas: activas.slice().sort((a, b) => (b.usos || 0) - (a.usos || 0)).slice(0, 3).map(d => ({ id: d.id, cadena: d.delegante + " -> " + d.delegado, alcance: d.alcance, usos: d.usos || 0 })) });`,
      },
    ],
  },
  {
    id: "key-rotation-manager",
    title: "Key Rotation Manager",
    tagline: "Rotación de claves con ventana de gracia: rota sin romper verificaciones en curso y con historial auditable",
    category: "Identidad Federada",
    pain: "El agente rota su clave de golpe y todas las firmas/verificaciones en vuelo fallan de forma misteriosa; o peor: nunca rota y la clave eterna se filtra. La rotación segura es un proceso, no un comando.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/key-rotation-manager/. Cada identidad tiene clave actual + claves en gracia (verifican pero no firman) + claves muertas; la política define periodicidad y duración de gracia.",
    tools: [
      {
        name: "register_identity",
        desc: "Registra una identidad criptográfica con su clave inicial y política de rotación.",
        params: { identidad: { t: "string", d: "Nombre de la identidad/propósito de la clave" }, clave_inicial: { t: "string", d: "Material o referencia de la clave inicial (id/hash, no el secreto)" }, periodo_dias: { t: "number", d: "Rotar cada N días (0 = manual)", opt: true, def: 90 }, gracia_horas: { t: "number", d: "Horas que la clave vieja sigue VERIFICANDO tras rotar", opt: true, def: 72 } },
        code: `const st = store.load();
st.identidades = st.identidades || {};
if (st.identidades[identidad]) return fail("identidad ya registrada: " + identidad);
st.identidades[identidad] = { identidad, periodo_dias, gracia_horas, claves: [{ id: "k1", material: clave_inicial, rol: "activa", desde: new Date().toISOString() }], rotaciones: 0, historial: [] };
store.save(st);
return ok({ identidad, clave_activa: "k1", politica: { rotar_cada_dias: periodo_dias, gracia_verificacion_horas: gracia_horas } });`,
      },
      {
        name: "perform_rotation",
        desc: "Ejecuta la rotación: la clave activa pasa a gracia (solo verifica) y una nueva queda activa (solo firma).",
        params: { identidad: { t: "string", d: "Identidad a rotar" }, nueva_clave: { t: "string", d: "Material/referencia de la nueva clave" }, razon: { t: "string", d: "Por qué rotas (programada, sospecha, fuga)", opt: true, def: "programada" } },
        code: `const st = store.load();
const id = (st.identidades || {})[identidad];
if (!id) return fail("identidad no registrada");
const activa = id.claves.find(k => k.rol === "activa");
if (!activa) return fail("sin clave activa: estado corrupto, revisa historial");
activa.rol = "gracia";
activa.hasta = new Date(Date.now() + id.gracia_horas * 3600000).toISOString();
const nuevoId = "k" + (id.claves.length + 1);
id.claves.push({ id: nuevoId, material: nueva_clave, rol: "activa", desde: new Date().toISOString() });
id.rotaciones++;
id.historial.push({ rotacion: id.rotaciones, de: activa.id, a: nuevoId, razon, ts: new Date().toISOString() });
const enGracia = id.claves.filter(k => k.rol === "gracia");
store.save(st);
return ok({ identidad, nueva_clave_activa: nuevoId, clave_anterior: { id: activa.id, verifica_hasta: activa.hasta, aviso: "las firmas hechas con " + activa.id + " siguen verificando " + id.gracia_horas + "h" }, en_gracia: enGracia.map(k => k.id), total_rotaciones: id.rotaciones });`,
      },
      {
        name: "check_key_status",
        desc: "Consulta qué puede hacer cada clave: firmar (activa), solo verificar (gracia) o nada (muerta).",
        params: { identidad: { t: "string", d: "Identidad" } },
        code: `const st = store.load();
const id = (st.identidades || {})[identidad];
if (!id) return fail("identidad no registrada");
const ahora = Date.now();
const claves = id.claves.map(k => {
  let rolEfectivo = k.rol;
  if (k.rol === "gracia" && k.hasta && new Date(k.hasta).getTime() < ahora) rolEfectivo = "muerta";
  return { id: k.id, rol_declarado: k.rol, rol_efectivo: rolEfectivo, puede_firmar: rolEfectivo === "activa", puede_verificar: rolEfectivo === "activa" || rolEfectivo === "gracia", desde: k.desde, verifica_hasta: k.hasta || null };
});
const activa = claves.find(k => k.puede_firmar);
return ok({ identidad, rotaciones: id.rotaciones, claves, resumen: { firmables: claves.filter(k => k.puede_firmar).length, solo_verificacion: claves.filter(k => k.puede_verificar && !k.puede_firmar).length, muertas: claves.filter(k => !k.puede_verificar).length }, clave_para_firmar: activa ? activa.id : "NINGUNA: rota ya", politica: { cada_dias: id.periodo_dias, gracia_horas: id.gracia_horas } });`,
      },
      {
        name: "rotation_due",
        desc: "Detecta rotaciones vencidas o a punto de vencer según la política.",
        params: { margen_dias: { t: "number", d: "Días de aviso previo", opt: true, def: 7 } },
        code: `const st = store.load();
const ids = __vals(st.identidades || {});
if (!ids.length) return ok({ identidades: 0, mensaje: "sin identidades registradas" });
const avisos = [];
ids.forEach(id => {
  if (id.periodo_dias === 0) return;
  const activa = id.claves.find(k => k.rol === "activa");
  if (!activa) { avisos.push({ identidad: id.identidad, estado: "SIN_CLAVE_ACTIVA", accion: "rota inmediatamente" }); return; }
  const edadDias = (Date.now() - new Date(activa.desde).getTime()) / 86400000;
  if (edadDias >= id.periodo_dias) avisos.push({ identidad: id.identidad, estado: "VENCIDA", edad_clave_dias: Number(edadDias.toFixed(1)), politica: id.periodo_dias + " días", accion: "rota HOY" });
  else if (edadDias >= id.periodo_dias - margen_dias) avisos.push({ identidad: id.identidad, estado: "PROXIMA", edad_clave_dias: Number(edadDias.toFixed(1)), vence_en_dias: Number((id.periodo_dias - edadDias).toFixed(1)), accion: "planifica la rotación" });
});
return ok({ identidades: ids.length, pendientes: avisos.length, avisos, sin_alerta: ids.filter(id => id.periodo_dias > 0 || id.claves.some(k => k.rol === "activa")).length - avisos.length });`,
      },
    ],
  },
]

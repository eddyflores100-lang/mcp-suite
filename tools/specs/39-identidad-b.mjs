// ═══ CATEGORÍA: Dolores FUTUROS · Identidad Federada (B) ═══
// Evidencia: el pasaporte portable de agente (identidad + capacidades +
// sellos de uso) y el mintado de capacidades de mínimo privilegio son las
// piezas que faltan para que un agente cruce límites de forma auditable.
export default [
  {
    id: "agent-passport",
    title: "Agent Passport",
    tagline: "Pasaporte portable del agente: identidad, capacidades declaradas, sellos de entrada/salida y verificación de integridad",
    category: "Identidad Federada",
    pain: "Cuando un agente llega a otra orquestación no hay forma portable de presentarse: quién eres, qué sabes hacer, dónde has estado, quién te avala. Cada sistema vuelve a preguntarlo todo y nada es verificable.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/agent-passport/. El pasaporte agrupa identidad + claims + sellos con un checksum interno (SHA-256 sobre contenido canónico); la verificación detecta manipulación y caducidad.",
    tools: [
      {
        name: "create_passport",
        desc: "Emite un pasaporte para un agente con identidad y vigencia.",
        params: { agente: { t: "string", d: "Identidad del agente (did o nombre único)" }, emisor: { t: "string", d: "Quién emite el pasaporte (organización raíz)" }, vigencia_dias: { t: "number", d: "Días de validez", opt: true, def: 365 } },
        code: `const st = store.load();
st.pasaportes = st.pasaportes || [];
const duplicado = st.pasaportes.find(p => p.agente === agente && !p.anulado);
if (duplicado) return fail("ya existe pasaporte activo para " + agente + " (" + duplicado.numero + "): anúlalo primero");
const numero = "P-" + String(st.pasaportes.length + 1).padStart(5, "0");
st.pasaportes.push({ numero, agente, emisor, emitido: new Date().toISOString(), vence: new Date(Date.now() + vigencia_dias * 86400000).toISOString(), claims: [], sellos: [], anulado: false, checksum: null });
const p = st.pasaportes[st.pasaportes.length - 1];
const crypto = await import("node:crypto");
p.checksum = crypto.createHash("sha256").update(JSON.stringify({ a: p.agente, e: p.emisor, c: p.claims, s: p.sellos, v: p.vence })).digest("hex").slice(0, 32);
store.save(st);
return ok({ numero, agente, emisor, vence: p.vence, checksum: p.checksum, siguiente: "añade capacidades con add_claim" });`,
      },
      {
        name: "add_claim",
        desc: "Añade una capacidad o mérito al pasaporte (con nivel demostrado, no auto-declarado).",
        params: { numero: { t: "string", d: "Número de pasaporte (P-00001)" }, claim: { t: "string", d: "Capacidad (ej: navegacion-web-segura)" }, nivel: { t: "enum", d: "Nivel demostrado", values: ["declarado", "probado", "certificado"] }, evidencia: { t: "string", d: "Evidencia o fuente del nivel", opt: true } },
        code: `const st = store.load();
const p = (st.pasaportes || []).find(x => x.numero === numero);
if (!p) return fail("pasaporte no encontrado: " + numero);
if (p.anulado) return fail("pasaporte anulado: no admite claims");
const yaTiene = p.claims.find(c => c.claim === claim);
if (yaTiene) {
  const orden = { declarado: 0, probado: 1, certificado: 2 };
  if (orden[nivel] <= orden[yaTiene.nivel]) return fail("ya tiene '" + claim + "' en nivel " + yaTiene.nivel + ": solo se puede elevar");
  yaTiene.nivel = nivel;
  yaTiene.evidencia = evidencia || yaTiene.evidencia;
  yaTiene.actualizado = new Date().toISOString();
} else {
  p.claims.push({ claim, nivel, evidencia: evidencia || "", desde: new Date().toISOString() });
}
const crypto = await import("node:crypto");
p.checksum = crypto.createHash("sha256").update(JSON.stringify({ a: p.agente, e: p.emisor, c: p.claims, s: p.sellos, v: p.vence })).digest("hex").slice(0, 32);
store.save(st);
return ok({ numero, claims_totales: p.claims.length, claim, nivel, checksum_actualizado: p.checksum });`,
      },
      {
        name: "stamp",
        desc: "Sella una entrada/salida: dónde operó el agente, cuándo y con qué resultado.",
        params: { numero: { t: "string", d: "Pasaporte" }, sistema: { t: "string", d: "Sistema/orquestación visitada" }, tipo: { t: "enum", d: "Tipo de sello", values: ["entrada", "salida", "evento"] }, resultado: { t: "string", d: "Resultado de la visita (ok, con incidente, expulsado)", opt: true, def: "ok" } },
        code: `const st = store.load();
const p = (st.pasaportes || []).find(x => x.numero === numero);
if (!p) return fail("pasaporte no encontrado");
p.sellos.push({ sistema, tipo, resultado, ts: new Date().toISOString() });
const crypto = await import("node:crypto");
p.checksum = crypto.createHash("sha256").update(JSON.stringify({ a: p.agente, e: p.emisor, c: p.claims, s: p.sellos, v: p.vence })).digest("hex").slice(0, 32);
store.save(st);
const incidentes = p.sellos.filter(s => s.resultado !== "ok").length;
return ok({ numero, sello: tipo + " @ " + sistema, sellos_totales: p.sellos.length, incidentes, aviso: incidentes > 2 ? "3+ incidentes registrados: este pasaporte empezará a ser rechazado en sistemas estrictos" : null });`,
      },
      {
        name: "verify_passport",
        desc: "Verifica un pasaporte: integridad (checksum), vigencia y nivel de confianza según claims e incidentes.",
        params: { numero: { t: "string", d: "Pasaporte a verificar" } },
        code: `const st = store.load();
const p = (st.pasaportes || []).find(x => x.numero === numero);
if (!p) return fail("pasaporte inexistente: " + numero);
if (p.anulado) return ok({ valido: false, razon: "ANULADO por el emisor: " + (p.motivo_anulacion || "sin motivo") });
const crypto = await import("node:crypto");
const esperado = crypto.createHash("sha256").update(JSON.stringify({ a: p.agente, e: p.emisor, c: p.claims, s: p.sellos, v: p.vence })).digest("hex").slice(0, 32);
const integro = esperado === p.checksum;
const vigente = new Date(p.vence).getTime() > Date.now();
const incidentes = p.sellos.filter(s => s.resultado !== "ok").length;
const certificados = p.claims.filter(c => c.nivel === "certificado").length;
const probados = p.claims.filter(c => c.nivel === "probado").length;
const confianza = integro && vigente ? incidentes === 0 && certificados >= 2 ? "ALTA" : incidentes <= 1 && (certificados + probados) >= 2 ? "MEDIA" : "BAJA (claims mayormente declarados o con incidentes)" : "NULA";
return ok({ numero, agente: p.agente, emisor: p.emisor, integridad: integro ? "integro (checksum coincide)" : "MANIPULADO: el contenido no coincide con el checksum emitido", vigente, vence: p.vence, claims: p.claims.length, sellos: p.sellos.length, incidentes, nivel_confianza: confianza, veredicto: integro && vigente && confianza !== "BAJA (claims mayormente declarados o con incidentes)" ? "ACEPTA: pasaporte verificable y con solvencia" : "RECHAZA o exige refuerzo: " + (integro ? "" : "manipulado ") + (vigente ? "" : "vencido ") + confianza });`,
      },
      {
        name: "annul_passport",
        desc: "Anula un pasaporte (robo, desmantelamiento del agente, fraude).",
        params: { numero: { t: "string", d: "Pasaporte" }, motivo: { t: "string", d: "Motivo de anulación" } },
        code: `const st = store.load();
const p = (st.pasaportes || []).find(x => x.numero === numero);
if (!p) return fail("pasaporte no encontrado");
if (p.anulado) return fail("ya anulado");
p.anulado = true;
p.motivo_anulacion = motivo;
p.anulado_ts = new Date().toISOString();
store.save(st);
return ok({ numero, anulado: true, motivo, efecto: "toda verificación futura lo rechaza; notifica a los sistemas que lo aceptaron" });`,
      },
    ],
  },
  {
    id: "scope-minting",
    title: "Scope Minting",
    tagline: "Acuña capacidades de mínimo privilegio como tokens: verbo + recurso + límites, verificables en un paso",
    category: "Identidad Federada",
    pain: "Al agente se le dan credenciales todopoderosas para leer UN archivo: la única granularidad disponible es 'todo o nada'. Sin tokens de alcance fino, cualquier filtración de credencial es total.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/scope-minting/. Capacidades declaradas (verbo+recurso+constraints); los tokens acuñados llevan nonce, expiración y límite de usos; check_token valida que el token cubre la acción exacta pedida.",
    tools: [
      {
        name: "define_capability",
        desc: "Declara una capacidad acuñable: verbo sobre recurso con restricciones.",
        params: { nombre: { t: "string", d: "Nombre único de la capacidad" }, verbo: { t: "string", d: "Verbo permitido (leer, escribir, llamar...)" }, recurso: { t: "string", d: "Recurso objetivo (ruta, tabla, endpoint)" }, restricciones: { t: "any", d: "Límites extra {max_registros, solo_columnas, horas}", opt: true } },
        code: `const st = store.load();
st.capacidades = st.capacidades || {};
if (st.capacidades[nombre]) return fail("capacidad ya definida: " + nombre);
st.capacidades[nombre] = { nombre, verbo: verbo.toLowerCase(), recurso, restricciones: restricciones || {}, minteados: 0, creado: new Date().toISOString() };
store.save(st);
return ok({ nombre, capacidad: verbo.toLowerCase() + " -> " + recurso, restricciones, nota: "principio de mínimo privilegio: acuña tokens con mint_token solo cuando se necesiten" });`,
      },
      {
        name: "mint_token",
        desc: "Acuña un token de capacidad con expiración y usos máximos.",
        params: { capacidad: { t: "string", d: "Nombre de la capacidad" }, portador: { t: "string", d: "Agente que portará el token" }, expira_horas: { t: "number", d: "Vigencia en horas", opt: true, def: 1 }, max_usos: { t: "number", d: "Usos máximos (0 = ilimitado hasta expirar)", opt: true, def: 1 } },
        code: `const st = store.load();
const cap = (st.capacidades || {})[capacidad];
if (!cap) return fail("capacidad no definida: " + capacidad);
st.tokens = st.tokens || [];
const crypto = await import("node:crypto");
const nonce = crypto.randomBytes(8).toString("hex");
const id = "tk_" + String(st.tokens.length + 1).padStart(4, "0");
st.tokens.push({ id, nonce, capacidad, portador, expira: new Date(Date.now() + expira_horas * 3600000).toISOString(), max_usos, usos: 0, quemado: false, emitido: new Date().toISOString() });
cap.minteados++;
store.save(st);
return ok({ id, nonce, capacidad, portador, expira_en: expira_horas + "h", usos_permitidos: max_usos === 0 ? "ilimitados hasta expirar" : max_usos, uso: "presenta {id, nonce} al ejecutar la acción" });`,
      },
      {
        name: "check_token",
        desc: "Verifica si un token autoriza UNA acción concreta (verbo+recurso exactos) y consume el uso.",
        params: { id: { t: "string", d: "Id del token" }, nonce: { t: "string", d: "Nonce del token" }, accion_verbo: { t: "string", d: "Verbo que se quiere ejecutar" }, accion_recurso: { t: "string", d: "Recurso que se quiere tocar" }, consumir: { t: "boolean", d: "Consumir el uso si autoriza", opt: true, def: true } },
        code: `const st = store.load();
const t = (st.tokens || []).find(x => x.id === id);
if (!t) return fail("token inexistente: " + id);
if (t.nonce !== nonce) return fail("nonce inválido: token presentado incorrectamente");
if (t.quemado) return ok({ autorizado: false, razon: "token quemado deliberadamente" });
if (new Date(t.expira).getTime() < Date.now()) return ok({ autorizado: false, razon: "token EXPIRADO en " + t.expira });
const cap = (st.capacidades || {})[t.capacidad];
if (!cap) return ok({ autorizado: false, razon: "la capacidad detrás del token fue eliminada" });
const verboOk = cap.verbo === accion_verbo.toLowerCase();
const recursoOk = cap.recurso === accion_recurso || cap.recurso.endsWith("*") && accion_recurso.startsWith(cap.recurso.slice(0, -1));
const usosOk = t.max_usos === 0 || t.usos < t.max_usos;
if (!verboOk) return ok({ autorizado: false, razon: "el token concede '" + cap.verbo + "' y pides '" + accion_verbo + "': fuera de alcance" });
if (!recursoOk) return ok({ autorizado: false, razon: "el token apunta a '" + cap.recurso + "' y tocas '" + accion_recurso + "'" });
if (!usosOk) return ok({ autorizado: false, razon: "usos agotados (" + t.usos + "/" + t.max_usos + ")" });
if (consumir) { t.usos++; store.save(st); }
return ok({ autorizado: true, capacidad: t.capacidad, portador: t.portador, usos_restantes: t.max_usos === 0 ? "ilimitados" : t.max_usos - t.usos, expira: t.expira, restricciones: cap.restricciones });`,
      },
      {
        name: "burn_token",
        desc: "Quema un token antes de su expiración (ya no se necesita o hay sospecha).",
        params: { id: { t: "string", d: "Token a quemar" }, motivo: { t: "string", d: "Motivo", opt: true } },
        code: `const st = store.load();
const t = (st.tokens || []).find(x => x.id === id);
if (!t) return fail("token inexistente");
if (t.quemado) return fail("ya quemado");
t.quemado = true;
t.quemado_motivo = motivo || "revocación manual";
t.quemado_ts = new Date().toISOString();
store.save(st);
return ok({ id, quemado: true, usos_que_hizo: t.usos, motivo: t.quemado_motivo });`,
      },
      {
        name: "token_census",
        desc: "Censo de tokens: activos, por capacidad, agotados y quemados.",
        params: {},
        code: `const st = store.load();
const ts = st.tokens || [];
if (!ts.length) return ok({ tokens: 0, mensaje: "sin tokens acuñados" });
const ahora = Date.now();
const activos = ts.filter(t => !t.quemado && new Date(t.expira).getTime() > ahora && (t.max_usos === 0 || t.usos < t.max_usos));
const porCap = {};
ts.forEach(t => { porCap[t.capacidad] = (porCap[t.capacidad] || 0) + 1; });
return ok({ total_acuñados: ts.length, activos: activos.length, expirados: ts.filter(t => !t.quemado && new Date(t.expira).getTime() <= ahora).length, agotados: ts.filter(t => !t.quemado && t.max_usos > 0 && t.usos >= t.max_usos).length, quemados: ts.filter(t => t.quemado).length, por_capacidad: porCap, aviso: activos.length > 20 ? "20+ tokens activos: revisa que no haya minteo indiscriminado" : null });`,
      },
    ],
  },
]

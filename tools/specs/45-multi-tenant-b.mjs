// ═══ CATEGORÍA: Dolores FUTUROS · Multi-Tenant (B) ═══
// Evidencia: el dato derivado (resúmenes, embeddings, cachés) pierde la
// etiqueta de origen y el guardián de flujos cruzados es la última línea
// de defensa contra la fuga entre inquilinos.
export default [
  {
    id: "tenant-data-tagger",
    title: "Tenant Data Tagger",
    tagline: "Etiqueta cada dato con su inquilino y verifica que lo DERIVADO también la lleva: la etiqueta se propaga o no es confianza",
    category: "Multi-Tenant",
    pain: "El dato original lleva tenant en su id, pero el resumen que el agente hizo de ese dato ya no lleva nada: al reutilizarlo para otro cliente, la fuga es perfecta porque la procedencia se evaporó.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/tenant-data-tagger/. Registro de datos con tenant+clasificación; verificación de propagación (los derivados declaran fuentes) y escáner de datos sin etiqueta.",
    tools: [
      {
        name: "tag_data",
        desc: "Etiqueta un dato con su inquilino y clasificación de sensibilidad.",
        params: { dato: { t: "string", d: "Identificador del dato (ruta, id, clave de caché)" }, tenant: { t: "string", d: "Inquilino dueño" }, clasificacion: { t: "enum", d: "Sensibilidad", values: ["publico", "interno", "confidencial", "pii"], opt: true, def: "interno" }, descripcion: { t: "string", d: "Qué contiene", opt: true } },
        code: `const st = store.load();
st.datos = st.datos || {};
if (st.datos[dato]) return fail("dato ya etiquetado como " + st.datos[dato].tenant + "/" + st.datos[dato].clasificacion + ": des-etiqueta conscientemente si cambia");
st.datos[dato] = { dato, tenant, clasificacion, descripcion: descripcion || "", etiquetado: new Date().toISOString(), fuentes: null };
store.save(st);
return ok({ dato, tenant, clasificacion, regla: clasificacion === "pii" ? "PII: nunca sale del tenant ni a logs: redacta antes de cualquier salida" : "etiqueta registrada" });`,
      },
      {
        name: "declare_derived",
        desc: "Declara que un dato DERIVA de otros: la etiqueta debe heredarse del más sensible.",
        params: { dato_derivado: { t: "string", d: "Dato derivado (resumen, embedding, caché)" }, fuentes: { t: "array", d: "Ids de los datos de origen" } },
        code: `const st = store.load();
st.datos = st.datos || {};
const orden = { publico: 0, interno: 1, confidencial: 2, pii: 3 };
const etiquetadas = (fuentes || []).map(f => st.datos[f]).filter(Boolean);
if (!etiquetadas.length) return fail("ninguna fuente está etiquetada: etiquétalas primero, un derivado sin fuentes trazables es una fuga en potencia");
const hereda = etiquetadas.reduce((max, f) => orden[f.clasificacion] > orden[max.clasificacion] ? f : max, etiquetadas[0]);
st.datos[dato_derivado] = st.datos[dato_derivado] || { dato: dato_derivado, etiquetado: new Date().toISOString() };
st.datos[dato_derivado].tenant = hereda.tenant;
st.datos[dato_derivado].clasificacion = hereda.clasificacion;
st.datos[dato_derivado].fuentes = (fuentes || []).map(String);
st.datos[dato_derivado].descripcion = "derivado de " + fuentes.join(", ");
store.save(st);
return ok({ dato_derivado, hereda_de: fuentes, tenant_heredado: hereda.tenant, clasificacion_heredada: hereda.clasificacion, regla: "el derivado es TAN sensible como su fuente más sensible: sin degradar" });`,
      },
      {
        name: "check_propagation",
        desc: "Verifica la trazabilidad de un dato: ¿de dónde viene y conserva la etiqueta correcta?",
        params: { dato: { t: "string", d: "Dato a verificar" } },
        code: `const st = store.load();
const d = (st.datos || {})[dato];
if (!d) return fail("dato sin etiquetar: etiquétalo antes de usarlo en nada");
const camino = [d];
let actual = d;
while (actual.fuentes && actual.fuentes.length) {
  const primera = st.datos[actual.fuentes[0]];
  if (!primera) { camino.push({ roto: true, falta: actual.fuentes[0] }); break; }
  camino.push(primera);
  actual = primera;
}
const roto = camino.some(c => c.roto);
const consistente = !roto && camino.every(c => c.tenant === d.tenant);
return ok({ dato, tenant: d.tenant, clasificacion: d.clasificacion, cadena_de_procedencia: camino.map(c => c.roto ? "FALTA: " + c.falta : c.dato + " [" + c.tenant + "/" + c.clasificacion + "]"), trazable: !roto, etiqueta_consistente_en_cadena: consistente, problema: roto ? "cadena ROTA: hay una fuente sin etiqueta: el dato no es confiable para uso cruzado" : consistente ? "todo en orden" : "INCONSISTENTE: la cadena mezcla tenants: revisa qué fuente se coló" });`,
      },
      {
        name: "untagged_scan",
        desc: "Escanea un conjunto de ids de datos y devuelve los que están sin etiqueta (puntos de fuga).",
        params: { candidatos: { t: "array", d: "Ids de datos que el agente quiere usar ahora" } },
        code: `const st = store.load();
const datos = st.datos || {};
const ids = (candidatos || []).map(String).filter(Boolean);
if (!ids.length) return fail("sin candidatos");
const sinEtiqueta = ids.filter(id => !datos[id]);
const pii = ids.filter(id => datos[id] && datos[id].clasificacion === "pii");
const confidenciales = ids.filter(id => datos[id] && datos[id].clasificacion === "confidencial");
return ok({ candidatos: ids.length, sin_etiqueta: sinEtiqueta, con_pii: pii, confidenciales: confidenciales, veredicto: sinEtiqueta.length === 0 ? "todos etiquetados: uso trazable" : sinEtiqueta.length + " datos SIN etiqueta: etiquétalos o descártalos ANTES de usarlos; un dato sin tenant es de nadie y de todos (fuga potencial)" });`,
      },
    ],
  },
  {
    id: "cross-tenant-guard",
    title: "Cross-Tenant Guard",
    tagline: "Guardián de flujos entre inquilinos: ninguna transferencia de datos cruza tenants sin política explícita que lo permita",
    category: "Multi-Tenant",
    pain: "El agente 'optimiza' combinando datos de dos clientes para responder mejor a un tercero: nadie le dijo que ese flujo cruzado estaba prohibido, porque el prohibido no estaba escrito en ninguna parte.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/cross-tenant-guard/. Políticas de flujo permitido (por clasificación y dirección); check_transfer valida cada transferencia y las violaciones quedan con contexto completo para auditoría.",
    tools: [
      {
        name: "set_policy",
        desc: "Define qué flujos entre tenants están PERMITIDOS (todo lo demás se deniega por defecto).",
        params: { nombre: { t: "string", d: "Nombre de la política" }, desde_clasificacion: { t: "enum", d: "Clasificación del origen", values: ["publico", "interno", "confidencial", "pii"] }, hacia_clasificacion_max: { t: "enum", d: "Clasificación máxima del destino", values: ["publico", "interno", "confidencial", "pii"] }, permitido: { t: "boolean", d: "¿Se permite este patrón?" }, condicion: { t: "string", d: "Condición adicional si se permite", opt: true } },
        code: `const st = store.load();
st.politicas = st.politicas || [];
st.politicas = st.politicas.filter(p => !(p.nombre === nombre));
st.politicas.push({ nombre, desde_clasificacion, hacia_clasificacion_max, permitido, condicion: condicion || "", creada: new Date().toISOString() });
store.save(st);
return ok({ politica: nombre, flujo: desde_clasificacion + " -> " + hacia_clasificacion_max + " = " + (permitido ? "PERMITIDO" + (condicion ? " (" + condicion + ")" : "") : "DENEGADO"), politicas_totales: st.politicas.length, nota: "lo no cubierto por ninguna política se DENIEGA por defecto (fail-closed)" });`,
      },
      {
        name: "check_transfer",
        desc: "Valida una transferencia concreta: origen, destino y clasificaciones; devuelve veredicto fail-closed.",
        params: { tenant_origen: { t: "string", d: "Tenant que aporta el dato" }, clasificacion_origen: { t: "enum", d: "Clasificación del dato que se mueve", values: ["publico", "interno", "confidencial", "pii"] }, tenant_destino: { t: "string", d: "Tenant que recibiría" }, clasificacion_destino: { t: "enum", d: "Nivel de protección del destino", values: ["publico", "interno", "confidencial", "pii"] }, proposito: { t: "string", d: "Para qué se transferiría", opt: true } },
        code: `const st = store.load();
const mismoTenant = tenant_origen === tenant_destino;
if (mismoTenant) return ok({ permitido: true, razon: "mismo tenant (" + tenant_origen + "): flujo interno, sin restricción entre clasificaciones" });
if (clasificacion_origen === "pii") {
  st.violaciones = st.violaciones || [];
  st.violaciones.push({ tipo: "PII_CRUZADA", tenant_origen, tenant_destino, clasificacion_origen, proposito: proposito || "", ts: new Date().toISOString() });
  store.save(st);
  return ok({ permitido: false, razon: "PII NUNCA cruza tenants: ni con política, ni con consentimiento verbal del modelo, ni 'solo esta vez'", severidad: "CRÍTICA", registrada: true });
}
const politicas = st.politicas || [];
const aplica = politicas.filter(p => p.desde_clasificacion === clasificacion_origen && p.permitido);
const orden = { publico: 0, interno: 1, confidencial: 2, pii: 3 };
const cubre = aplica.find(p => orden[clasificacion_destino] <= orden[p.hacia_clasificacion_max]);
if (cubre) {
  st.transferencias = st.transferencias || [];
  st.transferencias.push({ tenant_origen, tenant_destino, clasificacion_origen, clasificacion_destino, politica: cubre.nombre, proposito: proposito || "", ts: new Date().toISOString() });
  store.save(st);
  return ok({ permitido: true, politica: cubre.nombre, condicion: cubre.condicion || null, razon: "flujo cubierto por política explícita", registrado: true });
}
st.violaciones = st.violaciones || [];
st.violaciones.push({ tipo: "SIN_POLITICA", tenant_origen, tenant_destino, clasificacion_origen, proposito: proposito || "", ts: new Date().toISOString() });
store.save(st);
return ok({ permitido: false, razon: "FAIL-CLOSED: flujo '" + clasificacion_origen + "' hacia otro tenant SIN política que lo permita: si es legítimo, créala explícitamente con set_policy", severidad: "alta", registrada: true });`,
      },
      {
        name: "violations",
        desc: "Registro de intentos de flujo cruzado denegados, con contexto.",
        params: { solo_criticas: { t: "boolean", d: "Solo PII cruzada", opt: true, def: false } },
        code: `const st = store.load();
let v = st.violaciones || [];
if (solo_criticas) v = v.filter(x => x.tipo === "PII_CRUZADA");
if (!v.length) return ok({ violaciones: 0, mensaje: "sin intentos de flujo cruzado: excelente" });
const porPar = {};
v.forEach(x => { const k = x.tenant_origen + " -> " + x.tenant_destino; porPar[k] = (porPar[k] || 0) + 1; });
return ok({ violaciones: v.length, criticas_pii: (st.violaciones || []).filter(x => x.tipo === "PII_CRUZADA").length, por_par_origen_destino: porPar, ultimas: v.slice(-10), patron: Object.keys(porPar).find(k => porPar[k] >= 3) || null, alerta: Object.keys(porPar).some(k => porPar[k] >= 3) ? "un mismo par de tenants acumula 3+ intentos denegados: algo del diseño del agente está empujando ese flujo, arréglalo de raíz" : "intentos aislados" });`,
      },
    ],
  },
]

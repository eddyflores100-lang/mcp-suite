// ═══ CATEGORÍA: Dolores FUTUROS · Agent CI/CD (B) ═══
// Evidencia: cambiar un prompt o tool sin saber quién depende de él rompe
// cadenas enteras; y el drift entre entornos (dev/prod) es la fuente clásica
// de "en mi máquina funcionaba" trasladada a agentes.
export default [
  {
    id: "prompt-dependency-graph",
    title: "Prompt Dependency Graph",
    tagline: "Grafo de dependencias entre prompts, tools y datos: cambia X sabiendo exactamente qué se rompe",
    category: "Agent CI/CD",
    pain: "Se edita el prompt de resumen y silenciosamente se rompe el pipeline de reportes que lo consumía: nadie mantiene el mapa de qué-prompt-usa-qué-tool-usa-qué-dato. El impacto de un cambio se descubre por el colapso.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/prompt-dependency-graph/. Nodos (prompt/tool/dato) y aristas 'depende de'; análisis de impacto transitivo, orden topológico de arranque y detección de ciclos y huérfanos.",
    tools: [
      {
        name: "add_dependency",
        desc: "Declara que un nodo depende de otro (prompt→tool, tool→dato, prompt→prompt...).",
        params: { nodo: { t: "string", d: "Nodo dependiente (ej: prompt:resumen-daily)" }, depende_de: { t: "string", d: "Nodo del que depende (ej: tool:pdf-extractor)" }, tipo: { t: "string", d: "Naturaleza de la dependencia (invoca, lee, hereda)", opt: true, def: "invoca" } },
        code: `const st = store.load();
st.nodos = st.nodos || {};
st.aristas = st.aristas || [];
st.nodos[nodo] = st.nodos[nodo] || { id: nodo, tipo: nodo.split(":")[0] || "desconocido", creado: new Date().toISOString() };
st.nodos[depende_de] = st.nodos[depende_de] || { id: depende_de, tipo: depende_de.split(":")[0] || "desconocido", creado: new Date().toISOString() };
const yaExiste = st.aristas.some(a => a.nodo === nodo && a.depende_de === depende_de);
if (yaExiste) return fail("dependencia ya declarada: " + nodo + " -> " + depende_de);
st.aristas.push({ nodo, depende_de, tipo });
store.save(st);
return ok({ arista: nodo + " -> " + depende_de, tipo, nodos_totales: Object.keys(st.nodos).length, aristas_totales: st.aristas.length });`,
      },
      {
        name: "impact_analysis",
        desc: "Análisis de impacto: si cambio/rompo X, ¿qué se ve afectado hacia arriba (dependientes transitivos)?",
        params: { objetivo: { t: "string", d: "Nodo que va a cambiar" } },
        code: `const st = store.load();
st.nodos = st.nodos || {};
st.aristas = st.aristas || [];
if (!st.nodos[objetivo] && !st.aristas.some(a => a.nodo === objetivo || a.depende_de === objetivo)) return fail("nodo desconocido: " + objetivo);
const dependientes = {};
const cola = [[objetivo, 0]];
while (cola.length) {
  const [actual, nivel] = cola.shift();
  st.aristas.filter(a => a.depende_de === actual).forEach(a => {
    if (dependientes[a.nodo] === undefined) {
      dependientes[a.nodo] = nivel + 1;
      cola.push([a.nodo, nivel + 1]);
    }
  });
}
const afectados = Object.keys(dependientes).map(n => ({ nodo: n, tipo: (n.split(":")[0] || "?"), distancia: dependientes[n], ruta: dependientes[n] === 1 ? "directo" : "a " + dependientes[n] + " saltos" }));
const criticos = afectados.filter(a => a.tipo === "prompt" && a.distancia <= 2);
return ok({ objetivo, afectados_total: afectados.length, afectados: afectados.sort((a, b) => a.distancia - b.distancia), criticos_directos: criticos.map(c => c.nodo), veredicto: afectados.length === 0 ? "nodo hoja: puedes cambiarlo sin efecto colateral" : afectados.length <= 2 ? "impacto contenido: avisa a " + afectados.map(a => a.nodo).join(", ") : "impacto AMPLIO (" + afectados.length + " nodos): corre los tests de " + criticos.map(c => c.nodo).join(", ") + " antes de cambiar" });`,
      },
      {
        name: "topological_order",
        desc: "Orden de arranque/carga: qué inicializar primero para que ninguna dependencia esté ausente.",
        params: {},
        code: `const st = store.load();
const aristas = st.aristas || [];
const nodos = Object.keys(st.nodos || {});
if (!nodos.length) return fail("grafo vacío: declara nodos con add_dependency");
const indeg = {};
nodos.forEach(n => { indeg[n] = 0; });
aristas.forEach(a => { if (indeg[a.nodo] !== undefined) indeg[a.nodo]++; });
const cola = nodos.filter(n => indeg[n] === 0);
const orden = [];
const visitadas = new Set();
while (cola.length) {
  const actual = cola.shift();
  orden.push(actual);
  visitadas.add(actual);
  aristas.filter(a => a.depende_de === actual).forEach(a => {
    if (!visitadas.has(a.nodo)) {
      indeg[a.nodo]--;
      if (indeg[a.nodo] === 0) cola.push(a.nodo);
    }
  });
}
const ciclos = nodos.filter(n => !orden.includes(n));
return ok({ orden_recomendado: orden, fases: orden.map((n, i) => ({ fase: i + 1, nodo: n, tipo: n.split(":")[0] })), ciclos_detectados: ciclos, aviso: ciclos.length ? "CICLO en: " + ciclos.join(", ") + ": rompe la circularidad antes de desplegar" : "grafo acíclico: orden válido" });`,
      },
      {
        name: "orphan_check",
        desc: "Detecta nodos huérfanos (nadie los usa) y nodos fantasma (dependen de algo que no existe).",
        params: {},
        code: `const st = store.load();
const nodos = Object.keys(st.nodos || {});
const aristas = st.aristas || [];
if (!nodos.length) return fail("grafo vacío");
const usados = new Set(aristas.map(a => a.depende_de));
const consumidores = new Set(aristas.map(a => a.nodo));
const huerfanos = nodos.filter(n => !usados.has(n) && !consumidores.has(n));
const nodosSinUso = nodos.filter(n => !usados.has(n) && consumidores.has(n));
const fantasmas = aristas.filter(a => !nodos.includes(a.depende_de)).map(a => ({ arista: a.nodo + " -> " + a.depende_de, problema: "el destino no existe: typo o nodo eliminado" }));
return ok({ nodos: nodos.length, aristas: aristas.length, huerfanos_totales: huerfanos, raices_sin_consumidores: nodosSinUso, aristas_rotas: fantasmas, accion: huerfanos.length ? "los " + huerfanos.length + " huérfanos no participan en nada: elimínalos o conéctalos" : fantasmas.length ? "corrige las aristas rotas primero" : "grafo limpio" });`,
      },
    ],
  },
  {
    id: "change-changelog",
    title: "Change Changelog",
    tagline: "Changelog humano generado de los cambios del agente: agrupado, con semántica y exportable a Markdown",
    category: "Agent CI/CD",
    pain: "El agente cambia 40 cosas en la semana y cuando alguien pregunta '¿qué cambió desde el martes?' la respuesta es un encogimiento de hombros digital: sin registro estructurado no hay changelog posible.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/change-changelog/. Registra cambios tipados (added/changed/fixed/removed/deprecated) sobre componentes; genera changelog agrupado por versión con exportación Markdown.",
    tools: [
      {
        name: "record_change",
        desc: "Registra un cambio con tipo, componente y descripción orientada a humanos.",
        params: { tipo: { t: "enum", d: "Naturaleza del cambio", values: ["added", "changed", "fixed", "removed", "deprecated", "security"] }, componente: { t: "string", d: "Qué se cambió (prompt:x, tool:y, config:z)" }, descripcion: { t: "string", d: "Descripción en una línea, humana y específica" }, impacto: { t: "enum", d: "Impacto en comportamiento", values: ["nulo", "menor", "mayor", "rotura"], opt: true, def: "menor" } },
        code: `const st = store.load();
st.cambios = st.cambios || [];
st.cambios.push({ tipo, componente, descripcion, impacto, ts: new Date().toISOString() });
store.save(st);
return ok({ registrado: true, cambios_totales: st.cambios.length, pendientes_de_release: st.cambios.filter(c => !c.release).length });`,
      },
      {
        name: "tag_release",
        desc: "Sella los cambios pendientes en una versión (etiqueta) con resumen.",
        params: { etiqueta: { t: "string", d: "Nombre de la versión (v1.4.0 o fecha)" } },
        code: `const st = store.load();
st.cambios = st.cambios || [];
const pendientes = st.cambios.filter(c => !c.release);
if (!pendientes.length) return fail("no hay cambios pendientes de release");
pendientes.forEach(c => { c.release = etiqueta; });
store.save(st);
const conteo = {};
pendientes.forEach(c => { conteo[c.tipo] = (conteo[c.tipo] || 0) + 1; });
const hayRotura = pendientes.some(c => c.impacto === "rotura");
return ok({ etiqueta, cambios_sellados: pendientes.length, desglose: conteo, aviso_version: hayRotura ? "contiene cambios de RUTURA: bump MAJOR obligatorio y nota destacada" : "sin rupturas: bump menor/patch suficiente" });`,
      },
      {
        name: "generate_changelog",
        desc: "Genera el changelog agrupado por versión y tipo, listo para publicar.",
        params: { solo_release: { t: "string", d: "Filtrar por una versión concreta", opt: true }, limite: { t: "number", d: "Máximo de versiones a mostrar", opt: true, def: 5 } },
        code: `const st = store.load();
const cambios = st.cambios || [];
if (!cambios.length) return fail("sin cambios registrados");
let grupos = {};
cambios.forEach(c => {
  const r = c.release || "SIN_RELEASE";
  grupos[r] = grupos[r] || {};
  grupos[r][c.tipo] = grupos[r][c.tipo] || [];
  grupos[r][c.tipo].push({ componente: c.componente, descripcion: c.descripcion, impacto: c.impacto, ts: c.ts });
});
let claves = Object.keys(grupos).filter(k => k !== "SIN_RELEASE");
if (solo_release) claves = claves.filter(k => k === solo_release);
const resultado = {};
claves.slice(-limite).forEach(k => { resultado[k] = grupos[k]; });
if (!solo_release && grupos["SIN_RELEASE"]?.added) resultado["PENDIENTE"] = grupos["SIN_RELEASE"];
return ok({ versiones: claves.length, changelog: resultado, pendientes_sin_release: (grupos["SIN_RELEASE"] || {}).added ? (grupos["SIN_RELEASE"].added.length + (grupos["SIN_RELEASE"].changed || []).length + (grupos["SIN_RELEASE"].fixed || []).length) + " cambios sin sellar" : 0, siguiente: "usa markdown_export para llevártelo al README" });`,
      },
      {
        name: "markdown_export",
        desc: "Exporta el changelog como Markdown formato Keep-a-Changelog.",
        params: { titulo: { t: "string", d: "Título del proyecto", opt: true, def: "Changelog" }, solo_release: { t: "string", d: "Versión concreta", opt: true } },
        code: `const st = store.load();
const cambios = st.cambios || [];
if (!cambios.length) return fail("sin cambios registrados");
const etiquetas = { added: "Added", changed: "Changed", fixed: "Fixed", removed: "Removed", deprecated: "Deprecated", security: "Security" };
const grupos = {};
cambios.filter(c => !solo_release || c.release === solo_release).forEach(c => {
  const r = c.release || "Unreleased";
  grupos[r] = grupos[r] || {};
  grupos[r][c.tipo] = grupos[r][c.tipo] || [];
  grupos[r][c.tipo].push(c);
});
let md = "# " + titulo + "\\n\\n";
Object.keys(grupos).reverse().forEach(r => {
  md += "## " + r + "\\n";
  Object.keys(grupos[r]).forEach(t => {
    md += "### " + (etiquetas[t] || t) + "\\n";
    grupos[r][t].forEach(c => {
      const marca = c.impacto === "rotura" ? " **[BREAKING]**" : c.impacto === "mayor" ? " *(mayor)*" : "";
      md += "- " + c.descripcion + marca + " (" + c.componente + ")\\n";
    });
  });
  md += "\\n";
});
return ok({ markdown: md, lineas: md.split("\\n").length, cambios: cambios.length });`,
      },
    ],
  },
  {
    id: "env-diff-checker",
    title: "Env Diff Checker",
    tagline: "Caza el drift de configuración: snapshot de entorno dev vs prod y qué claves divergen antes de desplegar",
    category: "Agent CI/CD",
    pain: "El agente funciona perfecto en desarrollo y falla en producción: 3 claves distintas, 1 ausente y un timeout que solo existe en un lado. El drift de entorno es el bug más caro de diagnosticar y el más fácil de prevenir.",
    persistent: true,
    notes: "Persiste en ~/.mcp-suite/env-diff-checker/. Captura entornos nombrados (dicts de config aplanados con valores ofuscables); diff profundo con clasificación de riesgo por clave y monitoreo de drift acumulado.",
    tools: [
      {
        name: "capture_env",
        desc: "Captura un entorno nombrado (config aplanada; los valores sensibles se ofuscan automáticamente).",
        params: { nombre: { t: "string", d: "Nombre del entorno (dev, staging, prod)" }, config: { t: "any", d: "Objeto de configuración {clave: valor}" } },
        code: `const st = store.load();
st.entornos = st.entornos || [];
const previo = st.entornos.find(e => e.nombre === nombre);
const ofuscar = (k, v) => /pass|secret|token|key|api|credential/i.test(k) ? "«" + String(v).length + " chars»" : v;
const aplanado = {};
const aplanar = (obj, prefijo) => {
  Object.keys(obj || {}).forEach(k => {
    const v = obj[k];
    const clave = prefijo ? prefijo + "." + k : k;
    if (v && typeof v === "object" && !Array.isArray(v)) aplanar(v, clave);
    else aplanado[clave] = ofuscar(clave, v);
  });
};
aplanar(config, "");
if (!Object.keys(aplanado).length) return fail("config vacía: nada que capturar");
if (previo) {
  const drift = Object.keys(aplanado).filter(k => JSON.stringify(previo.config[k]) !== JSON.stringify(aplanado[k])).length;
  st.entornos = st.entornos.filter(e => e.nombre !== nombre);
  st.entornos.push({ nombre, config: aplanado, ts: new Date().toISOString(), revision: (previo.revision || 1) + 1, drift_desde_anterior: drift });
} else {
  st.entornos.push({ nombre, config: aplanado, ts: new Date().toISOString(), revision: 1 });
}
store.save(st);
return ok({ entorno: nombre, claves: Object.keys(aplanado).length, revision: previo ? (previo.revision || 1) + 1 : 1, secretos_ofuscados: Object.keys(aplanado).filter(k => String(aplanado[k]).startsWith("«")).length });`,
      },
      {
        name: "diff_envs",
        desc: "Diferencia dos entornos: claves divergentes, ausentes y con riesgo clasificado.",
        params: { origen: { t: "string", d: "Entorno base (ej: dev)" }, destino: { t: "string", d: "Entorno a comparar (ej: prod)" } },
        code: `const st = store.load();
const a = (st.entornos || []).find(e => e.nombre === origen);
const b = (st.entornos || []).find(e => e.nombre === destino);
if (!a) return fail("entorno no capturado: " + origen);
if (!b) return fail("entorno no capturado: " + destino);
const ka = new Set(Object.keys(a.config)), kb = new Set(Object.keys(b.config));
const soloA = [...ka].filter(k => !kb.has(k));
const soloB = [...kb].filter(k => !ka.has(k));
const divergentes = [...ka].filter(k => kb.has(k) && JSON.stringify(a.config[k]) !== JSON.stringify(b.config[k])).map(k => ({
  clave: k,
  en_origen: String(a.config[k]).slice(0, 40),
  en_destino: String(b.config[k]).slice(0, 40),
  riesgo: /timeout|retries|limit|batch|concurrency|pool/i.test(k) ? "MEDIO: afecta rendimiento/comportamiento" : /version|url|endpoint|host|model|provider/i.test(k) ? "ALTO: apunta a otro sistema o versión" : /debug|verbose|log|mock|sandbox/i.test(k) ? "ESPERABLE: flags de entorno" : "bajo"
}));
return ok({ comparacion: origen + " vs " + destino, capturados: { origen: a.ts, destino: b.ts }, claves_totales: { origen: ka.size, destino: kb.size }, solo_en_origen: soloA, solo_en_destino: soloB, valores_divergentes: divergentes, resumen: { total_diferencias: soloA.length + soloB.length + divergentes.length, altas: divergentes.filter(d => d.riesgo.startsWith("ALTO")).length }, veredicto: soloA.length + soloB.length + divergentes.length === 0 ? "entornos alineados: despliega con confianza" : soloA.length + soloB.length > 5 ? "drift GRAVE: más de 5 diferencias estructurales, reconcilia antes de desplegar" : "drift presente: revisa las claves marcadas ALTO antes de desplegar" });`,
      },
      {
        name: "watch_drift",
        desc: "Compara la última captura de cada entorno y vigila el empeoramiento del drift.",
        params: {},
        code: `const st = store.load();
const entornos = st.entornos || {};
if (st.entornos.length < 2) return fail("necesitas al menos 2 entornos capturados");
const nombres = [...new Set(st.entornos.map(e => e.nombre))];
const pares = [];
for (let i = 0; i < nombres.length; i++) {
  for (let j = i + 1; j < nombres.length; j++) {
    const a = st.entornos.filter(e => e.nombre === nombres[i]).pop();
    const b = st.entornos.filter(e => e.nombre === nombres[j]).pop();
    const ka = new Set(Object.keys(a.config)), kb = new Set(Object.keys(b.config));
    const diff = [...ka].filter(k => !kb.has(k)).length + [...kb].filter(k => !ka.has(k)).length + [...ka].filter(k => kb.has(k) && JSON.stringify(a.config[k]) !== JSON.stringify(b.config[k])).length;
    const frescura = {};
    frescura[String(nombres[i])] = a.ts;
    frescura[String(nombres[j])] = b.ts;
    pares.push({ par: String(nombres[i]) + " <-> " + String(nombres[j]), diferencias: diff, frescura });
  }
}
const peor = pares.slice().sort((a, b) => b.diferencias - a.diferencias)[0];
st.historialDrift = st.historialDrift || [];
st.historialDrift.push({ ts: new Date().toISOString(), pares: pares.map(p => p.par + ":" + p.diferencias) });
store.save(st);
const tendencia = st.historialDrift.length >= 2 ? pares.map(p => { const prev = st.historialDrift[st.historialDrift.length - 2].pares.find(x => x.startsWith(p.par)); return { par: p.par, antes: prev ? Number(prev.split(":").pop()) : null, ahora: p.diferencias }; }) : null;
return ok({ entornos: nombres, pares, peor_par: peor, tendencia, aviso: peor.diferencias > 10 ? "drift fuera de control en " + peor.par + ": sincroniza YA" : null });`,
      },
    ],
  },
]

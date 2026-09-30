// Pruebas funcionales reales de la Ola 2 (55 servidores nuevos)
// Cada prueba: llama a la tool vía JSON-RPC real y afirma el resultado.
import { spawn } from "node:child_process";
import { join } from "node:path";

const ROOT = "/home/z/my-project/mcp-suite";

function call(server, tool, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [join(ROOT, "servers", `mcp-${server}`, "dist", "index.js")], { stdio: ["pipe", "pipe", "pipe"] });
    let buf = "";
    const id = Math.floor(Math.random() * 100000);
    proc.stdout.on("data", (d) => {
      buf += d.toString();
      for (const line of buf.split("\n")) {
        if (!line.trim()) continue;
        try {
          const m = JSON.parse(line);
          if (m.id === 1) {
            proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
            proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name: tool, arguments: args } }) + "\n");
          } else if (m.id === id) {
            proc.kill();
            resolve(m.result);
          }
        } catch {}
      }
    });
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } }) + "\n");
    setTimeout(() => { proc.kill(); reject(new Error("timeout " + server)); }, 30000);
  });
}

// helpers para componer pasos secuenciales con estado persistente
const paso = [];

const RUN = String(Date.now());
const pruebas = [
  // ── Multi-Agente y Coordinación ──
  ["agent-org-chart", "register_agent", { agent_id: "investigador-1", nombre: "Investigador Principal", rol: "researcher", capacidades: ["busqueda web", "pdf", "sintesis"], nivel_autonomia: 3 }, (r) => r.total_equipo >= 1],
  ["agent-org-chart", "find_by_capability", { capacidad: "pdf" }, (r) => r.coincidencias.some((c) => c.agent_id === "investigador-1")],
  ["agent-org-chart", "org_snapshot", {}, (r) => r.total >= 1 && r.autonomia_media >= 0],
  ["delegation-contracts", "create_contract", { delegador: "orq", delegado: "investigador-1", objetivo: "Investigar competidores de mercado X", criterios_aceptacion: ["tabla de 5 competidores", "fuentes citadas"], presupuesto_tokens: 50000, deadline_horas: 24 }, (r) => r.criterios === 2 && r.estado === "abierto"],
  ["delegation-contracts", "submit_deliverable", (m) => ({ contrato_id: m["delegation-contracts"]?.contrato_id, resumen: "tabla entregada", evidencias: ["tabla.md", "fuentes.json"] }), (r) => r.cobertura_criterios === 1],
  ["delegation-contracts", "contract_stats", {}, (r) => r.total >= 1],
  ["handoff-protocol", "create_handoff", { de: "investigador-1", para: "redactor-1", contexto: "Objetivo: informe de mercado. Ya se decidió usar datos 2025 y estructura por secciones. El cliente pidió tono ejecutivo y máximo 5 páginas.", estado_actual: "investigación completa, falta redactar", pendientes: ["redactar sección 1", "redactar sección 2"], riesgos: ["datos de Q4 sin confirmar"] }, (r) => parseInt(r.calidad_preliminar) >= 60],
  ["handoff-protocol", "handoff_stats", {}, (r) => r.total >= 1],
  ["blackboard-shared", "post", { clave: "research/competidores", contenido: "lista inicial de 3 competidores", autor: "investigador-1", etiquetas: ["research"] }, (r) => r.version >= 1],
  ["blackboard-shared", "claim", { clave: "research/competidores", agente: "investigador-1", ttl_segundos: 300 }, (r) => r.reclamado === true],
  ["blackboard-shared", "claim", { clave: "research/competidores", agente: "otro-agente", ttl_segundos: 300 }, (r) => r.reclamado === false && r.dueño === "investigador-1"],
  ["blackboard-shared", "board_stats", {}, (r) => r.entradas >= 1],
  ["deadlock-detector", "declare_state", { agente: "ag-a", retiene: ["recurso-1"], espera_a: ["ag-b"], tarea: "procesar lote" }, (r) => r.espera_a === 1],
  ["deadlock-detector", "declare_state", { agente: "ag-b", retiene: ["recurso-2"], espera_a: ["ag-a"], tarea: "procesar otro lote" }, (r) => true],
  ["deadlock-detector", "detect", {}, (r) => r.deadlocks >= 1 && r.deadlocked.includes("ag-a") && r.deadlocked.includes("ag-b")],
  ["conflict-resolver", "record_decision", { asunto: "stack/" + RUN, agente: "ag-a", decision: "usar react con typescript" }, (r) => r.conflicto === false],
  ["conflict-resolver", "record_decision", { asunto: "stack/" + RUN, agente: "ag-b", decision: "usar vue con options api" }, (r) => r.conflicto === true],
  ["conflict-resolver", "duplication_check", { tareas: [{ agente: "a", descripcion: "buscar lista de competidores del mercado X con precios" }, { agente: "b", descripcion: "buscar competidores del mercado X con lista de precios" }] }, (r) => r.duplicados_detectados >= 1],
  ["quorum-coordinator", "open_vote", { pregunta: "¿Aprobamos el plan de migración?", opciones: ["go", "no-go", "replan"], quorum: 2, timeout_minutos: 60 }, (r) => r.opciones.length === 3],
  ["quorum-coordinator", "cast_vote", (m) => ({ votacion_id: m["quorum-coordinator"]?.votacion_id, agente: "ag-a", opcion: "go", razon: "riesgo controlado" }), (r) => r.faltan_para_quorum === 1],
  ["agent-supervisor", "spawn_registration", { sub_agente: "sub-1", tarea: "extraer datos de 20 PDFs", presupuesto_tokens: 100000, deadline_minutos: 60 }, (r) => r.estado === "corriendo"],
  ["agent-supervisor", "check_in", { sub_agente: "sub-1", progreso_pct: 40, tokens_delta: 12000 }, (r) => r.directiva === "SEGUIR" && r.tokens_usados === 12000],
  ["agent-supervisor", "supervision_dashboard", {}, (r) => r.registrados >= 1],

  // ── Objetivos y Largo Plazo ──
  ["goal-contract", "close_goal", { veredicto: "reemplazado", notas: "test" }, (r) => true],
  ["goal-contract", "declare_goal", { enunciado: "Publicar informe trimestral de mercado con datos verificados", criterios_exito: ["5 secciones completas", "todas las cifras con fuente", "revisado por humano"], restricciones: ["no inventar datos"], horizonte_dias: 14 }, (r) => r.criterios >= 3],
  ["goal-contract", "check_alignment", { propuesta: "redactar las 5 secciones del informe trimestral con las cifras verificadas" }, (r) => r.alineamiento > 0.3 && !r.veredicto.startsWith("desalineado")],
  ["drift-detector", "set_reference", { encargo: "crear landing page para el producto X con formulario de contacto" }, (r) => r.referencia_fijada === true],
  ["drift-detector", "log_decision", { decision: "diseñar la landing page con hero section y formulario", justificacion: "el encargo pide landing page con formulario" }, (r) => r.deriva_individual < 0.7],
  ["drift-detector", "drift_report", {}, (r) => r.decisiones >= 1],
  ["commitment-ledger", "make_commitment", { que: "entregar borrador del informe", para_quien: "cliente", deadline: "en 48h", prioridad: "alta" }, (r) => r.horas_restantes > 40],
  ["commitment-ledger", "list_commitments", { solo_abiertos: true }, (r) => r.total >= 1 && r.vencidos === 0],
  ["scope-guard", "define_scope", { incluye: ["página de precios", "formulario contacto"], excluye: ["rediseño del logo", "refactor del backend"] }, (r) => r.excluye === 2],
  ["scope-guard", "check_task", { tarea: "refactorizar el backend de pagos entero" }, (r) => r.veredicto.startsWith("FUERA")],
  ["time-horizon-planner", "plan_task", { tarea: "maquetar página de precios", horizonte: "hoy", esfuerzo_horas: 3 }, (r) => r.horizonte === "hoy"],
  ["time-horizon-planner", "horizon_view", {}, (r) => r.carga.hoy.tareas >= 1],
  ["progress-journal", "add_entry", { tipo: "progreso", titulo: "maqueta inicial", detalle: "se montó el layout base con grid y tipografía" }, (r) => r.entrada_n >= 1],
  ["progress-journal", "experiments_recap", {}, (r) => r.experimentos >= 0],
  ["mission-checkpoint", "start_mission", { mision: "migración de datos Q4", fases: ["extracción", "limpieza", "carga", "verificación"] }, (r) => r.fases === 4],
  ["mission-checkpoint", "checkpoint", (m) => ({ mision_id: m["mission-checkpoint"]?.mision_id, fase: "extracción", estado: { registros: 12500, tablas: 8 }, reanudar_en: "limpieza: deduplicar por email", criterios_validados: ["volumen extraído correcto"] }), (r) => r.checkpoint >= 1],

  // ── Especificación y Requisitos ──
  ["spec-clarifier", "analyze_spec", { spec: "Haz un dashboard bonito y rápido que sea fácil de usar y muy escalable para muchos usuarios" }, (r) => r.total_hallazgos >= 3 && parseInt(r.claridad_score) < 80],
  ["spec-clarifier", "generate_questions", { spec: "crea una api que integre con el crm" }, (r) => r.preguntas_bloqueantes.length >= 1],
  ["spec-clarifier", "contradiction_check", { requisitos: ["debe ser simple y minimal", "debe ser completo y cubrir todos los casos de uso del sistema"] }, (r) => r.contradicciones >= 1],
  ["spec-clarifier", "nfr_checklist", { spec: "crea una página web de precios" }, (r) => r.omitidos.some((o) => ["rendimiento", "seguridad", "privacidad_datos"].includes(o.nfr))],
  ["acceptance-criteria", "add_requirement", { requerimiento: "La página mostrará el precio total con impuestos incluidos", prioridad: "must" }, (r) => r.criterios_borrador === 3],
  ["definition-of-done", "get_templates", {}, (r) => r.tipos.length === 5 && r.plantillas.codigo.length >= 5],
  ["spec-diff-impact", "save_version", { requisitos: ["landing con hero", "formulario de contacto", "blog con 3 posts"], version_label: "v1" }, (r) => r.requisitos === 3],
  ["spec-diff-impact", "save_version", { requisitos: ["landing con hero", "formulario de contacto", "galería de imágenes"], version_label: "v2-cambio" }, (r) => r.diff.añadidos.length >= 1 && r.diff.eliminados.length >= 1],
  ["requirements-matrix", "add_requirement", { requisito: "el checkout debe funcionar sin JavaScript", fuente: "cliente, reunión lunes" }, (r) => r.requisito_id.startsWith("R")],

  // ── Evaluación Continua ──
  ["golden-set", "create_suite", { nombre: "suite-respuestas-v" + Date.now(), descripcion: "mide tono y completitud" }, (r) => r.suite && r.vacia === true],
  ["regression-harness", "set_probes", { probes: ["¿qué servicios ofrecen?", "¿cuánto cuesta?", "¿dónde están ubicados?"] }, (r) => r.probes_fijadas === 3],
  ["regression-harness", "record_run", { cambio: "system prompt v2 con tono formal", respuestas: ["Ofrecemos consultoría de datos y análisis de mercado con equipos senior.", "El costo depende del alcance: desde 2000 USD mensuales.", "Operamos desde Quito con clientes en toda Latinoamérica."], marcar_baseline: true }, (r) => r.run >= 1],
  ["prompt-ab-test", "create_experiment", { nombre: "tono-exp-" + Date.now(), hipotesis: "el prompt con ejemplo mejora el formato", metrica: "sigue_formato" }, (r) => r.metrica === "sigue_formato"],
  ["quality-drift-monitor", "record_score", { score: 95, etiqueta: "respuestas" }, (r) => r.puntos >= 1],
  ["quality-drift-monitor", "record_score", { score: 93, etiqueta: "respuestas" }, (r) => true],
  ["quality-drift-monitor", "record_score", { score: 90, etiqueta: "respuestas" }, (r) => true],
  ["quality-drift-monitor", "record_score", { score: 88, etiqueta: "respuestas" }, (r) => true],
  ["quality-drift-monitor", "record_score", { score: 84, etiqueta: "respuestas" }, (r) => true],
  ["quality-drift-monitor", "record_score", { score: 80, etiqueta: "respuestas" }, (r) => true],
  ["quality-drift-monitor", "trend", { etiqueta: "respuestas" }, (r) => r.pendiente_por_semana < 0],
  ["scenario-simulator", "list_categories", {}, (r) => r.categorias.length === 5],
  ["failure-tagger", "tag_failure", { titulo: "alucinó una API inexistente", tipo: "alucion", descripcion: "citó endpoint /api/v3/users que no existe en el sistema", causa_probable: "no verificó contra la documentación real", severidad: "alta" }, (r) => r.severidad === "alta"],

  // ── Economía del Agente ──
  ["spend-envelope", "create_envelope", { nombre: "mision-informe-" + Date.now(), techo_usd: 10, umbral_aviso_pct: 50, politica: "pedir_autorizacion" }, (r) => r.techo === 10],
  ["spend-envelope", "spend", (m) => ({ sobre: m["spend-envelope"]?.sobre, concepto: "llm análisis", usd: 6 }), (r) => r.directiva.startsWith("AVISO")],
  ["task-roi", "log_task", { tarea: "extracción de 200 PDFs", valor_usd: 50, costo_usd: 5, tokens: 120000, minutos: 40, categoria: "datos" }, (r) => parseFloat(r.roi) >= 9],
  ["token-audit", "log_usage", { interaccion: "test-1", system: 800, historial: 1500, retrieval: 900, tools_entrada: 3000, output: 400, overhead: 100 }, (r) => r.total === 6700],
  ["token-audit", "audit_report", {}, (r) => r.interacciones >= 1 && r.reparto_pct.tools_entrada > 40],
  ["model-router-econ", "register_model", { modelo: "mini-barato", costo_entrada_1m: 0.15, costo_salida_1m: 0.6, tier: 1 }, (r) => r.tier === 1],
  ["model-router-econ", "register_model", { modelo: "frontier-pro", costo_entrada_1m: 15, costo_salida_1m: 75, tier: 4 }, (r) => true],
  ["model-router-econ", "route", { tarea: "clasifica si el email es spam o no", tokens_estimados: 1000 }, (r) => r.tier_requerido === 1 && r.elegido === "mini-barato"],
  ["budget-forecast", "log_daily_spend", { usd: 3.2 }, (r) => r.gasto_dia > 0],
  ["cost-attribution", "tag_spend", { cliente: "acme", proyecto: "migración", agente: "orq", concepto: "llm", usd: 1.5 }, (r) => r.usd === 1.5],

  // ── Computer Use ──
  ["dom-baseline", "save_snapshot", { pagina: "checkout", flujo: "compra", elementos: [{ selector: "#btn-pay", texto: "Pagar ahora", tipo: "button" }, { selector: "#email", texto: "", tipo: "input" }] }, (r) => r.elementos === 2],
  ["dom-baseline", "diff_page", { pagina: "checkout", flujo: "compra", elementos_actuales: [{ selector: "#email", texto: "" }] }, (r) => r.desaparecidos.includes("#btn-pay") && r.criticos_para_el_flujo.length >= 1],
  ["selector-healer", "register_selector", { nombre: "boton_enviar", selector: "#submit-btn", texto_visible: "Enviar formulario", pagina: "contacto" }, (r) => r.registrado === true],
  ["selector-healer", "heal", { nombre: "boton_enviar", candidatos: [{ selector: "#btn-submit", texto: "Enviar formulario", atributos: { type: "submit" } }, { selector: "#nav-home", texto: "Inicio", atributos: {} }] }, (r) => r.mejor_candidato.selector === "#btn-submit" && r.confianza.includes("ALTA")],
  ["action-recorder", "create_flow", { nombre: "login-" + Date.now(), objetivo: "iniciar sesión y llegar al panel" }, (r) => r.pasos === 0],
  ["checkpoint-undo", "gate_action", { accion: "borrar todos los registros de la tabla users", contexto: "panel de administración" }, (r) => r.nivel === "destructivo" && r.procede === false],
  ["viewport-verifier", "assert_page_ready", { texto_o_estado: "CARGANDO... por favor espere mientras procesamos su solicitud" }, (r) => r.estado.startsWith("OCUPADO")],
  ["viewport-verifier", "observed_report", { suposicion: "el email se envió correctamente al destinatario", observado: "pantalla de error 500: algo salió mal" }, (r) => r.coincidencia < 0.3],

  // ── Aprendizaje de Habilidades ──
  ["postmortem-engine", "start_postmortem", { titulo: "flujo de checkout roto", severidad: "alta", que_paso: "el flujo falló al validar el cupón porque la API devolvía null" }, (r) => r.secciones_pendientes === 4],
  ["lesson-library", "add_lesson", { situacion: "antes de parsear JSON de APIs externas", regla: "valida el Content-Type y haz try/catch del parseo antes de usar el resultado (" + RUN + ")", etiquetas: ["json", "apis"], origen: "postmortem" }, (r) => r.total >= 1],
  ["lesson-library", "recall_lessons", { situacion_actual: "voy a parsear el JSON que devuelve la API de pagos" }, (r) => r.relevantes >= 1],
  ["mistake-patterns", "log_mistake", { contexto: "parseo de respuesta de API externa", descripcion: "no validé que el JSON viniera completo antes de parsearlo" }, (r) => r.error_n >= 1],
  ["mistake-patterns", "log_mistake", { contexto: "parseo de respuesta de API externa", descripcion: "no validé el JSON de la API externa antes de parsearlo" }, (r) => true],
  ["mistake-patterns", "same_mistake_check", { accion_prevista: "parsear el JSON de la API externa" }, (r) => r.fallos_previos_similares >= 1],
  ["skill-forge", "forge_skill", { nombre: "deploy-seguro-" + Date.now(), proposito: "desplegar sin romper producción", pasos: ["verificar tests verdes", "backup de base de datos", "deploy canario al 5%", "monitorear errores 30min", "escalar al 100%"], precondiciones: ["CI verde", "backup verificable"], trampas: ["no deployear viernes tarde"], criterio_exito: "error rate < 1% tras 30 min" }, (r) => r.pasos === 5],
  ["competency-tracker", "define_competency", { nombre: "sql-consultas-" + RUN, area: "datos", como_se_mide: "la consulta devuelve lo esperado sin errores de sintaxis" }, (r) => r.area === "datos"],

  // ── Humano en el Bucle ──
  ["interruption-broker", "interrupt", { razon: "cambio de prioridad: el cliente necesita otra cosa antes", tarea_en_curso: "redactar sección 2 del informe", paso_actual: "recopilando fuentes", siguiente_accion_prevista: "escribir borrador de sección 2" }, (r) => r.snapshot_preservado === true],
  ["interruption-broker", "pending_interruptions", {}, (r) => r.activas >= 1],
  ["takeover-request", "request_takeover", { situacion: "el proveedor A exige contrato firmado antes de darnos acceso a la API", intentado: ["contactar por email", "buscar API alternativa"], punto_decision: "firmar contrato legal con penalización de 12 meses o cambiar de proveedor", opciones: ["firmar y bloquear 12 meses", "cambiar a proveedor B más caro sin contrato"], pregunta_al_humano: "¿Firmamos el contrato del proveedor A?", urgencia: "alta" }, (r) => r.paquete_para_el_humano.length >= 5],
  ["trust-calibrator", "set_trust", { dominio: "sql-lectura", nivel: 3, justificacion: "100 consultas exitosas en producción" }, (r) => r.nivel === 3],
  ["escalation-policy", "add_rule", { nombre: "error-repetido-" + Date.now(), condicion: "error 3 veces seguidas", accion: "preguntar_humano", cooldown_minutos: 60 }, (r) => r.accion === "preguntar_humano"],
  ["explain-decision", "record_decision", { decision: "usar la API del proveedor B", situacion: "proveedor A exige contrato de 12 meses", evidencia: ["contrato A requiere penalización", "proveedor B es 20% más caro", "B no exige contrato"], opciones_consideradas: ["firmar con A", "usar B sin contrato"], criterio: "minimizar compromiso legal sin multiplicar costo > 2x", elegida_porque: "B evita el lock-in y el sobrecosto es tolerable", resultado_esperado: "operatividad en 48h sin compromiso" }, (r) => r.registrada === true],

  // ── Frescura y Cumplimiento ──
  ["fact-staleness", "register_fact", { hecho: "el plan Pro de la competencia cuesta", valor: "$29/mes", clase: "precio", fuente: "página web oficial", observado: new Date().toISOString() }, (r) => r.vida_media_dias === 7],
  ["fact-staleness", "assert_usable", (m) => ({ id: m["fact-staleness"]?.id }), (r) => r.utilizable === true],
  ["source-timeline", "add_event", { fuente: "informe alpha", fecha: "2026-06-01", afirmacion: "las ventas de la categoría subieron 20% en el trimestre", tema: "ventas" }, (r) => true],
  ["source-timeline", "add_event", { fuente: "informe beta", fecha: "2026-09-01", afirmacion: "las ventas de la categoría no subieron, cayeron 5% al revisar los datos", tema: "ventas" }, (r) => true],
  ["source-timeline", "contradiction_scan", {}, (r) => r.contradicciones >= 1],
  ["deadline-engine", "add_deadline", { item: "entregar propuesta al cliente ACME", deadline: "en 72h", peso: "critico", esfuerzo_horas: 6 }, (r) => r.horas_restantes > 70],
  ["deadline-engine", "priority_queue", {}, (r) => r.pendientes >= 1],
  ["temporal-reasoner", "check_sequence", { eventos: [{ etiqueta: "deploy del lunes", fecha: "2026-01-05" }, { etiqueta: "fix del bug", fecha: "2026-01-02" }] }, (r) => r.secuencia_posible === false && r.violaciones.length === 1],
  ["temporal-reasoner", "relative_time", { expresion: "hace 3 dias" }, (r) => r.absoluto && r.dias_delta === -3],
  ["policy-as-code", "add_policy", { nombre: "pii-externo-" + Date.now(), descripcion: "prohíbe enviar PII fuera", condicion: "datos=pii y destino=externo", veredicto: "negar", marco: "gdpr" }, (r) => r.veredicto === "negar"],
  ["policy-as-code", "evaluate_action", { accion: "enviar la lista de clientes a la API externa", atributos: { datos: "pii", destino: "externo" } }, (r) => r.veredicto === "negar"],
  ["data-residency-check", "register_destination", { destino: "api-europea", jurisdiccion: "EU", regiones: ["eu-west-1"] }, (r) => r.jurisdiccion === "EU"],
  ["data-residency-check", "check_transfer", { dato: "salud", restriccion: "solo_ue", destino: "api-europea" }, (r) => r.permitido === true],
  ["consent-ledger", "record_consent", { titular: "usr-8471", propositos: ["analitica"], vigencia_meses: 12, base_legal: "consentimiento" }, (r) => r.propositos === 1],
  ["consent-ledger", "verify_use", { titular: "usr-8471", proposito: "analitica" }, (r) => r.amparado === true],
  ["consent-ledger", "verify_use", { titular: "usr-8471", proposito: "marketing" }, (r) => r.amparado === false],
  ["compliance-report", "define_control", { marco: "gdpr", control_id: "Art.32-" + RUN, exige: "seguridad del tratamiento: cifrado en tránsito y reposo", como_se_cumple: "TLS 1.3 en todas las APIs y AES-256 en almacenamiento" }, (r) => r.estado === "declarado"],
];

let pass = 0, fail = 0;
const fallos = [];
const mem = {};
for (const [server, tool, args, check] of pruebas) {
  const argsReales = typeof args === "function" ? args(mem) : args;
  try {
    const r = await call(server, tool, argsReales);
    const text = r?.content?.[0]?.text || "{}";
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    const ok = (() => { try { return check(data); } catch { return false; } })();
    if (ok) { pass++; mem[server] = data; }
    else { fail++; fallos.push(`${server}.${tool} → ${text.slice(0, 180)}`); }
  } catch (e) {
    fail++;
    fallos.push(`${server}.${tool} → ERROR ${e.message}`);
  }
}
for (const f of fallos) console.log("✗ " + f);
console.log(`\n${fail === 0 ? "✔" : "✗"} PRUEBAS FUNCIONALES OLA 2: ${pass}/${pruebas.length} exitosas`);
process.exit(fail === 0 ? 0 : 1);

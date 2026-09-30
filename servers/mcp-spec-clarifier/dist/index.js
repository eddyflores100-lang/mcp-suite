#!/usr/bin/env node
/**
 * MCP Server: Spec Clarifier
 * Detecta ambigüedad en especificaciones y genera las preguntas de clarificación correctas
 *
 * Dolor que resuelve: El humano escribe specs vagas ('hazlo bonito', 'mejora el rendimiento') y el agente adivina. La causa raíz #1 de fallo multi-agente es la ambigüedad de especificación, no la infraestructura.
 * Categoría: Especificación y Requisitos | Generado por mcp-suite | id: spec-clarifier
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// ——— helpers de respuesta ———
function ok(data) {
    return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg) {
    return { content: [{ type: "text", text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o) { return Object.values(o); }
function __ents(o) { return Object.entries(o); }
const server = new McpServer({ name: "spec-clarifier", version: "1.0.0" });
server.tool("analyze_spec", "Analiza una especificación y devuelve ambigüedades concretas clasificadas (vaguedad, cuantificación, referencia, contradicción) y score de claridad.", {
    spec: z.string().describe("Texto de la especificación"),
}, async (args) => {
    const { spec } = args;
    const VAGOS = ["bonito", "rápido", "rapido", "mejor", "mejorar", "óptimo", "optimo", "adecuado", "apropiado", "moderno", "robusto", "escalable", "eficiente", "user-friendly", "sencilillo", "sencillo", "ligero", "flexible", "potente", "genérico", "generico", "intuitivo", "nítido", "nítido"];
    const INTENSIFICADORES = ["muy", "bastante", "algo", "quizá", "quizas", "tal vez", "más o menos", "mas o menos", "lo más posible", "lo mejor posible", "eventualmente", "idealmente", "si es posible", "cuando puedas"];
    const hallazgos = [];
    const texto = spec;
    const bajo = texto.toLowerCase();
    for (const v of VAGOS) {
        let idx = bajo.indexOf(v);
        while (idx !== -1) {
            hallazgos.push({ tipo: "vaguedad", palabra: v, contexto: texto.slice(Math.max(0, idx - 40), idx + v.length + 40), fix: "define operacionalmente: ¿cómo se MIDE que es '" + v + "'?" });
            idx = bajo.indexOf(v, idx + 1);
            if (hallazgos.filter(h => h.palabra === v).length >= 3)
                break;
        }
    }
    for (const i of INTENSIFICADORES)
        if (bajo.includes(i))
            hallazgos.push({ tipo: "intensificador_blando", palabra: i, fix: "sustituye por umbral concreto (número, %, segundos)" });
    const CUANTIFICABLES = ["debe ser", "tiene que ser", "necesita", "requiere", "soporta", "máximo", "maximo", "mínimo", "minimo", "al menos", "hasta", "límite", "limite", "tiempo", "usuarios", "concurrente", "latencia"];
    let sinNumero = 0;
    for (const c of CUANTIFICABLES) {
        let idx = bajo.indexOf(c);
        while (idx !== -1) {
            const ventana = texto.slice(idx, idx + 80);
            if (!/\d/.test(ventana)) {
                sinNumero++;
                hallazgos.push({ tipo: "cuantificacion_ausente", palabra: c, contexto: ventana.slice(0, 70), fix: "añade la cifra: '" + c + "' sin número no es verificable" });
                break;
            }
            idx = bajo.indexOf(c, idx + 1);
        }
    }
    const articulos = texto.match(/\b(el|la|los|las|este|esta|eso|esa)\s+\w+/gi) || [];
    const referencias = articulos.filter(a => {
        const sust = a.split(/\s+/)[1].toLowerCase();
        return !["sistema", "usuario", "usuarios", "agente", "proyecto", "cliente", "datos", "servicio", "aplicacion", "aplicación"].includes(sust) && (texto.toLowerCase().split(/\s+/).filter(w => w === sust).length === 1);
    }).slice(0, 5);
    for (const r of referencias)
        hallazgos.push({ tipo: "referencia_ambigua", palabra: r, fix: "'" + r + "' aparece una sola vez: ¿a qué se refiere exactamente?" });
    const score = Math.max(0, 100 - hallazgos.length * 7 - sinNumero * 4);
    return ok({
        claridad_score: score + "/100",
        total_hallazgos: hallazgos.length,
        por_tipo: hallazgos.reduce((acc, h) => { acc[h.tipo] = (acc[h.tipo] || 0) + 1; return acc; }, {}),
        hallazgos: hallazgos.slice(0, 15),
        veredicto: score >= 80 ? "especificación operable" : score >= 50 ? "ambigüedad media: clarifica antes de construir" : "demasiado ambigua: NO construyas todavía, pregunta primero",
    });
});
server.tool("generate_questions", "Genera la lista de preguntas de clarificación priorizadas (bloqueantes primero) listas para enviar al humano.", {
    spec: z.string().describe("Especificación original"),
    max_preguntas: z.number().describe("Límite de preguntas").default(8),
}, async (args) => {
    const { spec, max_preguntas } = args;
    const PLANTILLAS = [
        { cond: (s) => /(crear|hacer|construir|desarrollar)\b/i.test(s), q: "¿Qué EXACTAMENTE incluye el resultado y qué queda explícitamente fuera?" },
        { cond: (s) => /(usuario|cliente|audiencia)/i.test(s), q: "¿Quién es el usuario objetivo y cuál es su nivel técnico?" },
        { cond: (s) => /(rápido|rapido|rendimiento|latencia|velocidad)/i.test(s), q: "¿Qué cifra concreta de rendimiento es aceptable (ej: <200ms p95)?" },
        { cond: (s) => /(formato|estilo|diseño|bonito)/i.test(s), q: "¿Hay un ejemplo visual o referencia que pueda imitar?" },
        { cond: (s) => /(integr|conect|api)/i.test(s), q: "¿Qué sistemas hay que integrar y con qué prioridad?" },
        { cond: (s) => /(seguridad|privacidad|datos)/i.test(s), q: "¿Qué datos son sensibles y qué nivel de protección exige el contexto?" },
        { cond: (s) => /(deadline|plazo|fecha|urgente)/i.test(s), q: "¿Cuál es la fecha límite dura y qué se sacrifica si no llega (calidad o alcance)?" },
        { cond: (s) => /(escala|crecimiento|futuro)/i.test(s), q: "¿Para qué volumen debe funcionar el día 1 y en 6 meses?" },
    ];
    const base = PLANTILLAS.filter(p => p.cond(spec)).map(p => p.q);
    const genericas = [
        "¿Cómo se verifica que el resultado es correcto? Dame 1-2 ejemplos de entrada→salida esperada.",
        "Si dos requisitos chocan, ¿cuál gana?",
        "¿Qué pasa si esto falla en producción: cuál es el peor escenario aceptable?",
    ];
    const preguntas = [...base, ...genericas].slice(0, Math.max(1, Math.min(max_preguntas, 10)));
    return ok({
        preguntas_bloqueantes: preguntas.slice(0, Math.ceil(preguntas.length / 2)),
        preguntas_importantes: preguntas.slice(Math.ceil(preguntas.length / 2)),
        protocolo: "envía las bloqueantes primero: no empieces hasta tener respuesta",
    });
});
server.tool("operationalize", "Convierte una frase vaga en una definición operacional medible (plantillas por tipo de vaguedad).", {
    frase: z.string().describe("Frase vaga (ej: 'debe ser rápido')"),
    dominio: z.string().describe("Contexto (web, api, datos, ux)").optional(),
}, async (args) => {
    const { frase, dominio } = args;
    const f = frase.toLowerCase();
    const MAPA = [
        { pat: /(rápido|rapido|veloz|rendimiento)/, dom: { web: "carga < 2s y TTI < 3s en 4G", api: "p95 < 200ms bajo carga nominal", datos: "query < 500ms en dataset objetivo" }, gen: "latencia p95 < X ms medida con [herramienta] bajo [carga]" },
        { pat: /(bonito|diseño|estético|estetico)/, dom: {}, gen: "se ajusta al design system [X] con contraste AA y sin elementos fuera de grid" },
        { pat: /(seguro|robusto|estable)/, dom: {}, gen: "pasa [lista de casos extremos] sin corromper estado ni filtrar datos" },
        { pat: /(escalable|escala)/, dom: {}, gen: "soporta [N] usuarios concurrentes con degradación lineal < [Y]%" },
        { pat: /(fácil|facil|sencillo|sencilillo|intuitivo)/, dom: {}, gen: "un usuario nuevo completa la tarea en < [N] min sin ayuda (test de [k] usuarios)" },
        { pat: /(completo|exhaustivo)/, dom: {}, gen: "cubre los [N] casos listados en [fuente] y declara explícitamente los excluidos" },
    ];
    for (const m of MAPA) {
        if (m.pat.test(f)) {
            return ok({
                frase_original: frase,
                definicion_operacional: m.dom[dominio || ""] || m.gen,
                como_verificarlo: "define la métrica, el umbral, la herramienta de medida y las condiciones de carga ANTES de construir",
                ejemplo: frase.replace(/debe ser|tiene que ser|que sea/gi, "").trim() + " → medible con umbral y herramienta",
            });
        }
    }
    return ok({ frase_original: frase, definicion_operacional: null, consejo: "patrón no reconocido: define métrica + umbral + herramienta de medida a mano" });
});
server.tool("contradiction_check", "Detecta requisitos contradictorios o incompatibles entre sí dentro de la spec.", {
    requisitos: z.array(z.any()).describe("Lista de requisitos en texto"),
}, async (args) => {
    const { requisitos } = args;
    const reqs = (requisitos || []).map(String).filter(Boolean);
    if (reqs.length < 2)
        return fail("necesitas >=2 requisitos");
    const PARES = [
        { a: /(simple|sencillo|minimal)/i, b: /(completo|exhaustivo|todas las)/i, msg: "simplicidad vs exhaustividad" },
        { a: /(gratis|sin costo|económico)/i, b: /(premium|alta disponibilidad|24\/7)/i, msg: "costo cero vs disponibilidad alta" },
        { a: /(inmediato|ya|mismo día)/i, b: /(revisado|aprobado|verificado|calidad)/i, msg: "inmediatez vs control de calidad" },
        { a: /(privado|confidencial|local)/i, b: /(compartido|público|publico|nube|social)/i, msg: "privacidad vs exposición" },
        { a: /(personalizado|a medida)/i, b: /(estándar|estandar|genérico|generico)/i, msg: "a medida vs estándar" },
        { a: /(automático|automatico|sin intervención)/i, b: /(aprobación|aprobacion|revisión|revision|humano)/i, msg: "autonomía total vs human-in-the-loop" },
    ];
    const choques = [];
    for (let i = 0; i < reqs.length; i++)
        for (let j = i + 1; j < reqs.length; j++) {
            for (const par of PARES) {
                if ((par.a.test(reqs[i]) && par.b.test(reqs[j])) || (par.b.test(reqs[i]) && par.a.test(reqs[j]))) {
                    choques.push({ req_a: reqs[i].slice(0, 90), req_b: reqs[j].slice(0, 90), tension: par.msg, resolucion: "pide prioridad explícita: ¿cuál gana cuando choquen?" });
                }
            }
        }
    return ok({ requisitos: reqs.length, contradicciones: choques.length, choques: choques.slice(0, 8), veredicto: choques.length ? "HAY tensiones sin resolver: aclara prioridades antes de construir" : "sin contradicciones evidentes" });
});
server.tool("nfr_checklist", "Checklist de requisitos no funcionales que la spec omite (rendimiento, seguridad, accesibilidad, datos...).", {
    spec: z.string().describe("Especificación a auditar"),
}, async (args) => {
    const { spec } = args;
    const NFRS = [
        { nombre: "rendimiento", pat: /(rendimiento|latencia|velocidad|rápido|rapido|p95|ms|segundos)/i, pregunta: "¿umbral de latencia/throughput y condiciones de medida?" },
        { nombre: "seguridad", pat: /(seguridad|auth|permiso|token|encript|cifrad)/i, pregunta: "¿quién puede hacer qué y cómo se autentica?" },
        { nombre: "privacidad_datos", pat: /(privacidad|pii|gdpr|datos personales|anonimiz)/i, pregunta: "¿qué datos se guardan, dónde y con qué retención?" },
        { nombre: "accesibilidad", pat: /(accesibilidad|a11y|contraste|lector de pantalla|wcag)/i, pregunta: "¿nivel WCAG objetivo y cómo se verifica?" },
        { nombre: "disponibilidad", pat: /(disponibilidad|uptime|24\/7|sla|redundancia)/i, pregunta: "¿SLA objetivo y comportamiento ante caída?" },
        { nombre: "observabilidad", pat: /(logs|métricas|metricas|monitoreo|monitoriz|trazas|alertas)/i, pregunta: "¿qué se registra y qué alerta dispara?" },
        { nombre: "compatibilidad", pat: /(navegador|móvil|movil|versión|version|compatib|soporta)/i, pregunta: "¿matriz de compatibilidad mínima?" },
        { nombre: "internacionalizacion", pat: /(idioma|i18n|locale|español|inglés|ingles|traducc)/i, pregunta: "¿idiomas soportados y formato de fechas/números?" },
        { nombre: "mantenibilidad", pat: /(tests|cobertura|documentación|documentacion|mantenimiento)/i, pregunta: "¿tests exigidos y documentación mínima?" },
    ];
    const bajo = spec.toLowerCase();
    const omitidos = NFRS.filter(n => !n.pat.test(spec));
    const cubiertos = NFRS.filter(n => n.pat.test(spec));
    return ok({
        cubiertos: cubiertos.map(c => c.nombre),
        omitidos: omitidos.map(o => ({ nfr: o.nombre, pregunta_para_el_humano: o.pregunta })),
        prioridad: omitidos.filter(o => ["seguridad", "privacidad_datos", "rendimiento"].includes(o.nombre)).length > 0 ? "estos NFRs omitidos suelen explotar en producción: pregunta por ellos primero" : "omite NFRs de segundo orden si el plazo aprieta",
    });
});
server.tool("health_check", "Verifica que el servidor spec-clarifier está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "spec-clarifier", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[spec-clarifier] fatal:", e);
    process.exit(1);
});

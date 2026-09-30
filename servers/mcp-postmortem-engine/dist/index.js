#!/usr/bin/env node
/**
 * MCP Server: Postmortem Engine
 * Postmortems estructurados que se convierten en lecciones: convierte cada fallo en activo permanente
 *
 * Dolor que resuelve: Cada fallo del agente genera conversación pero no activo: la lección muere con la sesión y el mismo error vuelve la semana siguiente. Nadie escribe el postmortem porque 'no hay tiempo'.
 * Categoría: Aprendizaje de Habilidades | Generado por mcp-suite | id: postmortem-engine
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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
// ——— persistencia local: ~/.mcp-suite/postmortem-engine/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "postmortem-engine");
const STORE_FILE = join(STORE_DIR, "state.json");
const store = {
    load() {
        try {
            return existsSync(STORE_FILE) ? JSON.parse(readFileSync(STORE_FILE, "utf8")) : {};
        }
        catch {
            return {};
        }
    },
    save(data) {
        mkdirSync(STORE_DIR, { recursive: true });
        writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
        return data;
    },
};
const server = new McpServer({ name: "postmortem-engine", version: "1.0.0" });
server.tool("start_postmortem", "Abre un postmortem por un incidente con el borrador de las 5 secciones obligatorias.", {
    titulo: z.string().describe("Título del incidente"),
    severidad: z.enum(["baja", "media", "alta", "critica"]).describe("Severidad"),
    que_paso: z.string().describe("Narrativa factual de lo ocurrido"),
}, async (args) => {
    const { titulo, severidad, que_paso } = args;
    const st = store.load();
    st.pms = st.pms || [];
    const pm = {
        id: "pm_" + Date.now().toString(36), titulo, severidad,
        secciones: { que_paso, causa_raiz: null, impacto: null, lo_evitaba: null, accion_preventiva: null },
        convertido_leccion: null,
        ts: new Date().toISOString(),
    };
    st.pms.push(pm);
    store.save(st);
    return ok({ postmortem_id: pm.id, secciones_pendientes: 4, recordatorio: "un postmortem sin causa raíz es un relato, no una lección" });
});
server.tool("fill_section", "Completa una sección del postmortem (causa_raiz, impacto, lo_evitaba, accion_preventiva).", {
    postmortem_id: z.string().describe("ID del postmortem"),
    seccion: z.enum(["causa_raiz", "impacto", "lo_evitaba", "accion_preventiva"]).describe("Sección a completar"),
    contenido: z.string().describe("Contenido de la sección"),
}, async (args) => {
    const { postmortem_id, seccion, contenido } = args;
    const st = store.load();
    const pm = (st.pms || []).find(x => x.id === postmortem_id);
    if (!pm)
        return fail("postmortem no encontrado");
    if (seccion === "causa_raiz" && /(?:falló|fallo|error|culpa del sistema|no sé|no se)/i.test(contenido) && contenido.length < 60) {
        return fail("causa raíz vaga: profundiza con 5-whys (¿por qué falló? ¿y por qué era así?)");
    }
    pm.secciones[seccion] = contenido;
    store.save(st);
    const pendientes = __ents(pm.secciones).filter(([, v]) => !v).map(([k]) => k);
    return ok({ postmortem: pm.id, completadas: 5 - pendientes.length, pendientes });
});
server.tool("review_postmortem", "Audita la calidad del postmortem: completitud, especificidad y accionabilidad de la causa raíz.", {
    postmortem_id: z.string().describe("ID del postmortem"),
}, async (args) => {
    const { postmortem_id } = args;
    const st = store.load();
    const pm = (st.pms || []).find(x => x.id === postmortem_id);
    if (!pm)
        return fail("postmortem no encontrado");
    const s = pm.secciones;
    const problemas = [];
    for (const [k, v] of __ents(s))
        if (!v)
            problemas.push("falta sección " + k);
    if (s.causa_raiz && s.causa_raiz.length < 40)
        problemas.push("causa raíz demasiado corta");
    if (s.accion_preventiva && !/\b(verificar|añadir|cambiar|añadir|registrar|check|test|alerta|umbral)\b/i.test(s.accion_preventiva))
        problemas.push("acción preventiva no es verificable: usa verbos accionables");
    const score = Math.max(0, 100 - problemas.length * 20);
    return ok({
        score_calidad: score + "/100",
        problemas,
        veredicto: score === 100 ? "postmortem de calidad: conviértelo en lección" : "incompleto o blando: complétalo antes de archivar",
    });
});
server.tool("convert_to_lesson", "Convierte el postmortem en lección (formato situación→regla) lista para lesson-library.", {
    postmortem_id: z.string().describe("ID del postmortem"),
    aplicable_cuando: z.string().describe("Situación futura en que aplica la lección"),
}, async (args) => {
    const { postmortem_id, aplicable_cuando } = args;
    const st = store.load();
    const pm = (st.pms || []).find(x => x.id === postmortem_id);
    if (!pm)
        return fail("postmortem no encontrado");
    const pendientes = __ents(pm.secciones).filter(([, v]) => !v).map(([k]) => k);
    if (pendientes.length)
        return fail("postmortem incompleto (" + pendientes.join(", ") + "): complétalo primero");
    pm.convertido_leccion = {
        situacion: aplicable_cuando || pm.secciones.que_paso.slice(0, 120),
        regla: "Cuando " + (aplicable_cuando || "esta situación") + ", entonces: " + pm.secciones.accion_preventiva,
        causa_raiz: pm.secciones.causa_raiz,
        origen: pm.id,
        ts: new Date().toISOString(),
    };
    store.save(st);
    return ok({ leccion_generada: pm.convertido_leccion.regla, siguiente: "regístrala en lesson-library para que la encuentre el agente" });
});
server.tool("postmortem_stats", "Estadísticas: incidentes documentados, tasa de conversión a lección y severidad dominante.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const pms = st.pms || [];
    if (!pms.length)
        return ok({ postmortems: 0 });
    const convertidos = pms.filter(p => p.convertido_leccion).length;
    const porSev = {};
    for (const p of pms)
        porSev[p.severidad] = (porSev[p.severidad] || 0) + 1;
    return ok({
        postmortems: pms.length,
        convertidos_a_leccion: convertidos,
        tasa_conversion: Number((convertidos / pms.length).toFixed(2)),
        por_severidad: porSev,
        sin_convertir: pms.filter(p => !p.convertido_leccion).map(p => p.titulo),
        veredicto: convertidos / pms.length < 0.5 ? "más de la mitad de los fallos no dejó lección: conocimiento que se evapora" : "buen ratio de aprendizaje",
    });
});
server.tool("health_check", "Verifica que el servidor postmortem-engine está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "postmortem-engine", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[postmortem-engine] fatal:", e);
    process.exit(1);
});

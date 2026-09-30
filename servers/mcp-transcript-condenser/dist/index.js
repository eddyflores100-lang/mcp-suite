#!/usr/bin/env node
/**
 * MCP Server: Transcript Condenser
 * Condensa transcripciones de voz interminables: conserva decisiones, acciones y compromisos; tira la paja
 *
 * Dolor que resuelve: Una reunión de 90 minutos genera 12.000 tokens de transcript con 'eh', saludos y divagaciones: el agente lo traga entero, infla el contexto y aún así se le escapa el único compromiso que se tomó.
 * Categoría: Multimodal & Voz | Generado por mcp-suite | id: transcript-condenser
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
// ——— persistencia local: ~/.mcp-suite/transcript-condenser/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "transcript-condenser");
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
const server = new McpServer({ name: "transcript-condenser", version: "1.0.0" });
server.tool("ingest_transcript", "Ingiere un transcript con hablantes y segmentos temporales.", {
    sesion: z.string().describe("Nombre de la sesión/reunión"),
    segmentos: z.array(z.any()).describe("Segmentos {hablante, texto, ts?}"),
}, async (args) => {
    const { sesion, segmentos } = args;
    const st = store.load();
    st.sesiones = st.sesiones || {};
    const limpios = (segmentos || []).filter(s => s && s.texto).map(s => ({ hablante: String(s.hablante || "desconocido"), texto: String(s.texto).trim(), ts: s.ts ? String(s.ts) : null }));
    if (!limpios.length)
        return fail("sin segmentos con texto");
    st.sesiones[sesion] = { sesion, segmentos: limpios, ingerido: new Date().toISOString(), condensado: null };
    store.save(st);
    return ok({ sesion, segmentos: limpios.length, hablantes: [...new Set(limpios.map(s => s.hablante))], caracteres: limpios.reduce((a, s) => a + s.texto.length, 0), siguiente: "condensa con condense" });
});
server.tool("condense", "Condensa el transcript: clasifica cada segmento y conserva textualmente solo lo accionable.", {
    sesion: z.string().describe("Sesión a condensar"),
}, async (args) => {
    const { sesion } = args;
    const st = store.load();
    const s = (st.sesiones || {})[sesion];
    if (!s)
        return fail("sesión no encontrada: " + sesion);
    if (!s.segmentos.length)
        return fail("sesión vacía");
    const es = {
        decision: /\b(acordamos|decidimos|se decide|queda decidido|aprobamos|conclusión|resolvemos|se aprueba)\b/i,
        accion: /\b(voy a |vas a |vamos a |debería|hay que|queda pendiente|encárgate|envía|prepara|revisa|haz |me ocupo|te encargas|para el (lunes|martes|miércoles|jueves|viernes)|antes del)\b/i,
        compromiso: /\b(me comprometo|prometo|garantizo|aseguro|quedo encargado|será entregado|lo entrego|confirmo)\b/i,
        pregunta: /\?|\b(puedes|podrías|qué te parece|estás de acuerdo|lo ves)\b/i,
        ruido: /^(eh|em|mhm|sí|no|ok|okay|vale|claro|bueno|ya|ajá)[.!?]?$/i
    };
    const clasificados = s.segmentos.map((seg, i) => {
        let tipo = "contexto";
        if (es.ruido.test(seg.texto))
            tipo = "ruido";
        else if (es.decision.test(seg.texto))
            tipo = "decision";
        else if (es.compromiso.test(seg.texto))
            tipo = "compromiso";
        else if (es.accion.test(seg.texto))
            tipo = "accion";
        else if (es.pregunta.test(seg.texto))
            tipo = "pregunta";
        return { idx: i, hablante: seg.hablante, texto: seg.texto, tipo, ts: seg.ts };
    });
    const accionables = clasificados.filter(c => ["decision", "accion", "compromiso"].includes(c.tipo));
    const preguntasAbiertas = clasificados.filter(c => c.tipo === "pregunta").slice(0, 8);
    const contexto = clasificados.filter(c => c.tipo === "contexto");
    const ruido = clasificados.filter(c => c.tipo === "ruido");
    const caracteresOriginales = s.segmentos.reduce((a, x) => a + x.texto.length, 0);
    const caracteresCondensados = accionables.reduce((a, x) => a + x.texto.length, 0);
    s.condensado = { ts: new Date().toISOString(), accionables, preguntas: preguntasAbiertas, reduccion: caracteresOriginales > 0 ? Number((100 - caracteresCondensados / caracteresOriginales * 100).toFixed(0)) + "%" : "n/a" };
    store.save(st);
    return ok({ sesion, segmentos_totales: clasificados.length, clasificacion: { decision: clasificados.filter(c => c.tipo === "decision").length, accion: clasificados.filter(c => c.tipo === "accion").length, compromiso: clasificados.filter(c => c.tipo === "compromiso").length, pregunta: clasificados.filter(c => c.tipo === "pregunta").length, contexto: contexto.length, ruido: ruido.length }, conservados_textuales: accionables, preguntas_relevantes: preguntasAbiertas.map(q => ({ quien: q.hablante, pregunta: q.texto.slice(0, 100) })), reduccion_estimada: s.condensado.reduccion, nota: "los segmentos de contexto NO se pierden: quedan accesibles con get_original" });
});
server.tool("extract_action_items", "Extrae la lista de acciones con responsable inferido y plazo si se menciona.", {
    sesion: z.string().describe("Sesión condensada"),
}, async (args) => {
    const { sesion } = args;
    const st = store.load();
    const s = (st.sesiones || {})[sesion];
    if (!s || !s.condensado)
        return fail("condensa primero con condense");
    const acciones = s.condensado.accionables.filter(a => a.tipo !== "decision").map(a => {
        const plazoMatch = a.texto.match(/(lunes|martes|miércoles|jueves|viernes|sábado|domingo|mañana|pasado mañana|próxima semana|fin de mes|\d{1,2} de [a-z]+|\d{1,2}\/\d{1,2})/i);
        return { responsable: a.hablante, tipo: a.tipo, accion: a.texto.slice(0, 140), plazo_mencionado: plazoMatch ? plazoMatch[0] : null };
    });
    const decisiones = s.condensado.accionables.filter(a => a.tipo === "decision").map(a => ({ decision: a.texto.slice(0, 140), quien_lo_dijo: a.hablante }));
    return ok({ sesion, acciones: acciones.length, lista_de_acciones: acciones, decisiones, sin_responsable_claro: acciones.filter(a => !a.responsable || a.responsable === "desconocido").length + " acciones sin responsable identificado: asígnalo antes de cerrar" });
});
server.tool("speaker_stats", "Estadísticas de participación: quién habló más, quién decidió más, quién calló.", {
    sesion: z.string().describe("Sesión"),
}, async (args) => {
    const { sesion } = args;
    const st = store.load();
    const s = (st.sesiones || {})[sesion];
    if (!s)
        return fail("sesión no encontrada");
    const por = {};
    s.segmentos.forEach(seg => {
        por[seg.hablante] = por[seg.hablante] || { hablante: seg.hablante, segmentos: 0, palabras: 0, decisiones: 0, acciones: 0 };
        por[seg.hablante].segmentos++;
        por[seg.hablante].palabras += seg.texto.split(/\s+/).filter(Boolean).length;
    });
    if (s.condensado)
        s.condensado.accionables.forEach(a => { if (por[a.hablante]) {
            if (a.tipo === "decision")
                por[a.hablante].decisiones++;
            else if (a.tipo === "accion")
                por[a.hablante].acciones++;
        } });
    const stats = __vals(por).sort((a, b) => b.palabras - a.palabras);
    const totalPalabras = stats.reduce((a, x) => a + x.palabras, 0) || 1;
    return ok({ sesion, hablantes: stats.length, participacion: stats.map(x => ({ ...x, share: Number((x.palabras / totalPalabras * 100).toFixed(0)) + "%" })), observaciones: { mas_decisiones: stats.slice().sort((a, b) => b.decisiones - a.decisiones)[0]?.hablante || "nadie decidió nada", accion_por_hablante: stats.filter(x => x.acciones > 0).map(x => x.hablante + " (" + x.acciones + ")"), dominante: stats[0] && stats[0].share > 60 ? stats[0].hablante + " acapara el " + stats[0].share + ": ¿reunión o monólogo?" : "participación equilibrada" } });
});
server.tool("get_original", "Recupera los segmentos originales de contexto descartados en la condensación (nada se pierde).", {
    sesion: z.string().describe("Sesión"),
    desde_indice: z.number().describe("Índice de segmento inicial").default(0),
    cantidad: z.number().describe("Cuántos segmentos").default(20),
}, async (args) => {
    const { sesion, desde_indice, cantidad } = args;
    const st = store.load();
    const s = (st.sesiones || {})[sesion];
    if (!s)
        return fail("sesión no encontrada");
    const segmentos = s.segmentos.slice(desde_indice, desde_indice + cantidad);
    return ok({ sesion, rango: { desde: desde_indice, hasta: Math.min(desde_indice + cantidad, s.segmentos.length) }, total: s.segmentos.length, segmentos });
});
server.tool("health_check", "Verifica que el servidor transcript-condenser está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "transcript-condenser", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[transcript-condenser] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Caption Aligner
 * Alinea transcripción y subtítulos por tiempo: cobertura, solapes y huecos detectados antes de confiar en ellos
 *
 * Dolor que resuelve: El transcript dice 'a las 14:30' y el caption correspondiente empieza 40 segundos tarde: el agente cita minutos exactos de un material desalineado y la referencia temporal es pura ficción.
 * Categoría: Multimodal & Voz | Generado por mcp-suite | id: caption-aligner
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
// ——— persistencia local: ~/.mcp-suite/caption-aligner/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "caption-aligner");
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
const server = new McpServer({ name: "caption-aligner", version: "1.0.0" });
server.tool("ingest_segments", "Ingiere los segmentos de subtítulo con sus tiempos.", {
    material: z.string().describe("Nombre del material (video/clase/reunión)"),
    segmentos: z.array(z.any()).describe("Segmentos {start: segundos, end: segundos, texto}"),
    duracion_total_seg: z.number().describe("Duración del material").optional(),
}, async (args) => {
    const { material, segmentos, duracion_total_seg } = args;
    const st = store.load();
    st.materiales = st.materiales || {};
    const limpios = (segmentos || []).filter(s => typeof s.start === "number" && typeof s.end === "number" && s.texto).map(s => ({ start: s.start, end: s.end, texto: String(s.texto).trim() })).sort((a, b) => a.start - b.start);
    if (!limpios.length)
        return fail("sin segmentos válidos {start, end, texto}");
    const solapes = [];
    for (let i = 1; i < limpios.length; i++) {
        if (limpios[i].start < limpios[i - 1].end - 0.05)
            solapes.push({ entre: [i, i + 1], segundos: Number((limpios[i - 1].end - limpios[i].start).toFixed(2)) });
    }
    const invertidos = limpios.filter((s, i) => i > 0 && s.start < limpios[i - 1].start).length;
    st.materiales[material] = { material, segmentos: limpios, duracion: duracion_total_seg || limpios[limpios.length - 1].end, solapes, ingerido: new Date().toISOString() };
    store.save(st);
    return ok({ material, segmentos: limpios.length, duracion_seg: st.materiales[material].duracion, solapes_detectados: solapes.length, segmentos_invertidos: invertidos, aviso: solapes.length > limpios.length * 0.2 ? "más del 20% de segmentos se solapan: la fuente de captions es sucia, límpiala antes de alinear" : "ingesta razonable" });
});
server.tool("coverage_check", "Cobertura temporal: qué zonas del material no tienen caption (huecos) y cuánto duran.", {
    material: z.string().describe("Material"),
}, async (args) => {
    const { material } = args;
    const st = store.load();
    const m = (st.materiales || {})[material];
    if (!m)
        return fail("material no encontrado: ingiere con ingest_segments");
    const huecos = [];
    let cursor = 0;
    m.segmentos.forEach(s => {
        if (s.start > cursor + 1.5)
            huecos.push({ desde: Number(cursor.toFixed(1)), hasta: Number(s.start.toFixed(1)), duracion: Number((s.start - cursor).toFixed(1)) });
        cursor = Math.max(cursor, s.end);
    });
    if (m.duracion > cursor + 2)
        huecos.push({ desde: Number(cursor.toFixed(1)), hasta: Number(m.duracion.toFixed(1)), duracion: Number((m.duracion - cursor).toFixed(1)) });
    const cobertura = Number((m.segmentos.reduce((a, s) => a + (s.end - s.start), 0) / m.duracion * 100).toFixed(1));
    return ok({ material, duracion_total: Number(m.duracion.toFixed(1)), cobertura_pct: cobertura + "%", huecos: huecos.sort((a, b) => b.duracion - a.duracion), zona_mas_oscura: huecos[0] || null, veredicto: cobertura < 85 ? "cobertura POBRE: el " + Number((100 - cobertura).toFixed(0)) + "% del material no tiene caption: NO cites tiempos de zonas sin caption" : cobertura < 95 ? "cobertura aceptable con huecos acotados" : "cobertura completa" });
});
server.tool("align_transcript", "Alinea oraciones del transcript con los segmentos por similitud textual y devuelve el mapeo con confianza.", {
    material: z.string().describe("Material"),
    oraciones: z.array(z.any()).describe("Oraciones del transcript (texto, en orden)"),
}, async (args) => {
    const { material, oraciones } = args;
    const st = store.load();
    const m = (st.materiales || {})[material];
    if (!m)
        return fail("material no encontrado");
    const ords = (oraciones || []).map(String).filter(o => o.trim());
    if (!ords.length)
        return fail("sin oraciones");
    const tokens = (x) => new Set(x.toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 2));
    const alineadas = ords.map((o, idx) => {
        const to = tokens(o);
        let mejor = null;
        m.segmentos.forEach((s, si) => {
            const ts = tokens(s.texto);
            const inter = [...to].filter(w => ts.has(w)).length;
            const sim = inter / Math.max(to.size, 1);
            if (!mejor || sim > mejor.sim)
                mejor = { segmento_idx: si, start: s.start, end: s.end, sim };
        });
        return { oracion_idx: idx, oracion: o.slice(0, 60), segmento: mejor ? mejor.segmento_idx + 1 : null, tiempo: mejor ? { desde: Number(mejor.start.toFixed(1)), hasta: Number(mejor.end.toFixed(1)) } : null, confianza: mejor ? (mejor.sim >= 0.7 ? "ALTA" : mejor.sim >= 0.4 ? "MEDIA" : "BAJA") : "NINGUNA", similitud: mejor ? Number(mejor.sim.toFixed(2)) : 0 };
    });
    const monotono = alineadas.every((a, i) => i === 0 || !a.tiempo || !alineadas[i - 1].tiempo || a.tiempo.desde >= alineacionesPrevias(alineadas, i));
    function alineacionesPrevias(arr, i) { return arr[i - 1].tiempo; }
    const bajas = alineadas.filter(a => a.confianza === "BAJA" || a.confianza === "NINGUNA");
    return ok({ material, oraciones_alineadas: alineadas.filter(a => a.tiempo).length, alineacion: alineadas, orden_temporal_coherente: monotono, confianzas: { alta: alineadas.filter(a => a.confianza === "ALTA").length, media: alineadas.filter(a => a.confianza === "MEDIA").length, baja_baja: bajas.length }, aviso: bajas.length > ords.length * 0.25 ? "más del 25% de oraciones alinean MAL: el transcript y los captions cuentan historias distintas, no mezcles sus tiempos" : null });
});
server.tool("suggest_offset", "Si todo alinea pero desplazado constante, calcula el offset de corrección por puntos de anclaje.", {
    material: z.string().describe("Material"),
    anclajes: z.array(z.any()).describe("Puntos verificados {texto_cita, tiempo_real_seg}"),
}, async (args) => {
    const { material, anclajes } = args;
    const st = store.load();
    const m = (st.materiales || {})[material];
    if (!m)
        return fail("material no encontrado");
    const tokens = (x) => new Set(x.toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(w => w.length > 2));
    const deltas = [];
    (anclajes || []).forEach(a => {
        const to = tokens(String(a.texto_cita || ""));
        let mejor = null;
        m.segmentos.forEach(s => {
            const ts = tokens(s.texto);
            const sim = [...to].filter(w => ts.has(w)).length / Math.max(to.size, 1);
            if (!mejor || sim > mejor.sim)
                mejor = { sim, start: s.start };
        });
        if (mejor && mejor.sim >= 0.5)
            deltas.push({ cita: String(a.texto_cita).slice(0, 40), caption_dice: Number(mejor.start.toFixed(1)), tiempo_real: Number(a.tiempo_real_seg), delta_seg: Number((a.tiempo_real_seg - mejor.start).toFixed(2)) });
    });
    if (deltas.length < 2)
        return fail("necesitas al menos 2 anclajes con similitud suficiente; aportados válidos: " + deltas.length);
    const media = deltas.reduce((s, d) => s + d.delta_seg, 0) / deltas.length;
    const dispersion = Math.max(...deltas.map(d => Math.abs(d.delta_seg - media)));
    return ok({ anclajes: deltas, offset_medio_seg: Number(media.toFixed(2)), dispersion_seg: Number(dispersion.toFixed(2)), correccion: dispersion < 0.75 ? "offset CONSTANTE: suma " + Number(media.toFixed(2)) + "s a todo caption y queda alineado" : "offset VARIABLE (deriva): el material se desincroniza progresivamente; realinea por tramos en lugar de un solo offset", aplicacion: "al citar tiempos del material, corrige: tiempo_cita = tiempo_caption + " + Number(media.toFixed(2)) });
});
server.tool("health_check", "Verifica que el servidor caption-aligner está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "caption-aligner", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[caption-aligner] fatal:", e);
    process.exit(1);
});

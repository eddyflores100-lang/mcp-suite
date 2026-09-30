#!/usr/bin/env node
/**
 * MCP Server: Temporal Reasoner
 * Razonamiento temporal: antes/después, solapamientos, duraciones y secuencias consistentes
 *
 * Dolor que resuelve: El agente dice cosas temporalmente imposibles: 'el despliegue del lunes usó el bug corregido el miércoles', cita eventos solapados como secuenciales y nadie verifica la coherencia temporal.
 * Categoría: Frescura del Conocimiento | Generado por mcp-suite | id: temporal-reasoner
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
const server = new McpServer({ name: "temporal-reasoner", version: "1.0.0" });
server.tool("check_sequence", "Valida que una secuencia de eventos fechados es cronológicamente posible.", {
    eventos: z.array(z.any()).describe("Lista {etiqueta, fecha} en el orden narrado"),
}, async (args) => {
    const { eventos } = args;
    const evs = (eventos || []).filter(e => e && e.etiqueta && e.fecha);
    if (evs.length < 2)
        return fail("necesitas >=2 eventos {etiqueta, fecha}");
    let consistente = true;
    const violaciones = [];
    for (let i = 1; i < evs.length; i++) {
        const t0 = new Date(evs[i - 1].fecha).getTime();
        const t1 = new Date(evs[i].fecha).getTime();
        if (isNaN(t0) || isNaN(t1))
            return fail("fecha inválida en evento " + i);
        if (t1 < t0) {
            consistente = false;
            violaciones.push({ antes: evs[i - 1].etiqueta + " (" + evs[i - 1].fecha + ")", despues: evs[i].etiqueta + " (" + evs[i].fecha + ")", problema: "el segundo ocurre ANTES que el primero" });
        }
    }
    return ok({ secuencia_posible: consistente, violaciones, eventos: evs.length });
});
server.tool("overlap_check", "Comprueba si dos intervalos temporales se solapan, contienen o son disjuntos.", {
    a_inicio: z.string().describe("Inicio intervalo A (ISO)"),
    a_fin: z.string().describe("Fin intervalo A"),
    b_inicio: z.string().describe("Inicio intervalo B"),
    b_fin: z.string().describe("Fin intervalo B"),
}, async (args) => {
    const { a_inicio, a_fin, b_inicio, b_fin } = args;
    const p = (s) => new Date(s).getTime();
    const nums = [p(a_inicio), p(a_fin), p(b_inicio), p(b_fin)];
    if (nums.some(isNaN))
        return fail("fechas ISO inválidas");
    if (p(a_inicio) > p(a_fin) || p(b_inicio) > p(b_fin))
        return fail("intervalo con inicio posterior a su fin");
    const solapa = p(a_inicio) < p(b_fin) && p(b_inicio) < p(a_fin);
    const aContieneB = p(a_inicio) <= p(b_inicio) && p(b_fin) <= p(a_fin);
    const bContieneA = p(b_inicio) <= p(a_inicio) && p(a_fin) <= p(b_fin);
    let relacion = "disjuntos";
    if (aContieneB)
        relacion = "A contiene a B";
    else if (bContieneA)
        relacion = "B contiene a A";
    else if (solapa)
        relacion = "solapados parcialmente";
    return ok({
        relacion,
        duracion_a_dias: Number(((p(a_fin) - p(a_inicio)) / 86400000).toFixed(1)),
        duracion_b_dias: Number(((p(b_fin) - p(b_inicio)) / 86400000).toFixed(1)),
        solapamiento_dias: solapa ? Number(((Math.min(p(a_fin), p(b_fin)) - Math.max(p(a_inicio), p(b_inicio))) / 86400000).toFixed(1)) : 0,
        implicacion: solapa ? "los dos estaban activos a la vez: NO pueden describirse como secuencia (primero A luego B)" : "pueden narrarse como secuencia",
    });
});
server.tool("relative_time", "Convierte lenguaje temporal relativo a absoluto y viceversa (hace N días, la semana pasada...).", {
    expresion: z.string().describe("Expresión temporal ('hace 3 dias', 'en 2 semanas', ISO)"),
}, async (args) => {
    const { expresion } = args;
    const e = String(expresion).toLowerCase().trim();
    const ahora = new Date();
    if (/^\d{4}-\d{2}-\d{2}/.test(e)) {
        const d = new Date(e);
        const dias = Math.round((ahora.getTime() - d.getTime()) / 86400000);
        return ok({ absoluto: e, relativo: dias === 0 ? "hoy" : dias > 0 ? "hace " + dias + " días" : "en " + (-dias) + " días", dias_delta: dias });
    }
    const m = e.match(/^hace\s+(\d+)\s*(min|minutos|h|horas|d|dias|día|semana|semanas|mes|meses)/);
    if (m) {
        const n = parseInt(m[1]), u = m[2];
        const ms = u.startsWith("min") ? 60000 : u.startsWith("h") ? 3600000 : u.startsWith("mes") ? 2592000000 : u.includes("semana") ? 604800000 : 86400000;
        return ok({ relativo: e, absoluto: new Date(ahora.getTime() - n * ms).toISOString(), dias_delta: -Number((n * ms / 86400000).toFixed(1)) });
    }
    const m2 = e.match(/^en\s+(\d+)\s*(min|minutos|h|horas|d|dias|día|semana|semanas|mes|meses)/);
    if (m2) {
        const n = parseInt(m2[1]), u = m2[2];
        const ms = u.startsWith("min") ? 60000 : u.startsWith("h") ? 3600000 : u.startsWith("mes") ? 2592000000 : u.includes("semana") ? 604800000 : 86400000;
        return ok({ relativo: e, absoluto: new Date(ahora.getTime() + n * ms).toISOString(), dias_delta: Number((n * ms / 86400000).toFixed(1)) });
    }
    if (/la semana pasada/.test(e))
        return ok({ relativo: e, absoluto: new Date(ahora.getTime() - 7 * 86400000).toISOString().slice(0, 10), nota: "semana pasada aproximada" });
    return fail("expresión no reconocida: usa ISO, 'hace 3 dias' o 'en 2 semanas'");
});
server.tool("consistency_scan", "Escanea un texto en busca de afirmaciones temporales inconsistentes (fechas imposibles entre sí).", {
    texto: z.string().describe("Texto a auditar"),
}, async (args) => {
    const { texto } = args;
    const t = String(texto || "");
    if (t.length < 30)
        return fail("texto demasiado corto");
    const fechas = [...t.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)].map(m => ({ iso: m[0], ts: new Date(m[0]).getTime(), ctx: t.slice(Math.max(0, m.index - 35), m.index + 40).replace(/\n/g, " ") }));
    const anos = [...t.matchAll(/\b(19|20)(\d{2})\b/g)].map(m => ({ ano: m[0], ctx: t.slice(Math.max(0, m.index - 35), m.index + 40).replace(/\n/g, " ") }));
    const problemas = [];
    if (fechas.length >= 2) {
        const max = Math.max(...fechas.map(f => f.ts));
        for (const f of fechas) {
            const despuesDe = /después de|posterior a|tras/i.test(f.ctx);
            const antesDe = /antes de|previo a|anterior a/i.test(f.ctx);
            if (despuesDe && f.ts < max * 0.999) { /* ok */ }
        }
        const ordenadas = [...fechas].sort((a, b) => a.ts - b.ts);
        if (/primero|inicialmente|al comienzo/i.test(ordenadas[ordenadas.length - 1].ctx) && ordenadas.length > 1) {
            problemas.push({ tipo: "primero_es_posterior", detalle: "un evento narrado como 'primero' tiene la fecha más tardía: " + ordenadas[ordenadas.length - 1].ctx });
        }
    }
    if (anos.length >= 2) {
        const set = [...new Set(anos.map(a => a.ano))].sort();
        if (set.length > 1 && Math.abs(parseInt(set[set.length - 1]) - parseInt(set[0])) > 8) {
            problemas.push({ tipo: "rango_anos_amplio", detalle: "el texto mezcla " + set[0] + " y " + set[set.length - 1] + ": verifica que no se presentan como contemporáneos" });
        }
    }
    return ok({
        fechas_detectadas: fechas.length, anos_detectados: [...new Set(anos.map(a => a.ano))],
        problemas: problemas.length,
        detalle: problemas,
        veredicto: problemas.length ? "posible inconsistencia temporal: revisa" : "sin inconsistencias evidentes",
    });
});
server.tool("health_check", "Verifica que el servidor temporal-reasoner está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "temporal-reasoner", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[temporal-reasoner] fatal:", e);
    process.exit(1);
});

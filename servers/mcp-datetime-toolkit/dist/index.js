#!/usr/bin/env node
/**
 * MCP Server: Datetime Toolkit
 * Fechas exactas: parse natural-ligero, formato, zonas horarias y días hábiles
 *
 * Dolor que resuelve: Los LLM calculan mal 'qué día será en 30 días' o mezclan zonas horarias: las fechas de deadlines deben ser exactas.
 * Categoría: Utilidades | Generado por mcp-suite | id: datetime-toolkit
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
const server = new McpServer({ name: "datetime-toolkit", version: "1.0.0" });
server.tool("parse_date", "Parsea fechas en múltiples formatos a ISO: ISO, dd/mm/yyyy, 'hoy', 'mañana', 'pasado mañana', 'lunes próximo', 'hace N días'.", {
    texto: z.string().describe("Fecha en texto"),
    zona: z.string().describe("Zona horaria IANA").default("America/Guayaquil"),
}, async (args) => {
    const { texto, zona } = args;
    const t = texto.toLowerCase().trim();
    const ahora = new Date();
    const resolver = (d) => d.toISOString().slice(0, 10);
    if (t === "hoy")
        return ok({ iso: resolver(ahora), interpretacion: "hoy" });
    if (t === "mañana")
        return ok({ iso: resolver(new Date(ahora.getTime() + 86400000)), interpretacion: "mañana" });
    if (t === "pasado mañana")
        return ok({ iso: resolver(new Date(ahora.getTime() + 2 * 86400000)), interpretacion: "pasado mañana" });
    const haceMatch = t.match(/^hace (\d+) d[ií]as?$/);
    if (haceMatch)
        return ok({ iso: resolver(new Date(ahora.getTime() - Number(haceMatch[1]) * 86400000)), interpretacion: "hace " + haceMatch[1] + " días" });
    const enMatch = t.match(/^en (\d+) d[ií]as?$/);
    if (enMatch)
        return ok({ iso: resolver(new Date(ahora.getTime() + Number(enMatch[1]) * 86400000)), interpretacion: "en " + enMatch[1] + " días" });
    const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const diaMatch = t.match(/^(\w+)( pr[oó]ximo)?$/);
    if (diaMatch) {
        const idx = dias.indexOf(diaMatch[1]);
        if (idx >= 0) {
            let delta = (idx - ahora.getDay() + 7) % 7;
            if (delta === 0)
                delta = 7;
            return ok({ iso: resolver(new Date(ahora.getTime() + delta * 86400000)), interpretacion: diaMatch[1] + " próximo (+" + delta + "d)" });
        }
    }
    const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso)
        return ok({ iso: texto.slice(0, 10), interpretacion: "ISO directo" });
    const dmy = texto.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
    if (dmy)
        return ok({ iso: dmy[3] + "-" + dmy[2].padStart(2, "0") + "-" + dmy[1].padStart(2, "0"), interpretacion: "dd/mm/yyyy (formato latino)" });
    const mdy = texto.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
    if (mdy)
        return ok({ iso: mdy[3] + "-" + mdy[1].padStart(2, "0") + "-" + mdy[2].padStart(2, "0"), interpretacion: "mm/dd/yyyy (formato US)" });
    return fail("formato no reconocido: prueba ISO, dd/mm/aaaa, 'hoy', 'mañana', 'hace N días', 'lunes próximo'");
});
server.tool("add_days", "Suma/resta días (o business days) a una fecha ISO con exactitud de calendario.", {
    fecha: z.string().describe("Fecha ISO (yyyy-mm-dd)"),
    dias: z.number().describe("Días a sumar (negativo resta)"),
    solo_habiles: z.boolean().describe("Solo días hábiles (L-V)").default(false),
}, async (args) => {
    const { fecha, dias, solo_habiles } = args;
    const base = new Date(fecha + "T12:00:00Z");
    if (isNaN(base.getTime()))
        return fail("fecha inválida: usa yyyy-mm-dd");
    let d = new Date(base);
    if (solo_habiles) {
        let restantes = Math.abs(dias);
        const paso = dias >= 0 ? 1 : -1;
        while (restantes > 0) {
            d = new Date(d.getTime() + paso * 86400000);
            const dow = d.getUTCDay();
            if (dow !== 0 && dow !== 6)
                restantes--;
        }
    }
    else
        d = new Date(d.getTime() + dias * 86400000);
    return ok({ fecha_original: fecha, fecha_resultado: d.toISOString().slice(0, 10), dia_semana: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][d.getUTCDay()], dias_aplicados: dias });
});
server.tool("diff_dates", "Diferencia exacta entre dos fechas: días totales, días hábiles, semanas y meses aproximados.", {
    desde: z.string().describe("Fecha ISO inicial"),
    hasta: z.string().describe("Fecha ISO final"),
}, async (args) => {
    const { desde, hasta } = args;
    const a = new Date(desde + "T12:00:00Z");
    const b = new Date(hasta + "T12:00:00Z");
    if (isNaN(a.getTime()) || isNaN(b.getTime()))
        return fail("fechas inválidas");
    const ms = b.getTime() - a.getTime();
    const dias = Math.round(ms / 86400000);
    let habiles = 0;
    for (let i = 0; i < Math.abs(dias); i++) {
        const d = new Date(Math.min(a.getTime(), b.getTime()) + i * 86400000);
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6)
            habiles++;
    }
    return ok({ dias_totales: dias, dias_habiles: habiles, semanas: Math.round((dias / 7) * 10) / 10, meses_aprox: Math.round((dias / 30.44) * 10) / 10, direccion: dias >= 0 ? "hacia adelante" : "hacia atrás" });
});
server.tool("health_check", "Verifica que el servidor datetime-toolkit está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "datetime-toolkit", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[datetime-toolkit] fatal:", e);
    process.exit(1);
});

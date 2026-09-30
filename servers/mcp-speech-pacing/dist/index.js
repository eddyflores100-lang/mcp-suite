#!/usr/bin/env node
/**
 * MCP Server: Speech Pacing
 * Planifica el ritmo del habla del agente: pausas donde hay ideas, énfasis en los datos y velocidad por complejidad
 *
 * Dolor que resuelve: El agente lee a velocidad uniforme: dispara las cifras críticas, no pausa entre ideas opuestas y el usuario no retiene nada. El pacing no es un extra de TTS: es la mitad de la comprensión oral.
 * Categoría: Multimodal & Voz | Generado por mcp-suite | id: speech-pacing
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
// ——— persistencia local: ~/.mcp-suite/speech-pacing/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "speech-pacing");
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
const server = new McpServer({ name: "speech-pacing", version: "1.0.0" });
server.tool("analyze_text", "Analiza el texto a hablar: densidad de datos, complejidad y puntos naturales de pausa.", {
    texto: z.string().describe("Texto que el agente va a decir"),
}, async (args) => {
    const { texto } = args;
    const oraciones = texto.split(/(?<=[.!?;:])\s+/).filter(s => s.trim());
    if (!oraciones.length)
        return fail("texto vacío");
    const analisis = oraciones.map(o => {
        const palabras = o.split(/\s+/).filter(Boolean);
        const cifras = (o.match(/\d+([.,]\d+)?%?/g) || []).length;
        const esLista = /,| y | o |;/.test(o) && palabras.length > 12;
        const contraste = /\b(pero|sin embargo|aunque|no obstante|en cambio|mientras que)\b/i.test(o);
        const esCifraCritica = cifras >= 2;
        return { texto: o.slice(0, 70), palabras: palabras.length, cifras, es_lista: esLista, tiene_contraste: contraste, complejidad: Number(((cifras * 2 + palabras.length / 8 + (esLista ? 1 : 0)).toFixed(1))) };
    });
    const totalPalabras = analisis.reduce((a, x) => a + x.palabras, 0);
    const totalCifras = analisis.reduce((a, x) => a + x.cifras, 0);
    return ok({ oraciones: analisis.length, palabras: totalPalabras, cifras: totalCifras, densidad_de_datos: Number((totalCifras / Math.max(analisis.length, 1)).toFixed(2)) + " por oración", analisis, veredicto: totalCifras / Math.max(analisis.length, 1) > 1.5 ? "texto DENSO en cifras: sin pacing el usuario no retendrá ninguna" : "texto manejable" });
});
server.tool("plan_pacing", "Genera el plan de ritmo: pausas (break SSML), velocidad y énfasis por segmento.", {
    texto: z.string().describe("Texto a decir"),
    velocidad_base: z.number().describe("Velocidad base (1.0 = normal)").default(1),
}, async (args) => {
    const { texto, velocidad_base } = args;
    const oraciones = texto.split(/(?<=[.!?;:])\s+/).filter(s => s.trim());
    if (!oraciones.length)
        return fail("texto vacío");
    const plan = oraciones.map((o, i) => {
        const palabras = o.split(/\s+/).filter(Boolean);
        const cifras = (o.match(/\d+([.,]\d+)?%?/g) || []).length;
        const contraste = /\b(pero|sin embargo|aunque|no obstante|en cambio)\b/i.test(o);
        const esLista = (o.match(/,/g) || []).length >= 2;
        let velocidad = velocidad_base;
        let pausa_despues = "corta (300ms)";
        let enfasis = [];
        if (cifras >= 2) {
            velocidad = Number((velocidad_base * 0.85).toFixed(2));
            pausa_despues = "larga (700ms): deja digerir las cifras";
            enfasis = (o.match(/\d+([.,]\d+)?%?/g) || []).slice(0, 3);
        }
        else if (contraste) {
            pausa_despues = "media (500ms): el contraste exige asiento";
            enfasis = [o.match(/\b[A-Za-zÁÉÍÓÚáéíóúñ]+\b/g)?.slice(0, 1)?.[0] || ""];
        }
        else if (esLista) {
            pausa_despues = "media (450ms)";
        }
        else if (palabras.length > 25) {
            velocidad = Number((velocidad_base * 0.95).toFixed(2));
            pausa_despues = "media (400ms): oración larga, aire al final";
        }
        return { orden: i + 1, segmento: o.slice(0, 60), palabras: palabras.length, velocidad, pausa_despues, enfasis_en: enfasis.filter(Boolean) };
    });
    const duracionEstimada = plan.reduce((a, p) => a + p.palabras / (2.5 * p.velocidad), 0);
    return ok({ segmentos: plan.length, plan, duracion_estimada_seg: Number(duracionEstimada.toFixed(1)), total_pausas: plan.length + " pausas estructurales", reglas_aplicadas: "cifras ralentizan 15% y pausan largo · contrastes pausan medio · listas separan elementos · largas respiran al final" });
});
server.tool("ssml_hints", "Convierte el plan en pistas SSML concretas (breaks, prosody, emphasis) para tu motor TTS.", {
    texto: z.string().describe("Texto a decir"),
}, async (args) => {
    const { texto } = args;
    const oraciones = texto.split(/(?<=[.!?;:])\s+/).filter(s => s.trim());
    if (!oraciones.length)
        return fail("texto vacío");
    const ms = { corta: 300, media: 500, larga: 700 };
    let ssml = "<speak>";
    oraciones.forEach(o => {
        const cifras = (o.match(/\d+([.,]\d+)?%?/g) || []).length;
        const contraste = /\b(pero|sin embargo|aunque|no obstante|en cambio)\b/i.test(o);
        let abre = "", cierra = "";
        if (cifras >= 2) {
            abre = '<prosody rate="85%">';
            cierra = "</prosody>";
        }
        else if (o.split(/\s+/).length > 25) {
            abre = '<prosody rate="95%">';
            cierra = "</prosody>";
        }
        let cuerpo = o;
        const enfatizables = (o.match(/\d+([.,]\d+)?%?/g) || []).slice(0, 2);
        enfatizables.forEach(c => { cuerpo = cuerpo.replace(c, '<emphasis level="moderate">' + c + "</emphasis>"); });
        ssml += abre + cuerpo + cierra;
        const pausa = cifras >= 2 ? ms.larga : contraste ? ms.media : ms.corta;
        ssml += '<break time="' + pausa + 'ms"/>';
    });
    ssml += "</speak>";
    return ok({ ssml, longitud: ssml.length, usable_en: "motores compatibles SSML (Polly, Azure, Google, ElevenLabs parciales)", nota: "si tu TTS no soporta SSML, usa los milisegundos de plan_pacing como silencios insertados manualmente" });
});
server.tool("estimate_duration", "Estima duración del habla con velocidad y pausas planificadas (para timeouts y UX).", {
    texto: z.string().describe("Texto"),
    velocidad: z.number().describe("Velocidad (1 = normal)").default(1),
    incluir_pausas: z.boolean().describe("Sumar las pausas estructurales").default(true),
}, async (args) => {
    const { texto, velocidad, incluir_pausas } = args;
    const oraciones = texto.split(/(?<=[.!?;:])\s+/).filter(s => s.trim());
    if (!oraciones.length)
        return fail("texto vacío");
    let seg = 0, pausas = 0;
    oraciones.forEach(o => {
        const palabras = o.split(/\s+/).filter(Boolean).length;
        const cifras = (o.match(/\d+([.,]\d+)?%?/g) || []).length;
        const v = cifras >= 2 ? velocidad * 0.85 : velocidad;
        seg += palabras / (2.5 * v);
        if (incluir_pausas)
            pausas += cifras >= 2 ? 0.7 : 0.35;
    });
    const total = seg + pausas;
    return ok({ oraciones: oraciones.length, habla_seg: Number(seg.toFixed(1)), pausas_seg: Number(pausas.toFixed(1)), total_seg: Number(total.toFixed(1)), total_min: Number((total / 60).toFixed(2)), umbral_ux: total > 90 ? "MÁS DE 90 SEGUNDOS de monólogo: el usuario medio abandona: divide en turnos con confirmación" : total > 40 ? "40-90s: arriesgado, considera punto de confirmación a mitad" : "duración segura para un turno de voz" });
});
server.tool("health_check", "Verifica que el servidor speech-pacing está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "speech-pacing", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[speech-pacing] fatal:", e);
    process.exit(1);
});

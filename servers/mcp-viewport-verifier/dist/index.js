#!/usr/bin/env node
/**
 * MCP Server: Viewport Verifier
 * Verifica el estado visible esperado tras cada acción: el navegador dice lo que realmente se ve
 *
 * Dolor que resuelve: El agente asume que su acción funcionó porque no hubo error: pero el toast se cerró, el modal tapaba el botón, o el spinner seguía girando. Sin verificar el estado visible, el flujo 'avanza' roto.
 * Categoría: Computer Use | Generado por mcp-suite | id: viewport-verifier
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
const server = new McpServer({ name: "viewport-verifier", version: "1.0.0" });
server.tool("declare_expectation", "Declara la expectativa de estado visible tras una acción (para verificarla inmediatamente).", {
    tras_accion: z.string().describe("Acción realizada"),
    debe_aparecer: z.array(z.any()).describe("Elementos/textos que deben ser visibles").default([]),
    debe_desaparecer: z.array(z.any()).describe("Lo que ya no debe verse").default([]),
    debe_contener_texto: z.string().describe("Texto que debe existir en la página").optional(),
}, async (args) => {
    const { tras_accion, debe_aparecer, debe_desaparecer, debe_contener_texto } = args;
    const exp = { tras_accion, debe_aparecer: debe_aparecer || [], debe_desaparecer: debe_desaparecer || [], debe_contener_texto: debe_contener_texto || null };
    if (!exp.debe_aparecer.length && !exp.debe_desaparecer.length && !exp.debe_contener_texto)
        return fail("expectativa vacía: declara al menos una condición observable");
    return ok({ expectativa: exp, siguiente: "observa el viewport y verifica con verify_viewport" });
});
server.tool("verify_viewport", "Verifica la expectativa contra lo observado (texto visible y elementos detectados) y explica discrepancias.", {
    expectativa: z.any().describe("Expectativa declarada (objeto de declare_expectation)"),
    texto_visible: z.string().describe("Texto visible actual del viewport"),
    elementos_detectados: z.array(z.any()).describe("Selectores/textos de elementos visibles").default([]),
}, async (args) => {
    const { expectativa, texto_visible, elementos_detectados } = args;
    if (!expectativa || typeof expectativa !== "object")
        return fail("expectativa inválida");
    const vis = String(texto_visible || "");
    const elems = (elementos_detectados || []).map(String);
    const visiblesTodos = elems.concat([vis]);
    const fallos = [];
    const okList = [];
    for (const esp of expectativa.debe_aparecer || []) {
        const hit = visiblesTodos.some(v => v && v.toLowerCase().includes(String(esp).toLowerCase()));
        (hit ? okList : fallos).push({ esperaba_ver: esp, tipo: "aparecer" });
    }
    for (const esp of expectativa.debe_desaparecer || []) {
        const hit = visiblesTodos.some(v => v && v.toLowerCase().includes(String(esp).toLowerCase()));
        (hit ? fallos : okList).push({ esperaba_ver: esp, tipo: "desaparecer", problema: "SIGUE PRESENTE" });
    }
    if (expectativa.debe_contener_texto && !vis.toLowerCase().includes(String(expectativa.debe_contener_texto).toLowerCase()))
        fallos.push({ esperaba_ver: expectativa.debe_contener_texto, tipo: "texto", problema: "texto no encontrado en viewport" });
    const verdicto = fallos.length === 0 ? "CONFIRMADO: la acción produjo el estado esperado" : fallos.length <= 2 ? "PARCIAL: condiciones sin cumplir, posible lentitud/animación: re-verifica tras esperar" : "FALLIDO: la acción NO produjo el efecto: NO continúes el flujo";
    return ok({
        accion: expectativa.tras_accion,
        confirmadas: okList.length,
        fallidas: fallos.length,
        fallos,
        veredicto: verdicto,
        siguiente_paso: fallos.length === 0 ? "continúa el flujo" : "espera 1-2s y re-verifica; si persiste: checkpoint-undo y diagnostica (dom-baseline diff)",
    });
});
server.tool("assert_page_ready", "Comprueba señales de página lista vs página ocupada (spinners, overlays, disabled) contra el texto/estado actual.", {
    texto_o_estado: z.string().describe("Texto visible o snapshot de atributos del viewport"),
}, async (args) => {
    const { texto_o_estado } = args;
    const t = String(texto_o_estado || "");
    const OCUPADO = /(cargando|loading|spinner|procesando|por favor espere|sincronizando|guardando...)/i;
    const BLOQUEADO = /(deshabilitado|disabled|no disponible|intenta de nuevo más tarde|error 5\d\d|algo salió mal)/i;
    const LISTO = /(listo|completado|guardado|enviado|correcto|success|resultado)/i;
    const señales = { ocupado: OCUPADO.test(t), bloqueado: BLOQUEADO.test(t), listo: LISTO.test(t) };
    let estado;
    if (señales.bloqueado)
        estado = "BLOQUEADO: hay error visible: captura y aborta";
    else if (señales.ocupado && !señales.listo)
        estado = "OCUPADO: espera 1-3s y vuelve a comprobar";
    else if (señales.listo)
        estado = "LISTO: puedes interactuar";
    else
        estado = "INDETERMINADO: sin señales claras: verifica elementos clave a mano";
    return ok({ señales, estado, regla: "jamás interactúes con una página en estado OCUPADO o BLOQUEADO" });
});
server.tool("observed_report", "Compara lo que el agente CREE que pasó vs lo observado: convierte suposiciones en evidencia.", {
    suposicion: z.string().describe("Lo que el agente cree que logró"),
    observado: z.string().describe("Lo que realmente se ve en pantalla"),
}, async (args) => {
    const { suposicion, observado } = args;
    const tokens = (s) => new Set(String(s).toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const a = tokens(suposicion), b = tokens(observado);
    const inter = [...a].filter(w => b.has(w)).length;
    const union = new Set([...a, ...b]).size || 1;
    const jaccard = inter / union;
    return ok({
        coincidencia: Number(jaccard.toFixed(2)),
        tokens_suposicion_sostenidos: [...a].filter(w => b.has(w)),
        tokens_suposicion_sin_evidencia: [...a].filter(w => !b.has(w)),
        veredicto: jaccard >= 0.5 ? "la suposición está sostenida por lo observable" : jaccard >= 0.25 ? "parcialmente sostenida: confirmando con verify_viewport" : "SIN EVIDENCIA: lo que crees NO se ve en pantalla: no declares éxito",
    });
});
server.tool("health_check", "Verifica que el servidor viewport-verifier está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "viewport-verifier", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[viewport-verifier] fatal:", e);
    process.exit(1);
});

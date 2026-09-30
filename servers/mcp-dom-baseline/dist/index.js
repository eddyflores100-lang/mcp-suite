#!/usr/bin/env node
/**
 * MCP Server: DOM Baseline
 * Baselines de páginas: snapshots estructurales y detección de qué cambió desde la última vez
 *
 * Dolor que resuelve: El agente de navegador memoriza la estructura de la página y esta cambia sin aviso: el flujo se rompe y el agente no sabe QUÉ cambió exactamente ni cuándo.
 * Categoría: Computer Use | Generado por mcp-suite | id: dom-baseline
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
// ——— persistencia local: ~/.mcp-suite/dom-baseline/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "dom-baseline");
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
const server = new McpServer({ name: "dom-baseline", version: "1.0.0" });
server.tool("save_snapshot", "Guarda un snapshot de la página: lista de elementos clave (selector, rol, texto visible) extraídos por el navegador.", {
    pagina: z.string().describe("Identificador de la página (url o nombre)"),
    flujo: z.string().describe("Flujo al que pertenece").default("default"),
    elementos: z.array(z.any()).describe("Elementos {selector, texto, tipo} observados"),
}, async (args) => {
    const { pagina, flujo, elementos } = args;
    const st = store.load();
    st.paginas = st.paginas || {};
    const clave = flujo + "::" + pagina;
    const elems = (elementos || []).map(e => ({ selector: String(e.selector || ""), texto: String(e.texto || "").slice(0, 80), tipo: String(e.tipo || "generico") })).filter(e => e.selector);
    if (!elems.length)
        return fail("sin elementos observables: extrae {selector, texto, tipo} primero");
    const hash = "" + elems.length + "-" + elems.map(e => e.selector).join("|").length;
    st.paginas[clave] = { pagina, flujo, elementos: elems, hash, version: (st.paginas[clave]?.version || 0) + 1, ts: new Date().toISOString() };
    store.save(st);
    return ok({ pagina, version: st.paginas[clave].version, elementos: elems.length, hash });
});
server.tool("diff_page", "Compara la observación actual contra el baseline: elementos desaparecidos, nuevos y con texto cambiado.", {
    pagina: z.string().describe("Página a comparar"),
    flujo: z.string().describe("Flujo").default("default"),
    elementos_actuales: z.array(z.any()).describe("Elementos {selector, texto, tipo} observados ahora"),
}, async (args) => {
    const { pagina, flujo, elementos_actuales } = args;
    const st = store.load();
    const clave = flujo + "::" + pagina;
    const base = (st.paginas || {})[clave];
    if (!base)
        return fail("sin baseline para " + clave + ": grábalo con save_snapshot");
    const actuales = (elementos_actuales || []).map(e => ({ selector: String(e.selector || ""), texto: String(e.texto || "").slice(0, 80) })).filter(e => e.selector);
    const baseMap = new Map(base.elementos.map(e => [e.selector, e]));
    const actMap = new Map(actuales.map(e => [e.selector, e]));
    const desaparecidos = [...baseMap.keys()].filter(s => !actMap.has(s));
    const nuevos = [...actMap.keys()].filter(s => !baseMap.has(s));
    const cambiados = [...actMap.entries()].filter(([s, e]) => baseMap.has(s) && baseMap.get(s).texto !== e.texto).map(([s, e]) => ({ selector: s, antes: baseMap.get(s).texto, ahora: e.texto }));
    const rotos_importantes = desaparecidos.filter(s => /button|btn|input|form|submit|login|checkout|cart|pay|pagar|comprar|cta|enviar/i.test(s));
    return ok({
        estabilidad: Number((actMap.size / Math.max(baseMap.size, 1) * 100).toFixed(0)) + "%",
        desaparecidos, nuevos, texto_cambiado: cambiados,
        criticos_para_el_flujo: rotos_importantes,
        veredicto: rotos_importantes.length ? "ROTO: elementos críticos desaparecieron: el flujo fallará; re-graba baseline tras verificar manualmente" : desaparecidos.length === 0 ? "página estable desde el baseline" : "cambios menores: revisa si afectan selectores que usas",
    });
});
server.tool("get_baseline", "Recupera el baseline actual de una página (selectores estables conocidos).", {
    pagina: z.string().describe("Página"),
    flujo: z.string().describe("Flujo").default("default"),
}, async (args) => {
    const { pagina, flujo } = args;
    const st = store.load();
    const b = (st.paginas || {})[flujo + "::" + pagina];
    if (!b)
        return fail("sin baseline");
    return ok({ pagina, flujo, version: b.version, grabado: b.ts, elementos: b.elementos });
});
server.tool("stability_report", "Reporte de estabilidad global: qué páginas cambian más (fragilidad del suite de automatización).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const paginas = __vals(st.paginas || {});
    if (!paginas.length)
        return ok({ paginas: 0 });
    const regrabs = paginas.map(p => ({ pagina: p.pagina, flujo: p.flujo, versiones: p.version, antiguedad_dias: Number(((Date.now() - new Date(p.ts).getTime()) / 86400000).toFixed(1)) })).sort((a, b) => b.versiones - a.versiones);
    return ok({
        paginas_baselinadas: paginas.length,
        mas_volatiles: regrabs.slice(0, 5),
        mas_estables: regrabs.slice(-3),
        consejo: regrabs[0]?.versiones > 5 ? "una página exige >5 regrabs: pide selectores data-testid al equipo o fija otra estrategia de localización" : "volatilidad razonable",
    });
});
server.tool("health_check", "Verifica que el servidor dom-baseline está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "dom-baseline", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[dom-baseline] fatal:", e);
    process.exit(1);
});

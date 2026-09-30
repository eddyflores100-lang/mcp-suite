#!/usr/bin/env node
/**
 * MCP Server: Definition of Done
 * Checklists de completitud por tipo de entrega: código, análisis, documento, datos
 *
 * Dolor que resuelve: 'Ya está' significa cosas distintas para el agente y el humano: faltan tests, falta documentar, quedan TODOs. Sin checklist, el 90% se declara hecho al 70%.
 * Categoría: Especificación y Requisitos | Generado por mcp-suite | id: definition-of-done
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
// ——— persistencia local: ~/.mcp-suite/definition-of-done/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "definition-of-done");
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
const server = new McpServer({ name: "definition-of-done", version: "1.0.0" });
server.tool("get_templates", "Devuelve las plantillas de Definition of Done incorporadas (código, análisis, documento, datos, migración) para elegir.", {
// sin parámetros
}, async (args) => {
    const PLANTILLAS = {
        codigo: ["compila/interpreta sin errores", "tests del camino feliz pasando", "al menos un caso de error cubierto", "sin TODO/FIXME/placeholder", "nombres descriptivos revisados", "entrada inválida manejada sin crashear", "documento de decisiones si hubo trade-offs"],
        analisis: ["datos con fuente y fecha", "método explicado (cómo se calculó)", "supuestos declarados explícitamente", "limitaciones de validez anotadas", "conclusión accionable (no solo descriptiva)", "cifras con unidades", "comparado contra alternativa razonable"],
        documento: ["audiencia definida", "estructura con jerarquía clara", "sin secciones vacías o pendientes", "afirmaciones con fuente o marcadas como hipótesis", "resumen ejecutivo arriba", "terminología consistente", "formato solicitado respetado"],
        datos: ["esquema/documentado cada campo", "valores nulos cuantificados", "duplicados revisados", "tipos validados", "rango/límites plausibles comprobados", "muestra de filas inspeccionada visualmente", "transformaciones reversibles o registradas"],
        migracion: ["backup/rollback verificado", "plan de ejecución en pasos", "prueba en entorno no productivo", "criterio de éxito medible", "plan B si falla a mitad", "quién autoriza y quién ejecuta", "ventana de interrupción acordada"],
    };
    return ok({ tipos: Object.keys(PLANTILLAS), plantillas: PLANTILLAS, uso: "activa una con set_active y evalúa cada entrega con evaluate" });
});
server.tool("set_active", "Activa una plantilla de DoD (opcionalmente con items extra propios de la entrega).", {
    tipo: z.enum(["codigo", "analisis", "documento", "datos", "migracion"]).describe("Tipo de entrega"),
    items_extra: z.array(z.any()).describe("Items adicionales del contexto").default([]),
}, async (args) => {
    const { tipo, items_extra } = args;
    const st = store.load();
    const PLANTILLAS = {
        codigo: ["compila/interpreta sin errores", "tests del camino feliz pasando", "al menos un caso de error cubierto", "sin TODO/FIXME/placeholder", "nombres descriptivos revisados", "entrada inválida manejada sin crashear", "documento de decisiones si hubo trade-offs"],
        analisis: ["datos con fuente y fecha", "método explicado", "supuestos declarados", "limitaciones anotadas", "conclusión accionable", "cifras con unidades", "comparado contra alternativa"],
        documento: ["audiencia definida", "estructura jerárquica clara", "sin secciones vacías", "afirmaciones con fuente o marcadas como hipótesis", "resumen ejecutivo", "terminología consistente", "formato respetado"],
        datos: ["esquema documentado", "nulos cuantificados", "duplicados revisados", "tipos validados", "rangos plausibles", "muestra inspeccionada", "transformaciones registradas"],
        migracion: ["backup/rollback verificado", "pasos definidos", "probado en no-productivo", "criterio de éxito", "plan B", "autorización clara", "ventana acordada"],
    };
    st.activo = { tipo, items: [...PLANTILLAS[tipo], ...(items_extra || []).map(String)], activada: new Date().toISOString() };
    store.save(st);
    return ok({ activo: tipo, items: st.activo.items.length });
});
server.tool("evaluate", "Evalúa una entrega contra la DoD activa: marca items cumplidos y devuelve el % de done real.", {
    cumplidos: z.array(z.any()).describe("Números de items cumplidos (índices 1-based)"),
    notas: z.string().describe("Contexto de la evaluación").optional(),
}, async (args) => {
    const { cumplidos, notas } = args;
    const st = store.load();
    if (!st.activo)
        return fail("activa una plantilla con set_active primero");
    const items = st.activo.items;
    const set = new Set((cumplidos || []).map(Number));
    const detalle = items.map((it, i) => ({ n: i + 1, item: it, cumplido: set.has(i + 1) }));
    const pct = Math.round(set.size / items.length * 100);
    st.historial = st.historial || [];
    st.historial.push({ tipo: st.activo.tipo, pct, notas: notas || null, faltantes: detalle.filter(d => !d.cumplido).map(d => d.item), ts: new Date().toISOString() });
    store.save(st);
    return ok({
        pct_done: pct + "%",
        cumplidos: set.size + "/" + items.length,
        faltan: detalle.filter(d => !d.cumplido).map(d => d.n + ". " + d.item),
        veredicto: pct === 100 ? "DONE de verdad: puedes entregar" : pct >= 80 ? "casi: cierra los items bloqueantes antes de entregar" : "NO está listo: declararlo 'hecho' ahora es mentir al cliente",
    });
});
server.tool("done_history", "Historial de honestidad: % de done declarado por entrega y tendencia (¿mejora la disciplina?).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const h = st.historial || [];
    if (!h.length)
        return ok({ evaluaciones: 0 });
    return ok({
        evaluaciones: h.length,
        done_medio: Number((h.reduce((s, x) => s + x.pct, 0) / h.length).toFixed(1)),
        entregas_prematuras: h.filter(x => x.pct < 80).length,
        tendencia: h.length >= 3 ? (h[h.length - 1].pct - h[0].pct > 0 ? "mejorando" : h[h.length - 1].pct - h[0].pct < 0 ? "empeorando: presión de plazo comiendo calidad" : "estable") : "insuficiente",
        ultimas: h.slice(-8).map(x => ({ tipo: x.tipo, pct: x.pct, faltaban: x.faltantes.length })),
    });
});
server.tool("health_check", "Verifica que el servidor definition-of-done está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "definition-of-done", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[definition-of-done] fatal:", e);
    process.exit(1);
});

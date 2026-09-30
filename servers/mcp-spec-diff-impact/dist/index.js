#!/usr/bin/env node
/**
 * MCP Server: Spec Diff Impact
 * Cambia la spec en mitad de la ejecución y calcula el impacto: qué trabajo se invalida y qué sobrevive
 *
 * Dolor que resuelve: El humano cambia la spec cuando ya llevas 3 horas construyendo: el agente no sabe qué de lo hecho sirve, qué hay que tirar y qué hay que rehacer, así que lo rehace TODO (o nada).
 * Categoría: Especificación y Requisitos | Generado por mcp-suite | id: spec-diff-impact
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
// ——— persistencia local: ~/.mcp-suite/spec-diff-impact/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "spec-diff-impact");
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
const server = new McpServer({ name: "spec-diff-impact", version: "1.0.0" });
server.tool("save_version", "Guarda una versión de la spec (requisitos como lista) y devuelve el diff contra la anterior si existe.", {
    requisitos: z.array(z.any()).describe("Lista de requisitos de esta versión"),
    version_label: z.string().describe("Etiqueta (v1, post-feedback...)").optional(),
}, async (args) => {
    const { requisitos, version_label } = args;
    const st = store.load();
    st.versiones = st.versiones || [];
    const reqs = (requisitos || []).map(String).filter(Boolean);
    const prev = st.versiones[st.versiones.length - 1];
    const tokens = (s) => new Set(String(s).toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const v = { n: st.versiones.length + 1, label: version_label || "v" + (st.versiones.length + 1), requisitos: reqs, ts: new Date().toISOString() };
    if (prev) {
        v.diff = { añadidos: [], modificados: [], eliminados: [] };
        const prevSets = prev.requisitos.map(r => tokens(r));
        const nuevosSets = reqs.map(r => tokens(r));
        const usados = new Array(prev.requisitos.length).fill(false);
        for (let i = 0; i < reqs.length; i++) {
            let mejor = -1, mejorScore = 0;
            for (let j = 0; j < prev.requisitos.length; j++) {
                if (usados[j])
                    continue;
                const inter = [...nuevosSets[i]].filter(w => prevSets[j].has(w)).length;
                const score = inter / new Set([...nuevosSets[i], ...prevSets[j]]).size;
                if (score > mejorScore) {
                    mejorScore = score;
                    mejor = j;
                }
            }
            if (mejor === -1 || mejorScore < 0.25)
                v.diff.añadidos.push({ req: reqs[i] });
            else if (mejorScore < 0.85) {
                v.diff.modificados.push({ antes: prev.requisitos[mejor], ahora: reqs[i], similitud: Number(mejorScore.toFixed(2)) });
                usados[mejor] = true;
            }
            else
                usados[mejor] = true;
        }
        for (let j = 0; j < prev.requisitos.length; j++)
            if (!usados[j])
                v.diff.eliminados.push({ req: prev.requisitos[j] });
    }
    st.versiones.push(v);
    store.save(st);
    return ok({ version: v.n, label: v.label, requisitos: reqs.length, diff: v.diff || "primera versión (sin anterior)" });
});
server.tool("impact_analysis", "Dado el último cambio de spec y el trabajo hecho (lista de entregables), estima qué se invalida y qué sobrevive.", {
    trabajo_hecho: z.array(z.any()).describe("Entregables/artefactos producidos hasta ahora (texto)"),
    horas_invertidas: z.number().describe("Horas totales invertidas").optional(),
}, async (args) => {
    const { trabajo_hecho, horas_invertidas } = args;
    const st = store.load();
    if (st.versiones?.length < 2)
        return fail("necesitas >=2 versiones de spec (save_version)");
    const prev = st.versiones[st.versiones.length - 2];
    const cur = st.versiones[st.versiones.length - 1];
    const diff = cur.diff;
    if (!diff)
        return fail("el diff no se calculó");
    const tokens = (s) => new Set(String(s).toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const items = (trabajo_hecho || []).map(String).filter(Boolean);
    const eliminadosTokens = diff.eliminados.map(e => tokens(e.req));
    const modificadosTokens = diff.modificados.map(m => tokens(m.antes));
    const evaluacion = items.map(item => {
        const it = tokens(item);
        const pisaEliminado = eliminadosTokens.some(et => [...et].filter(w => it.has(w)).length >= Math.max(1, Math.floor(et.size * 0.3)));
        const pisaModificado = modificadosTokens.some(mt => [...mt].filter(w => it.has(w)).length >= Math.max(1, Math.floor(mt.size * 0.3)));
        const estado = pisaEliminado ? "INVALIDADO" : pisaModificado ? "REVISAR" : "SOBREVIVE";
        return { entregable: item.slice(0, 80), estado, razon: pisaEliminado ? "depende de requisito eliminado" : pisaModificado ? "requisito que sirve cambió de forma" : "no depende de nada que cambió" };
    });
    const pctInvalido = evaluacion.length ? evaluacion.filter(e => e.estado === "INVALIDADO").length / evaluacion.length : 0;
    const horasPerdidas = horas_invertidas ? Number((horas_invertidas * pctInvalido).toFixed(1)) : null;
    return ok({
        cambios: { añadidos: diff.añadidos.length, modificados: diff.modificados.length, eliminados: diff.eliminados.length },
        entregables: evaluacion,
        resumen: { invalidados: evaluacion.filter(e => e.estado === "INVALIDADO").length, revisar: evaluacion.filter(e => e.estado === "REVISAR").length, sobreviven: evaluacion.filter(e => e.estado === "SOBREVIVE").length },
        horas_estimadas_perdidas: horasPerdidas,
        consejo: "pRESUPUESTA el rework ANTES de aceptar el cambio de scope: " + (horasPerdidas ?? "calcula horas") + "h se pierden por requisitos eliminados",
    });
});
server.tool("version_history", "Historial completo de versiones de la spec con sus diffs resumidos.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const vs = st.versiones || [];
    if (!vs.length)
        return ok({ versiones: 0 });
    return ok({
        versiones: vs.map(v => ({
            n: v.n, label: v.label, requisitos: v.requisitos.length, ts: v.ts,
            cambio: v.diff ? "+ " + v.diff.añadidos.length + " / ~ " + v.diff.modificados.length + " / - " + v.diff.eliminados.length : "inicial",
        })),
    });
});
server.tool("churn_alert", "Analiza el churn de spec: frecuencia de cambios y si el cambio reciente es patrón (tercera vez que se pide lo mismo).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const vs = st.versiones || [];
    if (vs.length < 3)
        return ok({ versiones: vs.length, churn: "insuficiente para analizar" });
    const cambios = vs.slice(1).map(v => v.diff.añadidos.length + v.diff.modificados.length + v.diff.eliminados.length);
    const churnMedio = cambios.reduce((a, b) => a + b, 0) / cambios.length;
    const ventanas = [];
    for (let i = 0; i + 2 <= vs.length; i++)
        ventanas.push(Number(((new Date(vs[i + 1].ts).getTime() - new Date(vs[i].ts).getTime()) / 3600000).toFixed(1)));
    return ok({
        versiones: vs.length, cambios_por_version: cambios,
        churn_medio: Number(churnMedio.toFixed(1)),
        horas_entre_versiones: ventanas,
        veredicto: churnMedio > 4 ? "CHURN ALTO: la spec no está madura: congela cambios y pide una reunión de requisitos" : churnMedio > 2 ? "churn moderado: versiona menos y agrupa feedback" : "spec estable",
    });
});
server.tool("health_check", "Verifica que el servidor spec-diff-impact está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "spec-diff-impact", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[spec-diff-impact] fatal:", e);
    process.exit(1);
});

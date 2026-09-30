#!/usr/bin/env node
/**
 * MCP Server: Canary Deployer
 * Despliega cambios de agente al 10% del tráfico, mide, y decide con datos: promover o revertir
 *
 * Dolor que resuelve: El prompt nuevo se despliega al 100% de golpe: si degrada la calidad, se entera por las quejas de los usuarios con horas de daño. El canary clásico del backend jamás llegó al mundo de los agentes.
 * Categoría: Agent CI/CD | Generado por mcp-suite | id: canary-deployer
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
// ——— persistencia local: ~/.mcp-suite/canary-deployer/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "canary-deployer");
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
const server = new McpServer({ name: "canary-deployer", version: "1.0.0" });
server.tool("start_canary", "Inicia un canary: variante A (control) vs B (candidata) con % inicial de tráfico.", {
    sistema: z.string().describe("Qué se despliega (prompt, herramienta, configuración)"),
    control: z.string().describe("Identificador de la versión estable (A)"),
    candidata: z.string().describe("Identificador de la versión nueva (B)"),
    pct_inicial: z.number().describe("% de tráfico inicial a la candidata").default(10),
    min_muestras: z.number().describe("Muestras mínimas por variante antes de decidir").default(30),
    tolerancia_pct: z.number().describe("Pérdida máxima tolerada en la métrica principal").default(5),
}, async (args) => {
    const { sistema, control, candidata, pct_inicial, min_muestras, tolerancia_pct } = args;
    const st = store.load();
    st.canaries = st.canaries || [];
    const activo = st.canaries.find(c => c.sistema === sistema && c.estado === "ACTIVO");
    if (activo)
        return fail("ya hay un canary ACTIVO para " + sistema + " (id " + activo.id + "): ciérralo primero");
    const id = "cny_" + String(st.canaries.length + 1).padStart(4, "0");
    st.canaries.push({ id, sistema, control, candidata, pct: pct_inicial, min_muestras, tolerancia_pct, estado: "ACTIVO", resultados: { A: [], B: [] }, decision: null, iniciado: new Date().toISOString() });
    store.save(st);
    return ok({ id, sistema, reparto: { A: 100 - pct_inicial + "%", B: pct_inicial + "%" }, min_muestras_por_variante: min_muestras, tolerancia: tolerancia_pct + "% de pérdida máxima", siguiente: "envía resultados con record_result etiquetando la variante" });
});
server.tool("record_result", "Registra el resultado de una ejecución real bajo una variante.", {
    id: z.string().describe("Id del canary"),
    variante: z.enum(["A", "B"]).describe("Variante que sirvió la ejecución"),
    exito: z.boolean().describe("¿La ejecución cumplió su objetivo?"),
    latencia_ms: z.number().describe("Tiempo total").optional(),
    calidad: z.number().describe("Score de calidad 0-100 si lo mides").optional(),
}, async (args) => {
    const { id, variante, exito, latencia_ms, calidad } = args;
    const st = store.load();
    const c = (st.canaries || []).find(x => x.id === id);
    if (!c)
        return fail("canary no encontrado");
    if (c.estado !== "ACTIVO")
        return fail("canary " + c.estado + ": no admite resultados");
    c.resultados[variante].push({ exito, latencia_ms: latencia_ms ?? null, calidad: calidad ?? null, ts: new Date().toISOString() });
    store.save(st);
    const nA = c.resultados.A.length, nB = c.resultados.B.length;
    return ok({ id, variante, muestras: { A: nA, B: nB }, listas_para_decidir: nA >= c.min_muestras && nB >= c.min_muestras });
});
server.tool("evaluate_canary", "Evalúa el canary con banda de tolerancia: PROMOVER, MANTENER (más muestras) o ABORTAR.", {
    id: z.string().describe("Id del canary"),
    auto_escala: z.boolean().describe("Si se mantiene: sugerir subir el % de tráfico").default(true),
}, async (args) => {
    const { id, auto_escala } = args;
    const st = store.load();
    const c = (st.canaries || []).find(x => x.id === id);
    if (!c)
        return fail("canary no encontrado");
    const A = c.resultados.A, B = c.resultados.B;
    if (A.length < c.min_muestras || B.length < c.min_muestras)
        return ok({ estado: "MANTENER", razon: "muestras insuficientes (A:" + A.length + " B:" + B.length + " de " + c.min_muestras + ")", accion: "sigue registrando resultados" });
    const tasa = (arr) => arr.filter(r => r.exito).length / arr.length;
    const tA = tasa(A), tB = tasa(B);
    const deltaRel = tA > 0 ? (tB - tA) / tA * 100 : tB > 0 ? 100 : 0;
    const latA = A.filter(r => r.latencia_ms).length ? A.filter(r => r.latencia_ms).reduce((s, r) => s + r.latencia_ms, 0) / A.filter(r => r.latencia_ms).length : null;
    const latB = B.filter(r => r.latencia_ms).length ? B.filter(r => r.latencia_ms).reduce((s, r) => s + r.latencia_ms, 0) / B.filter(r => r.latencia_ms).length : null;
    let estado, razon, accion;
    if (deltaRel >= 0) {
        estado = "PROMOVER";
        razon = "la candidata mejora la tasa de éxito en " + Number(deltaRel.toFixed(1)) + "% (" + Number((tB * 100).toFixed(1)) + "% vs " + Number((tA * 100).toFixed(1)) + "%)";
        accion = "sube a 100% con promote";
    }
    else if (Math.abs(deltaRel) <= c.tolerancia_pct) {
        estado = "MANTENER";
        razon = "pérdida de " + Number(Math.abs(deltaRel).toFixed(1)) + "% dentro de la tolerancia de " + c.tolerancia_pct + "%";
        accion = auto_escala ? "sube el tráfico a " + Math.min(c.pct * 2, 50) + "% para ganar confianza" : "continúa recogiendo muestras";
    }
    else {
        estado = "ABORTAR";
        razon = "la candidata PEORA la tasa de éxito en " + Number(Math.abs(deltaRel).toFixed(1)) + "%, muy por encima de la tolerancia";
        accion = "vuelve todo el tráfico a A YA y etiqueta la candidata como rechazada";
    }
    return ok({ id, sistema: c.sistema, estado, razon, accion, metricas: { tasa_exito_A: Number((tA * 100).toFixed(1)) + "%", tasa_exito_B: Number((tB * 100).toFixed(1)) + "%", delta_relativo: Number(deltaRel.toFixed(1)) + "%", latencia_media_A: latA ? Math.round(latA) + "ms" : "n/d", latencia_media_B: latB ? Math.round(latB) + "ms" : "n/d" }, muestras: { A: A.length, B: B.length } });
});
server.tool("close_canary", "Cierra el canary con la decisión final aplicada (promovido o abortado).", {
    id: z.string().describe("Id del canary"),
    decision: z.enum(["promovida", "abortada", "empate_manual"]).describe("Decisión final"),
    nota: z.string().describe("Nota de cierre").optional(),
}, async (args) => {
    const { id, decision, nota } = args;
    const st = store.load();
    const c = (st.canaries || []).find(x => x.id === id);
    if (!c)
        return fail("canary no encontrado");
    if (c.estado !== "ACTIVO")
        return fail("ya cerrado");
    c.estado = decision === "promovida" ? "PROMOVIDA" : decision === "abortada" ? "ABORTADA" : "EMPATE";
    c.decision = { decision, nota: nota || "", ts: new Date().toISOString(), muestras_A: c.resultados.A.length, muestras_B: c.resultados.B.length };
    store.save(st);
    return ok({ id, cerrado: true, decision, efecto: decision === "promovida" ? "la candidata " + c.candidata + " es la nueva estable" : decision === "abortada" ? "todo el tráfico vuelve a " + c.control : "decisión humana documentada", leccion: decision === "abortada" ? "registra POR QUÉ falló la candidata: alimenta la próxima iteración" : null });
});
server.tool("health_check", "Verifica que el servidor canary-deployer está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "canary-deployer", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[canary-deployer] fatal:", e);
    process.exit(1);
});

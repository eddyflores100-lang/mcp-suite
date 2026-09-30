#!/usr/bin/env node
/**
 * MCP Server: Tenant Quota Manager
 * Cuotas por inquilino: tokens, llamadas y almacenaje con contadores que se agotan de verdad
 *
 * Dolor que resuelve: Un tenant consume el 80% del presupuesto compartido y el resto ve respuestas lentas o errores: sin cuotas duras por inquilino, el recurso compartido es una tragedia de los comunes garantizada.
 * Categoría: Multi-Tenant | Generado por mcp-suite | id: tenant-quota-manager
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
// ——— persistencia local: ~/.mcp-suite/tenant-quota-manager/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "tenant-quota-manager");
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
const server = new McpServer({ name: "tenant-quota-manager", version: "1.0.0" });
server.tool("set_quota", "Define la cuota de un tenant para el período actual.", {
    tenant: z.string().describe("Tenant"),
    tokens: z.number().describe("Máximo de tokens (0 = ilimitado)").default(0),
    llamadas: z.number().describe("Máximo de llamadas/tools").default(0),
    almacenaje_mb: z.number().describe("Máximo de MB en store").default(0),
}, async (args) => {
    const { tenant, tokens, llamadas, almacenaje_mb } = args;
    const st = store.load();
    st.tenants = st.tenants = st.tenants || {};
    st.cuotas = st.cuotas || {};
    const dia = new Date().toISOString().slice(0, 10);
    st.cuotas[tenant] = st.cuotas[tenant] || { contador: { tokens: 0, llamadas: 0, almacenaje_mb: 0 } };
    st.cuotas[tenant].limite = { tokens, llamadas, almacenaje_mb };
    st.cuotas[tenant].ventana = dia;
    store.save(st);
    return ok({ tenant, cuota: { tokens: tokens || "∞", llamadas: llamadas || "∞", almacenaje_mb: almacenaje_mb || "∞" }, ventana: dia, reinicio: "a medianoche (renueva la ventana con roll si cambia el día)" });
});
server.tool("consume", "Consume cuota: registra el gasto real del tenant en esta operación.", {
    tenant: z.string().describe("Tenant"),
    tokens: z.number().describe("Tokens gastados").default(0),
    llamadas: z.number().describe("Llamadas gastadas").default(1),
    almacenaje_mb: z.number().describe("MB añadidos").default(0),
}, async (args) => {
    const { tenant, tokens, llamadas, almacenaje_mb } = args;
    const st = store.load();
    const c = (st.cuotas || {})[tenant];
    if (!c)
        return fail("sin cuota definida para " + tenant + ": fíjala con set_quota");
    const hoy = new Date().toISOString().slice(0, 10);
    if (c.ventana !== hoy) {
        c.ventana = hoy;
        c.contador = { tokens: 0, llamadas: 0, almacenaje_mb: c.contador.almacenaje_mb };
    }
    c.contador.tokens += tokens;
    c.contador.llamadas += llamadas;
    c.contador.almacenaje_mb += almacenaje_mb;
    const excede = (usado, max) => max > 0 && usado > max;
    const bloqueos = [];
    if (excede(c.contador.tokens, c.limite.tokens))
        bloqueos.push("tokens: " + c.contador.tokens + "/" + c.limite.tokens);
    if (excede(c.contador.llamadas, c.limite.llamadas))
        bloqueos.push("llamadas: " + c.contador.llamadas + "/" + c.limite.llamadas);
    if (excede(c.contador.almacenaje_mb, c.limite.almacenaje_mb))
        bloqueos.push("almacenaje: " + Number(c.contador.almacenaje_mb.toFixed(1)) + "/" + c.limite.almacenaje_mb + "MB");
    store.save(st);
    return ok({ tenant, ventana: hoy, consumo_acumulado: { tokens: c.contador.tokens, llamadas: c.contador.llamadas, almacenaje_mb: Number(c.contador.almacenaje_mb.toFixed(2)) }, EN_CUOTA: bloqueos.length === 0, bloqueos_excedidos: bloqueos, accion_si_bloqueado: "degrada el servicio del tenant (respuestas más cortas, caché) o pausa hasta la próxima ventana: NO sigas gastando" });
});
server.tool("check_quota", "Consulta el margen restante del tenant ANTES de emprender una tarea grande.", {
    tenant: z.string().describe("Tenant"),
    tarea_requeriria: z.any().describe("Estimación de la tarea {tokens?, llamadas?}").optional(),
}, async (args) => {
    const { tenant, tarea_requeriria } = args;
    const st = store.load();
    const c = (st.cuotas || {})[tenant];
    if (!c)
        return fail("sin cuota definida: " + tenant);
    const hoy = new Date().toISOString().slice(0, 10);
    const activa = c.ventana === hoy ? c.contador : { tokens: 0, llamadas: 0, almacenaje_mb: c.contador.almacenaje_mb };
    const restante = {
        tokens: c.limite.tokens > 0 ? c.limite.tokens - activa.tokens : null,
        llamadas: c.limite.llamadas > 0 ? c.limite.llamadas - activa.llamadas : null
    };
    const req = tarea_requeriria || {};
    const cabe = (restante.tokens === null || (req.tokens || 0) <= restante.tokens) && (restante.llamadas === null || (req.llamadas || 0) <= restante.llamadas);
    return ok({ tenant, ventana: hoy, consumido: activa, restante: { tokens: restante.tokens ?? "∞", llamadas: restante.llamadas ?? "∞" }, tarea_estimada: req, cabe_la_tarea: cabe, uso_pct: { tokens: c.limite.tokens > 0 ? Number((activa.tokens / c.limite.tokens * 100).toFixed(0)) + "%" : "n/a", llamadas: c.limite.llamadas > 0 ? Number((activa.llamadas / c.limite.llamadas * 100).toFixed(0)) + "%" : "n/a" }, recomendacion: cabe ? "procede" : "NO cabe: divide la tarea, espera la renovación o renegocia cuota" });
});
server.tool("quota_report", "Panorama de cuotas: quién se acerca al límite, quién no usa la suya.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const cuotas = __ents(st.cuotas || {});
    if (!cuotas.length)
        return ok({ cuotas: 0, mensaje: "sin cuotas definidas" });
    const hoy = new Date().toISOString().slice(0, 10);
    const filas = cuotas.map(([tenant, c]) => {
        const cont = c.ventana === hoy ? c.contador : { tokens: 0, llamadas: 0 };
        const usoTokens = c.limite.tokens > 0 ? cont.tokens / c.limite.tokens : 0;
        const usoLlamadas = c.limite.llamadas > 0 ? cont.llamadas / c.limite.llamadas : 0;
        const uso = Math.max(usoTokens, usoLlamadas);
        return { tenant, uso_tokens_pct: c.limite.tokens ? Number((usoTokens * 100).toFixed(0)) + "%" : "∞", uso_llamadas_pct: c.limite.llamadas ? Number((usoLlamadas * 100).toFixed(0)) + "%" : "∞", estado: uso >= 1 ? "AGOTADO" : uso >= 0.85 ? "CRÍTICO (>85%)" : uso >= 0.6 ? "alto" : uso > 0 ? "normal" : "sin uso" };
    }).sort((a, b) => (b.uso_tokens_pct === "∞" ? 0 : 1) - (a.uso_tokens_pct === "∞" ? 0 : 1));
    const criticos = filas.filter(f => f.estado === "CRÍTICO (>85%)" || f.estado === "AGOTADO");
    const sinUso = filas.filter(f => f.estado === "sin uso");
    return ok({ tenants: filas.length, filas, criticos, sin_uso: sinUso, redistribucion: criticos.length && sinUso.length ? "hay " + sinUso.length + " tenants sin uso y " + criticos.length + " al límite: el presupuesto compartido está mal repartido, renegocia" : "reparto razonable" });
});
server.tool("health_check", "Verifica que el servidor tenant-quota-manager está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "tenant-quota-manager", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[tenant-quota-manager] fatal:", e);
    process.exit(1);
});

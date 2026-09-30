#!/usr/bin/env node
/**
 * MCP Server: Cross-Tenant Guard
 * Guardián de flujos entre inquilinos: ninguna transferencia de datos cruza tenants sin política explícita que lo permita
 *
 * Dolor que resuelve: El agente 'optimiza' combinando datos de dos clientes para responder mejor a un tercero: nadie le dijo que ese flujo cruzado estaba prohibido, porque el prohibido no estaba escrito en ninguna parte.
 * Categoría: Multi-Tenant | Generado por mcp-suite | id: cross-tenant-guard
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
// ——— persistencia local: ~/.mcp-suite/cross-tenant-guard/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "cross-tenant-guard");
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
const server = new McpServer({ name: "cross-tenant-guard", version: "1.0.0" });
server.tool("set_policy", "Define qué flujos entre tenants están PERMITIDOS (todo lo demás se deniega por defecto).", {
    nombre: z.string().describe("Nombre de la política"),
    desde_clasificacion: z.enum(["publico", "interno", "confidencial", "pii"]).describe("Clasificación del origen"),
    hacia_clasificacion_max: z.enum(["publico", "interno", "confidencial", "pii"]).describe("Clasificación máxima del destino"),
    permitido: z.boolean().describe("¿Se permite este patrón?"),
    condicion: z.string().describe("Condición adicional si se permite").optional(),
}, async (args) => {
    const { nombre, desde_clasificacion, hacia_clasificacion_max, permitido, condicion } = args;
    const st = store.load();
    st.politicas = st.politicas || [];
    st.politicas = st.politicas.filter(p => !(p.nombre === nombre));
    st.politicas.push({ nombre, desde_clasificacion, hacia_clasificacion_max, permitido, condicion: condicion || "", creada: new Date().toISOString() });
    store.save(st);
    return ok({ politica: nombre, flujo: desde_clasificacion + " -> " + hacia_clasificacion_max + " = " + (permitido ? "PERMITIDO" + (condicion ? " (" + condicion + ")" : "") : "DENEGADO"), politicas_totales: st.politicas.length, nota: "lo no cubierto por ninguna política se DENIEGA por defecto (fail-closed)" });
});
server.tool("check_transfer", "Valida una transferencia concreta: origen, destino y clasificaciones; devuelve veredicto fail-closed.", {
    tenant_origen: z.string().describe("Tenant que aporta el dato"),
    clasificacion_origen: z.enum(["publico", "interno", "confidencial", "pii"]).describe("Clasificación del dato que se mueve"),
    tenant_destino: z.string().describe("Tenant que recibiría"),
    clasificacion_destino: z.enum(["publico", "interno", "confidencial", "pii"]).describe("Nivel de protección del destino"),
    proposito: z.string().describe("Para qué se transferiría").optional(),
}, async (args) => {
    const { tenant_origen, clasificacion_origen, tenant_destino, clasificacion_destino, proposito } = args;
    const st = store.load();
    const mismoTenant = tenant_origen === tenant_destino;
    if (mismoTenant)
        return ok({ permitido: true, razon: "mismo tenant (" + tenant_origen + "): flujo interno, sin restricción entre clasificaciones" });
    if (clasificacion_origen === "pii") {
        st.violaciones = st.violaciones || [];
        st.violaciones.push({ tipo: "PII_CRUZADA", tenant_origen, tenant_destino, clasificacion_origen, proposito: proposito || "", ts: new Date().toISOString() });
        store.save(st);
        return ok({ permitido: false, razon: "PII NUNCA cruza tenants: ni con política, ni con consentimiento verbal del modelo, ni 'solo esta vez'", severidad: "CRÍTICA", registrada: true });
    }
    const politicas = st.politicas || [];
    const aplica = politicas.filter(p => p.desde_clasificacion === clasificacion_origen && p.permitido);
    const orden = { publico: 0, interno: 1, confidencial: 2, pii: 3 };
    const cubre = aplica.find(p => orden[clasificacion_destino] <= orden[p.hacia_clasificacion_max]);
    if (cubre) {
        st.transferencias = st.transferencias || [];
        st.transferencias.push({ tenant_origen, tenant_destino, clasificacion_origen, clasificacion_destino, politica: cubre.nombre, proposito: proposito || "", ts: new Date().toISOString() });
        store.save(st);
        return ok({ permitido: true, politica: cubre.nombre, condicion: cubre.condicion || null, razon: "flujo cubierto por política explícita", registrado: true });
    }
    st.violaciones = st.violaciones || [];
    st.violaciones.push({ tipo: "SIN_POLITICA", tenant_origen, tenant_destino, clasificacion_origen, proposito: proposito || "", ts: new Date().toISOString() });
    store.save(st);
    return ok({ permitido: false, razon: "FAIL-CLOSED: flujo '" + clasificacion_origen + "' hacia otro tenant SIN política que lo permita: si es legítimo, créala explícitamente con set_policy", severidad: "alta", registrada: true });
});
server.tool("violations", "Registro de intentos de flujo cruzado denegados, con contexto.", {
    solo_criticas: z.boolean().describe("Solo PII cruzada").default(false),
}, async (args) => {
    const { solo_criticas } = args;
    const st = store.load();
    let v = st.violaciones || [];
    if (solo_criticas)
        v = v.filter(x => x.tipo === "PII_CRUZADA");
    if (!v.length)
        return ok({ violaciones: 0, mensaje: "sin intentos de flujo cruzado: excelente" });
    const porPar = {};
    v.forEach(x => { const k = x.tenant_origen + " -> " + x.tenant_destino; porPar[k] = (porPar[k] || 0) + 1; });
    return ok({ violaciones: v.length, criticas_pii: (st.violaciones || []).filter(x => x.tipo === "PII_CRUZADA").length, por_par_origen_destino: porPar, ultimas: v.slice(-10), patron: Object.keys(porPar).find(k => porPar[k] >= 3) || null, alerta: Object.keys(porPar).some(k => porPar[k] >= 3) ? "un mismo par de tenants acumula 3+ intentos denegados: algo del diseño del agente está empujando ese flujo, arréglalo de raíz" : "intentos aislados" });
});
server.tool("health_check", "Verifica que el servidor cross-tenant-guard está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "cross-tenant-guard", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[cross-tenant-guard] fatal:", e);
    process.exit(1);
});

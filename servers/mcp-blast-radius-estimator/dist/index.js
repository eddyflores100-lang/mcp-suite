#!/usr/bin/env node
/**
 * MCP Server: Blast Radius Estimator
 * Antes de ejecutar una acción: estima cuántos sistemas, datos y usuarios quedan dentro del radio de impacto
 *
 * Dolor que resuelve: El agente borra una tabla 'inocente' y descubre que alimentaba 3 servicios: nadie le dijo que estimara el radio de explosión de sus acciones antes de pulsar el botón.
 * Categoría: Pre-Vuelo | Generado por mcp-suite | id: blast-radius-estimator
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
// ——— persistencia local: ~/.mcp-suite/blast-radius-estimator/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "blast-radius-estimator");
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
const server = new McpServer({ name: "blast-radius-estimator", version: "1.0.0" });
server.tool("register_system", "Registra un sistema/recurso del entorno con criticidad y dependientes directos.", {
    sistema: z.string().describe("Nombre del sistema/recurso (ej: db-usuarios)"),
    criticidad: z.enum(["baja", "media", "alta", "critica"]).describe("Criticidad del sistema"),
    descripcion: z.string().describe("Qué es y para qué sirve").optional(),
    dependientes: z.array(z.any()).describe("Sistemas que dependen de este {sistema, porque}").optional(),
}, async (args) => {
    const { sistema, criticidad, descripcion, dependientes } = args;
    const st = store.load();
    st.sistemas = st.sistemas || {};
    if (st.sistemas[sistema])
        return fail("sistema ya registrado: " + sistema + " (usa add_dependency para extenderlo)");
    const pesos = { baja: 1, media: 2, alta: 3, critica: 5 };
    st.sistemas[sistema] = { sistema, criticidad, peso: pesos[criticidad] || 2, descripcion: descripcion || "", dependientes: (dependientes || []).map(d => ({ sistema: String(d.sistema || d), porque: String(d.porque || "dependencia no documentada") })), creado: new Date().toISOString() };
    store.save(st);
    return ok({ sistema, criticidad, dependientes_registrados: st.sistemas[sistema].dependientes.length });
});
server.tool("add_dependency", "Añade una dependencia: 'consumidor' depende de 'proveedor'. Alimenta la propagación del radio.", {
    proveedor: z.string().describe("Sistema del que se depende"),
    consumidor: z.string().describe("Sistema que depende del proveedor"),
    porque: z.string().describe("Por qué depende (dato, servicio, colateral)"),
}, async (args) => {
    const { proveedor, consumidor, porque } = args;
    const st = store.load();
    st.sistemas = st.sistemas || {};
    if (!st.sistemas[proveedor])
        return fail("proveedor no registrado: " + proveedor + " (regístralo primero con register_system)");
    if (!st.sistemas[consumidor])
        return fail("consumidor no registrado: " + consumidor);
    st.sistemas[proveedor].dependientes.push({ sistema: consumidor, porque });
    store.save(st);
    return ok({ edge: consumidor + " -> " + proveedor, porque, total_dependientes: st.sistemas[proveedor].dependientes.length });
});
server.tool("estimate", "Calcula el blast radius de una acción: propagación transitiva por el grafo con pesos y veredicto de aprobación.", {
    accion: z.string().describe("Acción a evaluar (ej: DROP TABLE usuarios)"),
    objetivos: z.array(z.any()).describe("Sistemas/recursos que la acción toca directamente"),
    modo: z.enum(["lectura", "escritura", "borrado", "configuracion"]).describe("Modo de acceso"),
}, async (args) => {
    const { accion, objetivos, modo } = args;
    const st = store.load();
    const sis = st.sistemas || {};
    if (!Object.keys(sis).length)
        return fail("grafo vacío: registra sistemas con register_system");
    const objetivosValidos = (objetivos || []).filter(o => sis[String(o)]);
    const desconocidos = (objetivos || []).filter(o => !sis[String(o)]).map(String);
    if (!objetivosValidos.length)
        return fail("ningún objetivo está en el grafo" + (desconocidos.length ? " (desconocidos: " + desconocidos.join(", ") + ")" : ""));
    const multi = { lectura: 0.3, escritura: 1, borrado: 1.6, configuracion: 1.3 };
    const factor = multi[modo] || 1;
    const afectados = {};
    const cola = objetivosValidos.map(o => String(o));
    let profundidad = 0;
    while (cola.length && profundidad < 6) {
        const actual = cola.shift();
        if (afectados[actual] !== undefined)
            continue;
        afectados[actual] = profundidad;
        const deps = (sis[actual].dependientes || []).map(d => d.sistema).filter(s => sis[s] && afectados[s] === undefined);
        deps.forEach(d => cola.push(d));
        profundidad++;
    }
    const lista = Object.keys(afectados).map(s => ({ sistema: s, criticidad: sis[s].criticidad, nivel_propagacion: afectados[s], por_que: afectados[s] === 0 ? "objetivo directo" : "depende de nivel " + (afectados[s] - 1) }));
    const score = Math.round(lista.reduce((acc, a) => acc + sis[a.sistema].peso * (1 + 0.4 / (a.nivel_propagacion + 1)), 0) * factor);
    const criticos = lista.filter(a => a.criticidad === "critica" || a.criticidad === "alta");
    const veredicto = score >= 40 || criticos.some(c => c.nivel_propagacion === 0) ? "BLOQUEAR: requiere aprobación humana explícita antes de ejecutar" : score >= 15 ? "PRECAUCIÓN: notifica a los sistemas afectados y captura punto de restauración" : "BAJO: procede con registro de efectos en side-effect-ledger";
    st.historial = st.historial || [];
    st.historial.push({ accion, objetivos: objetivosValidos.map(String), modo, score, veredicto, ts: new Date().toISOString() });
    store.save(st);
    return ok({ accion, modo, factor_amplificacion: factor, sistemas_en_radio: lista.length, radio: lista, score_impacto: score, sistemas_criticos_alcanzados: criticos, objetivos_fuera_del_grafo: desconocidos, veredicto });
});
server.tool("blast_history", "Historial de estimaciones: qué acciones tuvieron mayor radio estimado.", {
    limite: z.number().describe("Máximo a mostrar").default(10),
}, async (args) => {
    const { limite } = args;
    const st = store.load();
    const h = (st.historial || []).slice().sort((a, b) => b.score - a.score).slice(0, limite);
    return ok({ estimaciones: (st.historial || []).length, top_estimaciones: h });
});
server.tool("coverage_report", "Qué parte del entorno real está modelado en el grafo (anti-puntos-ciegos).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const sis = st.sistemas || {};
    const nombres = Object.keys(sis);
    if (!nombres.length)
        return ok({ modelados: 0, aviso: "grafo vacío: todo es punto ciego" });
    const sinDependientes = nombres.filter(n => !(sis[n].dependientes || []).length);
    const huerfanos = nombres.filter(n => !nombres.some(m => (sis[m].dependientes || []).some(d => d.sistema === n)));
    return ok({ sistemas_modelados: nombres.length, por_criticidad: { critica: nombres.filter(n => sis[n].criticidad === "critica").length, alta: nombres.filter(n => sis[n].criticidad === "alta").length }, sin_dependientes_declarados: sinDependientes, huerfanos_nadie_depende: huerfanos, aviso: huerfanos.length > nombres.length / 2 ? "más de la mitad del grafo está aislado: el radio se subestima, completa las dependencias" : "grafo razonablemente conectado" });
});
server.tool("health_check", "Verifica que el servidor blast-radius-estimator está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "blast-radius-estimator", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[blast-radius-estimator] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Budget Forecast
 * Proyección de gasto futuro basada en histórico: sabe cuánto costará el mes antes de gastarlo
 *
 * Dolor que resuelve: El gasto de agentes es imprevisible: el equipo descubre a mitad de mes que al ritmo actual el presupuesto vuela, cuando ya es tarde para ajustar el mix de trabajo.
 * Categoría: Economía del Agente | Generado por mcp-suite | id: budget-forecast
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
// ——— persistencia local: ~/.mcp-suite/budget-forecast/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "budget-forecast");
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
const server = new McpServer({ name: "budget-forecast", version: "1.0.0" });
server.tool("log_daily_spend", "Registra el gasto acumulado de un día (USD).", {
    usd: z.number().describe("Gasto del día"),
    dia: z.string().describe("Fecha ISO (default: hoy)").optional(),
}, async (args) => {
    const { usd, dia } = args;
    const st = store.load();
    st.diario = st.diario || {};
    const d = (dia || new Date().toISOString()).slice(0, 10);
    st.diario[d] = Number(((st.diario[d] || 0) + usd).toFixed(4));
    store.save(st);
    return ok({ dia: d, gasto_dia: st.diario[d] });
});
server.tool("burn_rate", "Burn-rate actual: gasto diario medio (últimos 7 y 30 días) y tendencia.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const dias = __ents(st.diario || {}).sort(([a], [b]) => a < b ? -1 : 1);
    if (dias.length < 3)
        return ok({ dias_registrados: dias.length, burn: "insuficiente (mínimo 3 días)" });
    const ultimos7 = dias.slice(-7);
    const ultimos30 = dias.slice(-30);
    const media7 = ultimos7.reduce((s, [, v]) => s + v, 0) / ultimos7.length;
    const media30 = ultimos30.reduce((s, [, v]) => s + v, 0) / ultimos30.length;
    const total = dias.reduce((s, [, v]) => s + v, 0);
    return ok({
        dias_registrados: dias.length,
        total_gastado: Number(total.toFixed(2)),
        burn_diario_7d: Number(media7.toFixed(3)),
        burn_diario_30d: Number(media30.toFixed(3)),
        tendencia: media30 ? Number((((media7 - media30) / media30) * 100).toFixed(1)) : null,
        lectura: media7 > media30 * 1.15 ? "acelerando +15%: revisa qué cambió" : media7 < media30 * 0.85 ? "frenando" : "ritmo estable",
    });
});
server.tool("forecast_month", "Proyección de cierre de mes: gasto acumulado + proyección, contra presupuesto objetivo.", {
    presupuesto_mensual: z.number().describe("Presupuesto del mes (USD)").optional(),
}, async (args) => {
    const { presupuesto_mensual } = args;
    const st = store.load();
    const dias = __ents(st.diario || {}).sort(([a], [b]) => a < b ? -1 : 1);
    if (dias.length < 5)
        return fail("necesitas >=5 días de histórico");
    const hoy = new Date();
    const mesActual = hoy.toISOString().slice(0, 7);
    const diasMes = dias.filter(([d]) => d.startsWith(mesActual));
    if (!diasMes.length)
        return fail("sin registros del mes en curso");
    const diaDelMes = hoy.getDate();
    const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const gastado = diasMes.reduce((s, [, v]) => s + v, 0);
    const mediaDiaria = gastado / diasMes.length;
    const proyeccion = mediaDiaria * diasEnMes;
    const resultado = presupuesto_mensual
        ? { presupuesto: presupuesto_mensual, proyeccion: Number(proyeccion.toFixed(2)), excedido_estimado: Number((proyeccion - presupuesto_mensual).toFixed(2)), pct_presupuesto: Number((proyeccion / presupuesto_mensual * 100).toFixed(1)) }
        : { proyeccion: Number(proyeccion.toFixed(2)) };
    return ok({
        mes: mesActual,
        dia_del_mes: diaDelMes + "/" + diasEnMes,
        gastado: Number(gastado.toFixed(2)),
        media_diaria: Number(mediaDiaria.toFixed(3)),
        ...resultado,
        veredicto: presupuesto_mensual ? (proyeccion > presupuesto_mensual ? "SOBREPRESUPUESTO: recorta " + Number((proyeccion - presupuesto_mensual).toFixed(2)) + " USD o sube el presupuesto YA" : "dentro de presupuesto con margen de " + Number((presupuesto_mensual - proyeccion).toFixed(2)) + " USD") : "sin presupuesto de referencia: define uno",
        dias_para_quiebre: presupuesto_mensual ? Math.max(0, Math.floor((presupuesto_mensual - gastado) / Math.max(mediaDiaria, 0.001))) : null,
    });
});
server.tool("anomaly_spend", "Detecta días de gasto anómalo (picos) y los asocia a la actividad de ese día.", {
    umbral_x: z.number().describe("Múltiplo de la media que cuenta como pico").default(2.5),
}, async (args) => {
    const { umbral_x } = args;
    const st = store.load();
    const dias = __ents(st.diario || {}).sort(([a], [b]) => a < b ? -1 : 1);
    if (dias.length < 7)
        return fail("necesitas >=7 días");
    const valores = dias.map(([, v]) => v).sort((a, b) => a - b);
    const mediana = valores[Math.floor(valores.length / 2)];
    const picos = dias.filter(([d, v]) => v > mediana * umbral_x);
    return ok({
        mediana_diaria: Number(mediana.toFixed(3)),
        picos: picos.map(([d, v]) => ({ dia: d, gasto: Number(v.toFixed(3)), vs_mediana: Number((v / mediana).toFixed(1)) + "x" })),
        consejo: picos.length ? "cada pico explica dónde se va el dinero: audita esos días (token-audit)" : "gasto homogéneo",
    });
});
server.tool("health_check", "Verifica que el servidor budget-forecast está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "budget-forecast", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[budget-forecast] fatal:", e);
    process.exit(1);
});

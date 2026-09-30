#!/usr/bin/env node
/**
 * MCP Server: Error Triage
 * Clasifica errores, sugiere acción y registra patrón: la sala de emergencias del agente
 *
 * Dolor que resuelve: Los errores se acumulan sin clasificar: sin triage no se sabe qué es transitorio, qué es bug y qué es configuración.
 * Categoría: Observabilidad | Generado por mcp-suite | id: error-triage
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
// ——— persistencia local: ~/.mcp-suite/error-triage/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "error-triage");
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
const server = new McpServer({ name: "error-triage", version: "1.0.0" });
server.tool("classify", "Clasifica un error en taxonomía (red/auth/validación/límite/bug/datos) y sugiere la acción inmediata.", {
    error: z.string().describe("Mensaje de error"),
    contexto: z.string().describe("Qué tool/operación lo produjo").optional(),
}, async (args) => {
    const { error, contexto } = args;
    const e = String(error).toLowerCase();
    let categoria = "desconocido";
    let accion = "investigar manualmente";
    let severidad = "media";
    if (/timeout|etimedout|econn|network|fetch failed|enotfound/.test(e)) {
        categoria = "red";
        accion = "retry con backoff (retry-orchestrator); si persiste, circuit-breaker";
        severidad = "alta";
    }
    else if (/401|403|unauthorized|forbidden|invalid api key|token/.test(e)) {
        categoria = "auth";
        accion = "verificar credenciales/permisos; nunca reintentar a ciegas";
        severidad = "critica";
    }
    else if (/429|rate.?limit|quota|too many/.test(e)) {
        categoria = "limite";
        accion = "esperar y respetar rate-limiter";
        severidad = "media";
    }
    else if (/400|422|invalid|schema|validation|parse|malformed/.test(e)) {
        categoria = "validacion";
        accion = "corregir input; validar con schema-validator";
        severidad = "media";
    }
    else if (/5\d\d|internal|gateway/.test(e)) {
        categoria = "upstream";
        accion = "retry 1-2 veces; reportar si persiste";
        severidad = "alta";
    }
    else if (/not found|404/.test(e)) {
        categoria = "datos";
        accion = "verificar id/url; quizá fue eliminado";
        severidad = "baja";
    }
    else if (/enomem|memory|heap/.test(e)) {
        categoria = "recursos";
        accion = "reducir batch size; trocear con batch-runner";
        severidad = "critica";
    }
    const st = store.load();
    st.patrones = st.patrones || {};
    st.patrones[categoria] = (st.patrones[categoria] || 0) + 1;
    store.save(st);
    return ok({ categoria, severidad, accion, reintentable: ["red", "limite", "upstream"].includes(categoria) });
});
server.tool("pattern_report", "Reporte de patrones de error acumulados: qué categorías dominan (para atacar la causa raíz).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const patrones = __ents(st.patrones || {}).sort((a, b) => b[1] - a[1]);
    return ok({ patrones, dominante: patrones[0]?.[0] || null, recomendacion: patrones[0] ? "ataca primero la categoría " + patrones[0][0] : "sin errores registrados" });
});
server.tool("health_check", "Verifica que el servidor error-triage está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "error-triage", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[error-triage] fatal:", e);
    process.exit(1);
});

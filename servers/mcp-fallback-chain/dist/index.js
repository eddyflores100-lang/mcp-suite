#!/usr/bin/env node
/**
 * MCP Server: Fallback Chain
 * Cadenas de respaldo: si A falla prueba B, luego C — con registro
 *
 * Dolor que resuelve: Cuando la tool primaria falla no hay plan B estructurado: el agente improvisa en vez de seguir una cadena de fallbacks.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: fallback-chain
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
// ——— persistencia local: ~/.mcp-suite/fallback-chain/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "fallback-chain");
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
const server = new McpServer({ name: "fallback-chain", version: "1.0.0" });
server.tool("build_chain", "Define una cadena de fallback para una capacidad: lista ordenada de herramientas/métodos alternativos.", {
    capacidad: z.string().describe("Capacidad (ej: busqueda-web)"),
    herramientas: z.array(z.any()).describe("Tools alternativas en orden de preferencia"),
}, async (args) => {
    const { capacidad, herramientas } = args;
    const st = store.load();
    st.cadenas = st.cadenas || {};
    st.cadenas[capacidad] = { pasos: Array.isArray(herramientas) ? herramientas : [], creado: new Date().toISOString() };
    store.save(st);
    return ok({ capacidad, cadena: st.cadenas[capacidad].pasos });
});
server.tool("next_fallback", "Devuelve el siguiente paso a probar en la cadena dado el que falló (y registra el fallo para estadística).", {
    capacidad: z.string().describe("Capacidad"),
    fallo_en: z.string().describe("Herramienta que falló"),
}, async (args) => {
    const { capacidad, fallo_en } = args;
    const st = store.load();
    const cadena = st.cadenas?.[capacidad];
    if (!cadena)
        return fail("cadena no definida: build_chain primero");
    const idx = cadena.pasos.indexOf(fallo_en);
    const siguiente = idx >= 0 && idx < cadena.pasos.length - 1 ? cadena.pasos[idx + 1] : null;
    st.fallos = st.fallos || [];
    st.fallos.push({ capacidad, herramienta: fallo_en, ts: new Date().toISOString() });
    store.save(st);
    return ok({ siguiente, agotada: siguiente === null, cadena_completa: cadena.pasos });
});
server.tool("report", "Reporte de fallos por capacidad: qué eslabones fallan más (para reordenar cadenas).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const conteo = {};
    for (const f of st.fallos || []) {
        const k = f.capacidad + "::" + f.herramienta;
        conteo[k] = (conteo[k] || 0) + 1;
    }
    return ok({ fallos_por_eslabon: __ents(conteo).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ eslabon: k, fallos: n })) });
});
server.tool("health_check", "Verifica que el servidor fallback-chain está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "fallback-chain", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[fallback-chain] fatal:", e);
    process.exit(1);
});

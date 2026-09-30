#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Diff Monitor
 * Vigila cambios del marketplace: nuevas skills, scores que caen, tiers que empeoran
 *
 * Dolor que resuelve: El marketplace cambia a diario y nadie avisa: una skill safe puede volverse risky sin que el agente se entere.
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-diff-monitor
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
// ——— persistencia local: ~/.mcp-suite/marketnow-diff-monitor/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "marketnow-diff-monitor");
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
// ——— fetch inteligente: timeout + reintentos ———
async function fetchSmart(url, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 20000;
    let lastError = null;
    for (let attempt = 0; attempt <= (opts.retries ?? 2); attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                method: opts.method || "GET",
                headers: { "user-agent": "mcp-suite/marketnow-diff-monitor", ...(opts.headers || {}) },
                body: opts.body,
                signal: ctrl.signal,
            });
            const text = await res.text();
            let json = null;
            try {
                json = JSON.parse(text);
            }
            catch { /* no JSON */ }
            return { status: res.status, text, json };
        }
        catch (e) {
            lastError = e;
            if (attempt < (opts.retries ?? 2))
                await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
        finally {
            clearTimeout(timer);
        }
    }
    throw new Error("fetch falló tras reintentos: " + (lastError?.message || url));
}
const server = new McpServer({ name: "marketnow-diff-monitor", version: "1.0.0" });
server.tool("snapshot_now", "Captura el estado actual del marketplace (audit-report + stats) y lo guarda localmente. Devuelve resumen del momento.", {
// sin parámetros
}, async (args) => {
    const r = await fetchSmart("https://marketnow.site/api/audit-report.json");
    if (!r.json)
        return fail("sin respuesta");
    const st = store.load();
    st.snapshots = st.snapshots || [];
    const snap = { ts: new Date().toISOString(), total: r.json.total_skills, summary: r.json.summary };
    st.snapshots.push(snap);
    if (st.snapshots.length > 50)
        st.snapshots = st.snapshots.slice(-50);
    store.save(st);
    return ok({ capturado: snap, total_snapshots: st.snapshots.length });
});
server.tool("diff_last", "Compara los dos últimos snapshots guardados: qué cambió en totales y clasificaciones (safe/caution/risky/dangerous).", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    if (!st.snapshots || st.snapshots.length < 2)
        return fail("necesitas al menos 2 snapshots: ejecuta snapshot_now en momentos distintos");
    const [prev, cur] = [st.snapshots[st.snapshots.length - 2], st.snapshots[st.snapshots.length - 1]];
    const keys = ["safe", "caution", "risky", "dangerous", "not_audited"];
    const cambios = {};
    for (const k of keys)
        cambios[k] = (cur.summary?.[k] ?? 0) - (prev.summary?.[k] ?? 0);
    return ok({ prev: { ts: prev.ts, total: prev.total }, actual: { ts: cur.ts, total: cur.total }, deltas: cambios, alerta: cambios.dangerous > 0 ? "+skills dangerous: revisar" : "sin empeoramiento crítico" });
});
server.tool("history", "Devuelve el historial completo de snapshots guardados (máx 50) para análisis de tendencia.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    return ok({ snapshots: st.snapshots || [], nota: "ejecuta snapshot_now periódicamente para construir tendencia" });
});
server.tool("health_check", "Verifica que el servidor marketnow-diff-monitor está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "marketnow-diff-monitor", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[marketnow-diff-monitor] fatal:", e);
    process.exit(1);
});

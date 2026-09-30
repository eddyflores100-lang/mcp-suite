#!/usr/bin/env node
/**
 * MCP Server: Currency Convert
 * Conversión de monedas: tasas en vivo (API abierta) + tabla de respaldo offline
 *
 * Dolor que resuelve: El LLM no conoce la tasa del dólar HOY: convertir precios con tasas 'recordadas' da cifras falsas.
 * Categoría: Utilidades | Generado por mcp-suite | id: currency-convert
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
// ——— persistencia local: ~/.mcp-suite/currency-convert/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "currency-convert");
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
                headers: { "user-agent": "mcp-suite/currency-convert", ...(opts.headers || {}) },
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
const server = new McpServer({ name: "currency-convert", version: "1.0.0" });
server.tool("convert", "Convierte un monto entre monedas usando tasas en vivo (open.er-api.com, gratis) con cache de 6h; si no hay red usa tabla de respaldo aproximada.", {
    monto: z.number().describe("Monto a convertir"),
    de: z.string().describe("Moneda origen (ej: USD)"),
    a: z.string().describe("Moneda destino (ej: EUR)"),
}, async (args) => {
    const { monto, de, a } = args;
    const st = store.load();
    const cacheValido = st.tasas && st.tasas_ts && Date.now() - new Date(st.tasas_ts).getTime() < 6 * 3600000;
    let tasas = null;
    let fuente = "cache";
    if (cacheValido)
        tasas = st.tasas;
    else {
        try {
            const r = await fetchSmart("https://open.er-api.com/v6/latest/" + String(de).toUpperCase(), { timeoutMs: 10000, retries: 1 });
            if (r.json?.rates) {
                tasas = r.json.rates;
                st.tasas = tasas;
                st.tasas_ts = new Date().toISOString();
                store.save(st);
                fuente = "live (open.er-api.com)";
            }
        }
        catch { /* sin red */ }
    }
    const fallback = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, MXN: 17.2, COP: 4100, CLP: 940, PEN: 3.75, BRL: 5.5, ARS: 900 };
    if (!tasas) {
        tasas = fallback;
        fuente = "fallback aproximado (sin red)";
    }
    const tasaDirecta = tasas[String(a).toUpperCase()];
    if (tasaDirecta === undefined)
        return fail("moneda no disponible: " + a);
    const resultado = Math.round(monto * tasaDirecta * 100) / 100;
    return ok({ monto, de: String(de).toUpperCase(), a: String(a).toUpperCase(), tasa: tasaDirecta, resultado, fuente, actualizado: st.tasas_ts || "fallback" });
});
server.tool("cross_table", "Tabla cruzada de conversión de un monto base contra varias monedas a la vez.", {
    monto: z.number().describe("Monto base"),
    de: z.string().describe("Moneda base").default("USD"),
    monedas: z.array(z.any()).describe("Monedas destino").optional(),
}, async (args) => {
    const { monto, de, monedas } = args;
    const st = store.load();
    const lista = Array.isArray(monedas) && monedas.length ? monedas : ["USD", "EUR", "CAD", "MXN", "COP", "PEN", "BRL", "CLP"];
    let tasas = st.tasas;
    if (!tasas) {
        try {
            const r = await fetchSmart("https://open.er-api.com/v6/latest/" + String(de || "USD").toUpperCase(), { timeoutMs: 10000, retries: 1 });
            if (r.json?.rates) {
                tasas = r.json.rates;
                st.tasas = tasas;
                st.tasas_ts = new Date().toISOString();
                store.save(st);
            }
        }
        catch {
            tasas = null;
        }
    }
    const tabla = {};
    for (const m of lista) {
        const tasa = tasas?.[String(m).toUpperCase()];
        if (tasa)
            tabla[m] = Math.round(monto * tasa * 100) / 100;
    }
    return ok({ base: String(de || "USD").toUpperCase() + " " + monto, tabla, fuente: st.tasas ? "cache/live" : "sin datos" });
});
server.tool("health_check", "Verifica que el servidor currency-convert está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "currency-convert", tools: 3, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[currency-convert] fatal:", e);
    process.exit(1);
});

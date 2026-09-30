#!/usr/bin/env node
/**
 * MCP Server: MarketNow · Skill Search
 * Busca entre los 66.496 skills MCP del catálogo de MarketNow con índice local + modo en vivo
 *
 * Dolor que resuelve: Descubrir skills MCP confiables es difícil: el registro MCP, Smithery y Glama resolvieron discovery, pero el agente necesita buscar/filtrar por score de seguridad y categoría.
 * Categoría: MarketNow | Generado por mcp-suite | id: marketnow-search
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
// ——— persistencia local: ~/.mcp-suite/marketnow-search/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "marketnow-search");
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
                headers: { "user-agent": "mcp-suite/marketnow-search", ...(opts.headers || {}) },
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
// ——— datos embebidos (carpeta data/) ———
function loadData(name) {
    const p = fileURLToPath(new URL("../data/" + name, import.meta.url));
    return JSON.parse(readFileSync(p, "utf8"));
}
const server = new McpServer({ name: "marketnow-search", version: "1.0.0" });
server.tool("search_skills", "Busca skills en el snapshot local (instantáneo, offline): filtra por texto (nombre/desc/tags), categoría, sentinel_score mínimo y precio. Devuelve hasta 20 resultados con install command y score.", {
    q: z.string().describe("Texto a buscar (nombre, descripción o tags)").optional(),
    categoria: z.string().describe("Categoría exacta (ej: Developer Tools, Security, AI/ML)").optional(),
    min_score: z.number().describe("Sentinel score mínimo (0-10)").default(7),
    solo_gratis: z.boolean().describe("Solo skills gratuitas").default(false),
    limite: z.number().describe("Máximo de resultados").default(10),
}, async (args) => {
    const { q, categoria, min_score, solo_gratis, limite } = args;
    const snap = loadData("skills-snapshot.json");
    let items = snap.skills;
    if (q) {
        const ql = q.toLowerCase();
        items = items.filter(s => (s.name + " " + s.description + " " + (s.tags || []).join(" ")).toLowerCase().includes(ql));
    }
    if (categoria)
        items = items.filter(s => s.category === categoria);
    items = items.filter(s => (s.sentinel_score || 0) >= (min_score ?? 7));
    if (solo_gratis)
        items = items.filter(s => (s.price ?? 0) === 0);
    items = items.slice(0, Math.min(limite ?? 10, 20));
    return ok({ total_snapshot: snap.snapshot_size, total_catalogo_real: snap.total_catalog, resultados: items.map(s => ({ id: s.id, name: s.name, score: s.sentinel_score, categoria: s.category, install: s.install, price: s.price, verified: s.verified, desc: s.description })) });
});
server.tool("get_skill", "Obtiene el detalle completo de una skill del snapshot local por id, slug o nombre: install, author, licencia, capacidades y source.", {
    identificador: z.string().describe("id, slug o name de la skill"),
}, async (args) => {
    const { identificador } = args;
    const snap = loadData("skills-snapshot.json");
    const key = identificador.toLowerCase();
    const s = snap.skills.find(x => (x.id || "").toLowerCase() === key || (x.slug || "").toLowerCase() === key || (x.name || "").toLowerCase() === key);
    if (!s)
        return fail("skill no encontrada en el snapshot local. Usa search_skills o search_live para el catálogo completo.");
    return ok(s);
});
server.tool("list_categories", "Lista las 16 categorías del catálogo de MarketNow con conteo real de skills por categoría (del snapshot + stats del catálogo completo).", {
// sin parámetros
}, async (args) => {
    const snap = loadData("skills-snapshot.json");
    return ok({ total_catalogo: snap.total_catalog, categorias: snap.categories.map(([name, count]) => ({ name, count })), nota: "Conteos del catálogo real (66.496 skills)" });
});
server.tool("search_live", "Búsqueda en vivo sobre el catálogo COMPLETO (66.496 skills): descarga ~94MB la primera vez, cachea 7 días en ~/.mcp-suite/ y luego filtra localmente. Úsalo cuando el snapshot no baste.", {
    q: z.string().describe("Texto a buscar"),
    min_score: z.number().describe("Sentinel score mínimo").default(0),
    limite: z.number().describe("Máximo resultados").default(20),
}, async (args) => {
    const { q, min_score, limite } = args;
    const CACHE_TTL = 7 * 24 * 3600 * 1000;
    const st = store.load();
    let catalogo = null;
    if (st.catalogo && Date.now() - st.catalogo_ts < CACHE_TTL) {
        catalogo = true;
    }
    else {
        const r = await fetchSmart("https://marketnow.site/api/skills.json", { timeoutMs: 180000, retries: 0 });
        if (!r.json || !Array.isArray(r.json))
            return fail("no se pudo descargar el catálogo completo (HTTP " + r.status + ")");
        st.catalogo_file = "descargado";
        st.catalogo_ts = Date.now();
        st.total = r.json.length;
        store.save(st);
        // guardamos el catálogo completo en un archivo aparte para no inflar state.json
        const { writeFileSync, mkdirSync, readFileSync, existsSync } = await import("node:fs");
        const { homedir } = await import("node:os");
        const { join } = await import("node:path");
        const dir = join(homedir(), ".mcp-suite", "marketnow-search");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "catalog.json"), r.text);
        catalogo = true;
    }
    const { readFileSync, existsSync } = await import("node:fs");
    const { homedir } = await import("node:os");
    const { join } = await import("node:path");
    const file = join(homedir(), ".mcp-suite", "marketnow-search", "catalog.json");
    if (!existsSync(file))
        return fail("catálogo cacheado no existe; reejecuta search_live");
    const all = JSON.parse(readFileSync(file, "utf8"));
    const ql = (q || "").toLowerCase();
    const res = all.filter(s => !ql || ((s.name || "") + " " + (s.description || "") + " " + (s.tags || []).join(" ")).toLowerCase().includes(ql))
        .filter(s => (s.sentinel_score ?? 0) >= (min_score ?? 0))
        .sort((a, b) => (b.sentinel_score ?? 0) - (a.sentinel_score ?? 0))
        .slice(0, Math.min(limite ?? 20, 50));
    return ok({ total_en_cache: all.length, resultados: res.map(s => ({ id: s.id, name: s.name, score: s.sentinel_score, categoria: s.category, install: s.install, price: s.price, desc: (s.description || "").slice(0, 150) })) });
});
server.tool("health_check", "Verifica que el servidor marketnow-search está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "marketnow-search", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[marketnow-search] fatal:", e);
    process.exit(1);
});

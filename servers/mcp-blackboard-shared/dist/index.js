#!/usr/bin/env node
/**
 * MCP Server: Blackboard Shared
 * Pizarra compartida con locks con TTL para coordinar agentes sin duplicar trabajo
 *
 * Dolor que resuelve: Varios agentes trabajando en paralelo pisan el mismo dato, duplican búsquedas costosas y se pisan entre ellos por ausencia de un espacio de coordinación compartido con exclusión.
 * Categoría: Multi-Agente y Coordinación | Generado por mcp-suite | id: blackboard-shared
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
// ——— persistencia local: ~/.mcp-suite/blackboard-shared/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "blackboard-shared");
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
const server = new McpServer({ name: "blackboard-shared", version: "1.0.0" });
server.tool("post", "Publica una entrada en la pizarra bajo una clave con etiquetas y visibilidad. Idempotente por versión.", {
    clave: z.string().describe("Clave de la entrada (ej: research/competidores)"),
    contenido: z.any().describe("Contenido (texto o JSON)"),
    autor: z.string().describe("Agent_id autor"),
    etiquetas: z.array(z.any()).describe("Etiquetas para búsqueda").default([]),
}, async (args) => {
    const { clave, contenido, autor, etiquetas } = args;
    const st = store.load();
    st.entradas = st.entradas || {};
    st.eventos = st.eventos || [];
    const e = st.entradas[clave];
    const nuevo = { clave, contenido, autor, etiquetas: etiquetas || [], version: e ? e.version + 1 : 1, actualizado: new Date().toISOString(), lecturas: e?.lecturas || 0 };
    st.entradas[clave] = nuevo;
    st.eventos.push({ tipo: "post", clave, autor, version: nuevo.version, ts: nuevo.actualizado });
    if (st.eventos.length > 2000)
        st.eventos = st.eventos.slice(-1000);
    store.save(st);
    return ok({ clave, version: nuevo.version, aviso: e && e.autor !== autor ? "OJO: sobrescribiste entrada de " + e.autor + " (versión " + (nuevo.version - 1) + ")" : "publicado" });
});
server.tool("read", "Lee entradas por clave exacta o etiqueta; registra lecturas (quién consumió qué).", {
    clave: z.string().describe("Clave exacta").optional(),
    etiqueta: z.string().describe("Buscar por etiqueta").optional(),
    lector: z.string().describe("Agent_id que lee").default("anon"),
}, async (args) => {
    const { clave, etiqueta, lector } = args;
    const st = store.load();
    const entradas = __vals(st.entradas || {});
    if (!clave && !etiqueta)
        return fail("indica clave o etiqueta");
    let hits = clave ? entradas.filter(e => e.clave === clave) : entradas.filter(e => (e.etiquetas || []).includes(etiqueta));
    if (!hits.length)
        return ok({ encontrados: 0, sugerencia: "públicalo primero con post (o busca otra etiqueta)" });
    for (const e of hits) {
        e.lecturas = (e.lecturas || 0) + 1;
    }
    st.lecturas = st.lecturas || [];
    for (const e of hits)
        st.lecturas.push({ clave: e.clave, lector, ts: new Date().toISOString() });
    store.save(st);
    return ok({ encontrados: hits.length, entradas: hits.map(e => ({ clave: e.clave, autor: e.autor, version: e.version, etiquetas: e.etiquetas, lecturas: e.lecturas, contenido: e.contenido })) });
});
server.tool("claim", "Reclama exclusividad sobre una clave por un agente con TTL (segundos). Devuelve conflicto si ya está reclamada.", {
    clave: z.string().describe("Clave a reclamar"),
    agente: z.string().describe("Agent_id que reclama"),
    ttl_segundos: z.number().describe("Vigencia del reclamo").default(600),
}, async (args) => {
    const { clave, agente, ttl_segundos } = args;
    const st = store.load();
    st.locks = st.locks || {};
    const ahora = Date.now();
    for (const [k, l] of __ents(st.locks))
        if (new Date(l.expira).getTime() < ahora)
            delete st.locks[k];
    const l = st.locks[clave];
    if (l && l.agente !== agente && new Date(l.expira).getTime() > ahora) {
        return ok({ reclamado: false, dueño: l.agente, expira: l.expira, segundos_restantes: Math.round((new Date(l.expira).getTime() - ahora) / 1000), consejo: "espera o lee el resultado con read cuando expire" });
    }
    const renuevo = l && l.agente === agente;
    st.locks[clave] = { agente, expira: new Date(ahora + ttl_segundos * 1000).toISOString(), desde: renuevo ? l.desde : new Date().toISOString() };
    store.save(st);
    return ok({ reclamado: true, clave, agente, expira: st.locks[clave].expira, renovado: renuevo });
});
server.tool("release", "Libera el reclamo de una clave (solo el dueño o un supervisor con forzar).", {
    clave: z.string().describe("Clave a liberar"),
    agente: z.string().describe("Agent_id que libera"),
    forzar: z.boolean().describe("Forzar aunque no sea dueño (supervisor)").default(false),
}, async (args) => {
    const { clave, agente, forzar } = args;
    const st = store.load();
    const l = (st.locks || {})[clave];
    if (!l)
        return ok({ liberado: false, razon: "no había lock" });
    if (l.agente !== agente && !forzar)
        return fail("la clave la tiene " + l.agente + " hasta " + l.expira + " (usa forzar=true si eres supervisor)");
    delete st.locks[clave];
    store.save(st);
    return ok({ liberado: true, clave, tenia: l.agente, forzado: l.agente !== agente });
});
server.tool("append", "Añade contenido a una entrada existente de forma atómica (para resultados acumulativos de varios agentes).", {
    clave: z.string().describe("Clave de la entrada"),
    contenido: z.any().describe("Contenido a añadir"),
    autor: z.string().describe("Agent_id que aporta"),
}, async (args) => {
    const { clave, contenido, autor } = args;
    const st = store.load();
    const e = (st.entradas || {})[clave];
    if (!e)
        return fail("entrada inexistente: publícala primero con post");
    e.contenido = Array.isArray(e.contenido) ? [...e.contenido, contenido] : { partes: [e.contenido, contenido] };
    e.version++;
    e.actualizado = new Date().toISOString();
    e.contribuyentes = [...new Set([...(e.contribuyentes || []), autor])];
    store.save(st);
    return ok({ clave, version: e.version, contribuyentes: e.contribuyentes });
});
server.tool("list_locks", "Locks activos con dueño y expiración; señala los próximos a caducar.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const ahora = Date.now();
    const vivos = __ents(st.locks || {}).filter(([, l]) => new Date(l.expira).getTime() > ahora);
    return ok({
        activos: vivos.length,
        locks: vivos.map(([clave, l]) => ({ clave, agente: l.agente, segundos_restantes: Math.round((new Date(l.expira).getTime() - ahora) / 1000) })).sort((a, b) => a.segundos_restantes - b.segundos_restantes),
        proximo_a_expirar: vivos.sort((a, b) => new Date(a[1].expira).getTime() - new Date(b[1].expira).getTime())[0]?.[0] || null,
    });
});
server.tool("board_stats", "Salud de la pizarra: entradas, conflictos de escritura evitados, duplicación de lectura y agentes más activos.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const entradas = __vals(st.entradas || {});
    const lecturas = st.lecturas || [];
    const lecturasPorEntrada = {};
    for (const r of lecturas)
        lecturasPorEntrada[r.clave] = (lecturasPorEntrada[r.clave] || 0) + 1;
    const topLeido = __ents(lecturasPorEntrada).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const autores = {};
    for (const e of entradas)
        autores[e.autor] = (autores[e.autor] || 0) + 1;
    const conflictos = (st.eventos || []).filter(ev => ev.tipo === "post" && ev.version > 1).length;
    return ok({
        entradas: entradas.length, eventos: (st.eventos || []).length,
        conflictos_escritura_versionados: conflictos,
        entradas_mas_leidas: topLeido.map(([k, v]) => ({ clave: k, lecturas: v })),
        ahorro_estimado: topLeido.reduce((s, [, v]) => s + (v - 1), 0) + " re-lecturas servidas desde pizarra",
        autores_mas_activos: __ents(autores).sort((a, b) => b[1] - a[1]).slice(0, 5),
    });
});
server.tool("purge", "Limpia entradas antiguas o locks muertos; devuelve espacio liberado.", {
    max_edad_dias: z.number().describe("Eliminar entradas más viejas que esto").default(30),
    solo_locks_muertos: z.boolean().describe("Solo purgar locks expirados").default(false),
}, async (args) => {
    const { max_edad_dias, solo_locks_muertos } = args;
    const st = store.load();
    const limite = Date.now() - max_edad_dias * 86400000;
    const antes = Object.keys(st.entradas || {}).length + Object.keys(st.locks || {}).length;
    const ahora = Date.now();
    for (const [k, l] of __ents(st.locks || {}))
        if (new Date(l.expira).getTime() < ahora)
            delete st.locks[k];
    if (!solo_locks_muertos)
        for (const [k, e] of __ents(st.entradas || {}))
            if (new Date(e.actualizado).getTime() < limite)
                delete st.entradas[k];
    store.save(st);
    return ok({ eliminados: antes - (Object.keys(st.entradas || {}).length + Object.keys(st.locks || {}).length), quedan_entradas: Object.keys(st.entradas || {}).length, quedan_locks: Object.keys(st.locks || {}).length });
});
server.tool("health_check", "Verifica que el servidor blackboard-shared está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "blackboard-shared", tools: 9, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[blackboard-shared] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: Side-Effect Ledger
 * Libro mayor de efectos secundarios: cada cambio queda registrado con su receta de deshacer
 *
 * Dolor que resuelve: El agente hizo 14 cambios y solo recuerda 3: cuando hay que volver atrás no existe un registro de qué tocó ni cómo se deshace cada cosa. Los 'action logs' genéricos guardan qué pasó, no cómo revertirlo.
 * Categoría: Pre-Vuelo | Generado por mcp-suite | id: side-effect-ledger
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
// ——— persistencia local: ~/.mcp-suite/side-effect-ledger/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "side-effect-ledger");
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
const server = new McpServer({ name: "side-effect-ledger", version: "1.0.0" });
server.tool("register_effect", "Registra un efecto secundario con su receta de reversión. Úsalo INMEDIATAMENTE después de cada acción con impacto.", {
    target: z.string().describe("Recurso afectado (archivo, registro, cuenta, estado)"),
    tipo: z.enum(["creado", "modificado", "eliminado", "estado_cambiado", "externo_enviado", "permiso_otorgado"]).describe("Tipo de efecto"),
    como_deshacer: z.string().describe("Receta concreta para revertir (comando, API, secuencia)"),
    paso: z.string().describe("Paso/acción del agente que lo causó").optional(),
    caducidad_horas: z.number().describe("Horas tras las que la receta de deshacer deja de ser válida (0 = nunca)").default(0),
    dificultad: z.enum(["trivial", "media", "dificil", "imposible"]).describe("Dificultad de reversión").default("media"),
}, async (args) => {
    const { target, tipo, como_deshacer, paso, caducidad_horas, dificultad } = args;
    const st = store.load();
    st.efectos = st.efectos || [];
    const id = "fx_" + String(st.efectos.length + 1).padStart(4, "0");
    st.efectos.push({ id, target, tipo, como_deshacer, paso: paso || "", dificultad, caducidad_horas, creado: new Date().toISOString(), deshecho: false });
    store.save(st);
    return ok({ id, target, tipo, dificultad, registrado: true, abiertos: st.efectos.filter(e => !e.deshecho).length });
});
server.tool("undo_info", "Recupera la receta de deshacer para un target (o por id de efecto).", {
    target: z.string().describe("Recurso a revertir").optional(),
    id: z.string().describe("Id del efecto exacto").optional(),
}, async (args) => {
    const { target, id } = args;
    const st = store.load();
    const efectos = st.efectos || [];
    let e = id ? efectos.find(x => x.id === id) : null;
    if (!e && target) {
        const cands = efectos.filter(x => !x.deshecho && x.target.includes(target));
        if (!cands.length)
            return fail("sin efectos abiertos para: " + target);
        e = cands[cands.length - 1];
    }
    if (!e)
        return fail("indica target o id");
    if (e.deshecho)
        return ok({ id: e.id, aviso: "ya está deshecho", deshecho_en: e.deshecho_ts });
    const vence = e.caducidad_horas > 0 ? new Date(new Date(e.creado).getTime() + e.caducidad_horas * 3600000).toISOString() : null;
    const expirado = vence && new Date(vence).getTime() < Date.now();
    return ok({ id: e.id, target: e.target, tipo: e.tipo, dificultad: e.dificultad, receta_deshacer: e.como_deshacer, creado: e.creado, vence_en: vence, receta_expirada: expirado, aviso: expirado ? "LA RECETA EXPIRÓ: revertir manualmente con conocimiento del dominio" : e.dificultad === "imposible" ? "IRREVERSIBLE declarado: solo queda compensación, no reversión" : "receta válida" });
});
server.tool("mark_undone", "Marca un efecto como deshecho (con nota de verificación).", {
    id: z.string().describe("Id del efecto (fx_0001)"),
    verificado_por: z.string().describe("Cómo se verificó que quedó revertido").optional(),
}, async (args) => {
    const { id, verificado_por } = args;
    const st = store.load();
    const e = (st.efectos || []).find(x => x.id === id);
    if (!e)
        return fail("efecto no encontrado: " + id);
    if (e.deshecho)
        return fail("ya estaba deshecho desde " + e.deshecho_ts);
    e.deshecho = true;
    e.deshecho_ts = new Date().toISOString();
    e.verificado_por = verificado_por || "no verificado";
    store.save(st);
    return ok({ id, target: e.target, deshecho: true, abiertos: st.efectos.filter(x => !x.deshecho).length });
});
server.tool("list_open_effects", "Todos los efectos sin deshacer, agrupados por dificultad y con los más urgentes primero.", {
    solo_tipo: z.string().describe("Filtrar por tipo").optional(),
}, async (args) => {
    const { solo_tipo } = args;
    const st = store.load();
    let abiertos = (st.efectos || []).filter(e => !e.deshecho);
    if (solo_tipo)
        abiertos = abiertos.filter(e => e.tipo === solo_tipo);
    const orden = { imposible: 0, dificil: 1, media: 2, trivial: 3 };
    const vencidos = abiertos.filter(e => e.caducidad_horas > 0 && new Date(new Date(e.creado).getTime() + e.caducidad_horas * 3600000).getTime() < Date.now());
    return ok({ abiertos: abiertos.length, por_dificultad: { imposible: abiertos.filter(e => e.dificultad === "imposible").length, dificil: abiertos.filter(e => e.dificultad === "dificil").length, media: abiertos.filter(e => e.dificultad === "media").length, trivial: abiertos.filter(e => e.dificultad === "trivial").length }, recetas_expiradas: vencidos.length, efectos: abiertos.sort((a, b) => (orden[a.dificultad] ?? 2) - (orden[b.dificultad] ?? 2)).map(e => ({ id: e.id, target: e.target, tipo: e.tipo, dificultad: e.dificultad, creado: e.creado, paso: e.paso })) });
});
server.tool("rollback_plan", "Genera el plan de reversión total: deshacer todos los efectos abiertos en orden inverso (LIFO).", {
    desde_id: z.string().describe("Revertir desde este efecto (inclusive) hacia atrás").optional(),
}, async (args) => {
    const { desde_id } = args;
    const st = store.load();
    const abiertos = (st.efectos || []).filter(e => !e.deshecho);
    if (!abiertos.length)
        return ok({ pasos: 0, mensaje: "no hay efectos abiertos: nada que revertir" });
    let secuencia = abiertos.slice().reverse();
    if (desde_id) {
        const idx = secuencia.findIndex(e => e.id === desde_id);
        if (idx === -1)
            return fail("efecto no encontrado o ya deshecho: " + desde_id);
        secuencia = secuencia.slice(idx);
    }
    const pasos = secuencia.map((e, i) => ({ orden: i + 1, id: e.id, target: e.target, receta: e.como_deshacer, dificultad: e.dificultad, alerta: e.dificultad === "imposible" ? "IRREVERSIBLE: este paso no tiene reversión, evalúa compensación" : e.caducidad_horas > 0 ? "verifica que la receta no haya expirado" : null }));
    return ok({ total_pasos: pasos.length, estrategia: "LIFO: deshacer en orden inverso a como se aplicaron", pasos, estimacion: pasos.filter(p => p.alerta).length + " pasos con alerta de " + pasos.length });
});
server.tool("health_check", "Verifica que el servidor side-effect-ledger está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "side-effect-ledger", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[side-effect-ledger] fatal:", e);
    process.exit(1);
});

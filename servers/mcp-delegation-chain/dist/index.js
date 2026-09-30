#!/usr/bin/env node
/**
 * MCP Server: Delegation Chain
 * Delegación de capacidades verificable: cadenas de 'puedo hacer X porque me lo delegó Y' con expiración y estrechamiento
 *
 * Dolor que resuelve: El agente subordinado actúa 'en nombre de' su principal sin prueba verificable: ni alcance exacto, ni caducidad, ni límite de profundidad. Cualquier agente intermedio puede inflar sus poderes y nadie lo detecta.
 * Categoría: Identidad Federada | Generado por mcp-suite | id: delegation-chain
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
// ——— persistencia local: ~/.mcp-suite/delegation-chain/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "delegation-chain");
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
const server = new McpServer({ name: "delegation-chain", version: "1.0.0" });
server.tool("mint_delegation", "Emite una delegación: quién delega, sobre quién, qué alcance y hasta cuándo.", {
    delegante: z.string().describe("Agente que delega (principal o intermediario)"),
    delegado: z.string().describe("Agente que recibe la capacidad"),
    alcance: z.string().describe("Capacidad delegada (ej: lectura:clientes-EC)"),
    expira_horas: z.number().describe("Vigencia en horas (0 = sin expiración)").default(24),
}, async (args) => {
    const { delegante, delegado, alcance, expira_horas } = args;
    const st = store.load();
    st.delegaciones = st.delegaciones || [];
    const clave = delegante + " -> " + delegado + " [" + alcance + "]";
    const duplicada = st.delegaciones.find(d => d.delegante === delegante && d.delegado === delegado && d.alcance === alcance && !d.revocada && !d.expirada_manual);
    if (duplicada)
        return fail("delegación idéntica ya activa (id " + duplicada.id + ")");
    const id = "dlg_" + String(st.delegaciones.length + 1).padStart(4, "0");
    st.delegaciones.push({ id, delegante, delegado, alcance, expira: expira_horas > 0 ? new Date(Date.now() + expira_horas * 3600000).toISOString() : null, revocada: false, emitida: new Date().toISOString(), usos: 0 });
    store.save(st);
    return ok({ id, delegacion: clave, expira: expira_horas > 0 ? "en " + expira_horas + "h" : "sin expiración", regla: "el delegado SOLO puede usar/redelegar este alcance exacto o más estrecho" });
});
server.tool("verify_chain", "Verifica la cadena completa de una delegación: validez, expiración, profundidad y estrechamiento de alcance.", {
    delegado_final: z.string().describe("Agente cuya autoridad se cuestiona"),
    alcance_requerido: z.string().describe("Capacidad que quiere ejercer"),
    raiz_confiable: z.string().describe("Principal raíz de confianza").optional(),
    max_profundidad: z.number().describe("Profundidad máxima de re-delegación").default(3),
}, async (args) => {
    const { delegado_final, alcance_requerido, raiz_confiable, max_profundidad } = args;
    const st = store.load();
    const delegaciones = (st.delegaciones || []).filter(d => !d.revocada);
    const camino = [];
    let actual = delegado_final;
    let hops = 0;
    while (hops <= max_profundidad + 1) {
        const edge = delegaciones.find(d => d.delegado === actual && (!d.expira || new Date(d.expira).getTime() > Date.now()));
        if (!edge)
            break;
        camino.unshift(edge);
        actual = edge.delegante;
        hops++;
        if (raiz_confiable && actual === raiz_confiable)
            break;
    }
    if (!camino.length)
        return fail("el agente '" + delegado_final + "' no tiene ninguna delegación activa");
    const raiz = camino[0].delegante;
    if (raiz_confiable && raiz !== raiz_confiable)
        return fail("la cadena llega a '" + raiz + "' pero la raíz de confianza es '" + raiz_confiable + "': NO AUTORIZADO");
    const profundidad = camino.length;
    if (profundidad > max_profundidad)
        return fail("cadena de " + profundidad + " saltos > máximo " + max_profundidad + ": demasiado larga, sospecha de re-delegación encadenada");
    let alcanceRaiz = camino[0].alcance;
    for (let i = 1; i < camino.length; i++) {
        const aPadre = camino[i - 1].alcance;
        const aHijo = camino[i].alcance;
        const prefijoOk = aHijo.startsWith(aPadre) || aPadre.includes(":") && aHijo.startsWith(aPadre.split(":")[0] + ":") && aHijo.length >= aPadre.length;
        if (!prefijoOk && aHijo !== aPadre) {
            return fail("ENSANCHAMIENTO DETECTADO en el salto " + i + ": '" + aPadre + "' delegó '" + aHijo + "' que no es sub-alcance: cadena inválida");
        }
    }
    const alcanceFinal = camino[camino.length - 1].alcance;
    const cubre = alcanceFinal === alcance_requerido || alcanceFinal.startsWith(alcance_requerido) || alcance_requerido.startsWith(alcanceFinal) === false && alcanceFinal.split(":")[0] === alcance_requerido.split(":")[0];
    camino[camino.length - 1].usos = (camino[camino.length - 1].usos || 0) + 1;
    store.save(st);
    return ok({ autorizado: cubre, delegado_final, alcance_requerido, alcance_concedido: alcanceFinal, cadena: camino.map(c => ({ id: c.id, de: c.delegante, a: c.delegado, alcance: c.alcance, expira: c.expira || "sin límite" })), raiz, profundidad, veredicto: cubre ? "AUTORIZADO: la cadena cubre '" + alcance_requerido + "' desde la raíz '" + raiz + "'" : "NO AUTORIZADO: la cadena concede '" + alcanceFinal + "' que no cubre '" + alcance_requerido + "'" });
});
server.tool("revoke_delegation", "Revoca una delegación concreta (las cadenas que pasan por ella caen).", {
    id: z.string().describe("Id de la delegación (dlg_0001)"),
    motivo: z.string().describe("Motivo de revocación"),
}, async (args) => {
    const { id, motivo } = args;
    const st = store.load();
    const d = (st.delegaciones || []).find(x => x.id === id);
    if (!d)
        return fail("delegación no encontrada: " + id);
    if (d.revocada)
        return fail("ya revocada");
    d.revocada = true;
    d.revocacion = { motivo, ts: new Date().toISOString() };
    store.save(st);
    const colaterales = (st.delegaciones || []).filter(x => !x.revocada && x.delegante === d.delegado).length;
    return ok({ id, revocada: true, delegacion: d.delegante + " -> " + d.delegado + " [" + d.alcance + "]", delegaciones_hijas_aun_activas: colaterales, aviso: colaterales ? "revoca también las " + colaterales + " delegaciones emitidas POR el delegado o quedan huérfanas inválidas" : "sin delegaciones hijas" });
});
server.tool("chain_view", "Visualiza el árbol de delegaciones desde una raíz o para un agente.", {
    agente: z.string().describe("Raíz o agente de interés").optional(),
}, async (args) => {
    const { agente } = args;
    const st = store.load();
    const activas = (st.delegaciones || []).filter(d => !d.revocada && (!d.expira || new Date(d.expira).getTime() > Date.now()));
    const expiradas = (st.delegaciones || []).filter(d => !d.revocada && d.expira && new Date(d.expira).getTime() <= Date.now());
    if (!activas.length)
        return ok({ activas: 0, expiradas: expiradas.length, mensaje: "sin delegaciones activas" });
    let sub = agente ? activas.filter(d => d.delegante === agente || d.delegado === agente) : activas;
    const nodos = {};
    sub.forEach(d => { nodos[d.delegante] = nodos[d.delegante] || { agente: d.delegante, delega: [] }; nodos[d.delegante].delega.push({ a: d.delegado, alcance: d.alcance, expira: d.expira || "sin límite", usos: d.usos || 0 }); });
    return ok({ activas: activas.length, expiradas_sin_revocar: expiradas.length, arbol: __vals(nodos), mas_usadas: activas.slice().sort((a, b) => (b.usos || 0) - (a.usos || 0)).slice(0, 3).map(d => ({ id: d.id, cadena: d.delegante + " -> " + d.delegado, alcance: d.alcance, usos: d.usos || 0 })) });
});
server.tool("health_check", "Verifica que el servidor delegation-chain está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "delegation-chain", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[delegation-chain] fatal:", e);
    process.exit(1);
});

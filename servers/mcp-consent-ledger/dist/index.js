#!/usr/bin/env node
/**
 * MCP Server: Consent Ledger
 * Libro mayor de consentimientos con propósito: cada uso de datos personales amparado por un consentimiento vivo
 *
 * Dolor que resuelve: El agente usa datos personales sin saber si el titular consintió ese uso: no hay ledger de consentimientos con propósito, vigencia y alcance, así que el 'sí dijo que sí' es imaginario.
 * Categoría: Cumplimiento | Generado por mcp-suite | id: consent-ledger
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
// ——— persistencia local: ~/.mcp-suite/consent-ledger/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "consent-ledger");
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
const server = new McpServer({ name: "consent-ledger", version: "1.0.0" });
server.tool("record_consent", "Registra un consentimiento: titular, propósitos autorizados, vigencia y base legal.", {
    titular: z.string().describe("Identificador del titular (anonimizado)"),
    propositos: z.array(z.any()).describe("Propósitos autorizados (analitica, soporte, marketing...)"),
    vigencia_meses: z.number().describe("Vigencia del consentimiento").default(12),
    base_legal: z.string().describe("Base legal (consentimiento, contrato...)").default("consentimiento"),
}, async (args) => {
    const { titular, propositos, vigencia_meses, base_legal } = args;
    const st = store.load();
    st.consentimientos = st.consentimientos || [];
    const c = {
        id: "cs_" + Date.now().toString(36),
        titular, propositos: (propositos || []).map(String), base_legal,
        vigente_hasta: new Date(Date.now() + (vigencia_meses ?? 12) * 2592000000).toISOString(),
        revocado: null, creado: new Date().toISOString(),
    };
    st.consentimientos.push(c);
    store.save(st);
    return ok({ consentimiento_id: c.id, titular, propositos: c.propositos.length, vigente_hasta: c.vigente_hasta.slice(0, 10) });
});
server.tool("verify_use", "Verifica que un uso de datos concreto está amparado: titular + propósito dentro de la vigencia.", {
    titular: z.string().describe("Titular de los datos"),
    proposito: z.string().describe("Propósito del uso previsto"),
}, async (args) => {
    const { titular, proposito } = args;
    const st = store.load();
    const cs = (st.consentimientos || []).filter(c => c.titular === titular);
    if (!cs.length)
        return ok({ amparado: false, razon: "sin consentimiento registrado para este titular", accion: "NO uses los datos: solicita consentimiento o anonimiza" });
    const ahora = Date.now();
    const activos = cs.filter(c => !c.revocado && new Date(c.vigente_hasta).getTime() > ahora);
    if (!activos.length)
        return ok({ amparado: false, razon: "consentimientos vencidos o revocados", accion: "NO uses los datos" });
    const conProposito = activos.find(c => c.propositos.some(p => p.toLowerCase() === String(proposito).toLowerCase()));
    if (!conProposito)
        return ok({
            amparado: false,
            razon: "consentimiento activo pero SIN el propósito '" + proposito + "' (autorizados: " + activos[0].propositos.join(", ") + ")",
            accion: "NO amplíes propósito sin nuevo consentimiento (purpose limitation)",
        });
    st.usos = st.usos || [];
    st.usos.push({ titular, proposito, consentimiento: conProposito.id, amparado: true, ts: new Date().toISOString() });
    store.save(st);
    return ok({ amparado: true, consentimiento: conProposito.id, vigente_hasta: conProposito.vigente_hasta.slice(0, 10), nota: "uso legítimo registrado en auditoría" });
});
server.tool("revoke", "Revoca el consentimiento de un titular (total o de un propósito concreto).", {
    titular: z.string().describe("Titular"),
    proposito: z.string().describe("Solo revocar este propósito (vacío = todo)").optional(),
}, async (args) => {
    const { titular, proposito } = args;
    const st = store.load();
    const cs = (st.consentimientos || []).filter(c => c.titular === titular);
    if (!cs.length)
        return fail("sin consentimientos para este titular");
    let afectados = 0;
    for (const c of cs) {
        if (!proposito) {
            c.revocado = { total: true, ts: new Date().toISOString() };
            afectados++;
        }
        else {
            c.revocado = c.revocado || { propositos: [] };
            c.revocado.propositos = [...new Set([...(c.revocado.propositos || []), proposito])];
            c.propositos = c.propositos.filter(p => p !== proposito);
            afectados++;
        }
    }
    store.save(st);
    return ok({ titular, revocado: true, afectados, obligacion: "todo uso posterior de este dato en el alcance revocado queda PROHIBIDO desde ya" });
});
server.tool("consent_audit", "Auditoría de usos: cada uso de datos con su consentimiento amparador y usos fuera de amparo.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const usos = st.usos || [];
    const cs = st.consentimientos || [];
    const revocados = cs.filter(c => c.revocado).length;
    return ok({
        consentimientos: cs.length, revocados,
        usos_registrados: usos.length,
        usos_amparados: usos.filter(u => u.amparado).length,
        titulares_cubiertos: new Set(cs.map(c => c.titular)).size,
        vencen_en_30_dias: cs.filter(c => !c.revocado && new Date(c.vigente_hasta).getTime() - Date.now() < 30 * 86400000).map(c => ({ titular: c.titular, hasta: c.vigente_hasta.slice(0, 10) })),
        accion: "contacta a los titulares con consentimiento por vencer si el uso sigue siendo necesario",
    });
});
server.tool("health_check", "Verifica que el servidor consent-ledger está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "consent-ledger", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[consent-ledger] fatal:", e);
    process.exit(1);
});

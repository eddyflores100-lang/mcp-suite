#!/usr/bin/env node
/**
 * MCP Server: Consent Manager
 * Consentimientos RGPD-style: qué datos puede procesar el agente y para qué
 *
 * Dolor que resuelve: El agente procesa datos personales sin registro de consentimiento: pesadilla de compliance (RGPD/LGPD).
 * Categoría: Seguridad | Generado por mcp-suite | id: consent-manager
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
// ——— persistencia local: ~/.mcp-suite/consent-manager/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "consent-manager");
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
const server = new McpServer({ name: "consent-manager", version: "1.0.0" });
server.tool("grant", "Registra un consentimiento: sujeto, propósitos autorizados, datos involucrados y vigencia.", {
    sujeto: z.string().describe("Identificador del sujeto"),
    propositos: z.array(z.any()).describe("Propósitos autorizados"),
    datos: z.array(z.any()).describe("Categorías de datos (contacto, perfil...)"),
    meses: z.number().describe("Vigencia en meses").default(12),
}, async (args) => {
    const { sujeto, propositos, datos, meses } = args;
    const st = store.load();
    st.consentimientos = st.consentimientos || {};
    st.consentimientos[sujeto] = { propositos: Array.isArray(propositos) ? propositos : [], datos: Array.isArray(datos) ? datos : [], concedido: new Date().toISOString(), expira: new Date(Date.now() + (meses ?? 12) * 30 * 86400000).toISOString() };
    store.save(st);
    return ok({ sujeto, expira: st.consentimientos[sujeto].expira });
});
server.tool("check", "Verifica si un procesamiento (sujeto + propósito + categoría de dato) está consentido y vigente.", {
    sujeto: z.string().describe("Sujeto"),
    proposito: z.string().describe("Propósito del procesamiento"),
    dato: z.string().describe("Categoría de dato"),
}, async (args) => {
    const { sujeto, proposito, dato } = args;
    const st = store.load();
    const c = st.consentimientos?.[sujeto];
    if (!c)
        return ok({ consentido: false, razon: "sin consentimiento registrado" });
    if (new Date(c.expira) < new Date())
        return ok({ consentido: false, razon: "consentimiento expirado" });
    const okProp = c.propositos.includes(proposito);
    const okDato = c.datos.includes(dato);
    return ok({ consentido: okProp && okDato, razon: okProp && okDato ? "vigente" : "fuera de alcance (" + (!okProp ? "propósito" : "dato") + ")", propositos_autorizados: c.propositos, datos_autorizados: c.datos });
});
server.tool("revoke", "Revoca el consentimiento de un sujeto (todo procesamiento futuro queda bloqueado).", {
    sujeto: z.string().describe("Sujeto"),
}, async (args) => {
    const { sujeto } = args;
    const st = store.load();
    if (st.consentimientos?.[sujeto]) {
        st.consentimientos[sujeto].revocado = new Date().toISOString();
        st.consentimientos[sujeto].expira = new Date().toISOString();
        store.save(st);
    }
    return ok({ sujeto, revocado: true });
});
server.tool("health_check", "Verifica que el servidor consent-manager está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "consent-manager", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[consent-manager] fatal:", e);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MCP Server: AP2 Mandates
 * Mandatos delegados AP2: permisos explícitos, revocables y human-in-the-loop
 *
 * Dolor que resuelve: Un agente compra/actúa en nombre de un humano sin mandato auditable: faltan permisos delegados firmados, con límites y revocación.
 * Categoría: MarketNow Trust | Generado por mcp-suite | id: ap2-mandates
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes, generateKeyPairSync, sign, createPrivateKey } from "node:crypto";
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
// ——— persistencia local: ~/.mcp-suite/ap2-mandates/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "ap2-mandates");
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
const server = new McpServer({ name: "ap2-mandates", version: "1.0.0" });
server.tool("create_mandate", "Crea un mandato AP2: qué puede hacer el agente (scopes), límites (monto, usos, vigencia en horas) y aprobación humana obligatoria por defecto.", {
    principal: z.string().describe("Identidad del humano que delega"),
    agent: z.string().describe("Identidad del agente delegado"),
    scopes: z.array(z.any()).describe("Permisos (ej: ['skill:install', 'payment:free'])"),
    monto_max: z.number().describe("Monto máximo por operación (0 = solo gratis)").default(0),
    max_usos: z.number().describe("Usos máximos antes de expirar").default(10),
    horas: z.number().describe("Vigencia en horas").default(48),
    modo_silencioso: z.boolean().describe("Permitir sin notificar al principal (default false)").default(false),
}, async (args) => {
    const { principal, agent, scopes, monto_max, max_usos, horas, modo_silencioso } = args;
    const st = store.load();
    st.mandates = st.mandates || [];
    if (!st.keys) {
        const kp = generateKeyPairSync("ed25519");
        st.keys = { public: kp.publicKey.export({ type: "spki", format: "pem" }), private: kp.privateKey.export({ type: "pkcs8", format: "pem" }) };
    }
    const id = "mand-" + randomBytes(6).toString("hex");
    const m = {
        mandate_id: id, protocol: "AP2", principal, agent,
        scopes: Array.isArray(scopes) ? scopes : [],
        limites: { monto_max: monto_max ?? 0, usos_restantes: max_usos ?? 10 },
        emitido: new Date().toISOString(),
        expira: new Date(Date.now() + (horas ?? 48) * 3600000).toISOString(),
        human_in_loop: modo_silencioso === true ? false : true,
        revocado: false, usos: 0,
    };
    const firmable = JSON.stringify({ ...m, usos: 0, revocado: false });
    m.firma = sign(null, Buffer.from(firmable, "utf8"), createPrivateKey(st.keys.private)).toString("base64");
    m.verificacion = st.keys.public;
    st.mandates.push(m);
    store.save(st);
    return ok({ mandato: m, aviso: m.human_in_loop ? "notificará al principal en cada uso" : "modo silencioso: el principal NO será notificado" });
});
server.tool("check_mandate", "Verifica si una acción está cubierta por un mandato vigente: scope presente, usos disponibles, monto dentro de límite, no revocado.", {
    mandate_id: z.string().describe("ID del mandato"),
    accion: z.string().describe("Accion a realizar (ej: skill:install)"),
    monto: z.number().describe("Monto de la operación").default(0),
}, async (args) => {
    const { mandate_id, accion, monto } = args;
    const st = store.load();
    const m = (st.mandates || []).find((x) => x.mandate_id === mandate_id);
    if (!m)
        return fail("mandato no encontrado");
    const motivos = [];
    if (m.revocado)
        motivos.push("revocado");
    if (new Date(m.expira) < new Date())
        motivos.push("expirado");
    if (m.limites.usos_restantes <= 0)
        motivos.push("sin usos restantes");
    if (!m.scopes.includes(accion))
        motivos.push("scope no autorizado: " + accion);
    if ((monto ?? 0) > m.limites.monto_max)
        motivos.push("monto excede límite " + m.limites.monto_max);
    return ok({ permitido: motivos.length === 0, motivos, mandato: { id: m.mandate_id, scopes: m.scopes, usos_restantes: m.limites.usos_restantes, expira: m.expira, human_in_loop: m.human_in_loop } });
});
server.tool("consume_mandate", "Registra un uso del mandato (decrementa usos, notifica al principal si human_in_loop) y devuelve el uso restante.", {
    mandate_id: z.string().describe("ID del mandato"),
    detalle: z.string().describe("Descripción del uso").optional(),
}, async (args) => {
    const { mandate_id, detalle } = args;
    const st = store.load();
    const m = (st.mandates || []).find((x) => x.mandate_id === mandate_id);
    if (!m)
        return fail("mandato no encontrado");
    if (m.limites.usos_restantes <= 0)
        return fail("mandato agotado");
    m.limites.usos_restantes--;
    m.usos = (m.usos || 0) + 1;
    st.notificaciones = st.notificaciones || [];
    if (m.human_in_loop)
        st.notificaciones.push({ ts: new Date().toISOString(), mandate_id, detalle: detalle || "uso", para: m.principal });
    store.save(st);
    return ok({ consumido: true, usos_restantes: m.limites.usos_restantes, notificado_principal: m.human_in_loop });
});
server.tool("revoke_mandate", "Revoca un mandato inmediatamente (aplicable a usos futuros).", {
    mandate_id: z.string().describe("ID del mandato a revocar"),
}, async (args) => {
    const { mandate_id } = args;
    const st = store.load();
    const m = (st.mandates || []).find((x) => x.mandate_id === mandate_id);
    if (!m)
        return fail("mandato no encontrado");
    m.revocado = true;
    store.save(st);
    return ok({ revocado: true, mandate_id });
});
server.tool("health_check", "Verifica que el servidor ap2-mandates está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "ap2-mandates", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[ap2-mandates] fatal:", e);
    process.exit(1);
});

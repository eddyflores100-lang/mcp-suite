#!/usr/bin/env node
/**
 * MCP Server: Agent Passport
 * Pasaporte portable del agente: identidad, capacidades declaradas, sellos de entrada/salida y verificación de integridad
 *
 * Dolor que resuelve: Cuando un agente llega a otra orquestación no hay forma portable de presentarse: quién eres, qué sabes hacer, dónde has estado, quién te avala. Cada sistema vuelve a preguntarlo todo y nada es verificable.
 * Categoría: Identidad Federada | Generado por mcp-suite | id: agent-passport
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
// ——— persistencia local: ~/.mcp-suite/agent-passport/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "agent-passport");
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
const server = new McpServer({ name: "agent-passport", version: "1.0.0" });
server.tool("create_passport", "Emite un pasaporte para un agente con identidad y vigencia.", {
    agente: z.string().describe("Identidad del agente (did o nombre único)"),
    emisor: z.string().describe("Quién emite el pasaporte (organización raíz)"),
    vigencia_dias: z.number().describe("Días de validez").default(365),
}, async (args) => {
    const { agente, emisor, vigencia_dias } = args;
    const st = store.load();
    st.pasaportes = st.pasaportes || [];
    const duplicado = st.pasaportes.find(p => p.agente === agente && !p.anulado);
    if (duplicado)
        return fail("ya existe pasaporte activo para " + agente + " (" + duplicado.numero + "): anúlalo primero");
    const numero = "P-" + String(st.pasaportes.length + 1).padStart(5, "0");
    st.pasaportes.push({ numero, agente, emisor, emitido: new Date().toISOString(), vence: new Date(Date.now() + vigencia_dias * 86400000).toISOString(), claims: [], sellos: [], anulado: false, checksum: null });
    const p = st.pasaportes[st.pasaportes.length - 1];
    const crypto = await import("node:crypto");
    p.checksum = crypto.createHash("sha256").update(JSON.stringify({ a: p.agente, e: p.emisor, c: p.claims, s: p.sellos, v: p.vence })).digest("hex").slice(0, 32);
    store.save(st);
    return ok({ numero, agente, emisor, vence: p.vence, checksum: p.checksum, siguiente: "añade capacidades con add_claim" });
});
server.tool("add_claim", "Añade una capacidad o mérito al pasaporte (con nivel demostrado, no auto-declarado).", {
    numero: z.string().describe("Número de pasaporte (P-00001)"),
    claim: z.string().describe("Capacidad (ej: navegacion-web-segura)"),
    nivel: z.enum(["declarado", "probado", "certificado"]).describe("Nivel demostrado"),
    evidencia: z.string().describe("Evidencia o fuente del nivel").optional(),
}, async (args) => {
    const { numero, claim, nivel, evidencia } = args;
    const st = store.load();
    const p = (st.pasaportes || []).find(x => x.numero === numero);
    if (!p)
        return fail("pasaporte no encontrado: " + numero);
    if (p.anulado)
        return fail("pasaporte anulado: no admite claims");
    const yaTiene = p.claims.find(c => c.claim === claim);
    if (yaTiene) {
        const orden = { declarado: 0, probado: 1, certificado: 2 };
        if (orden[nivel] <= orden[yaTiene.nivel])
            return fail("ya tiene '" + claim + "' en nivel " + yaTiene.nivel + ": solo se puede elevar");
        yaTiene.nivel = nivel;
        yaTiene.evidencia = evidencia || yaTiene.evidencia;
        yaTiene.actualizado = new Date().toISOString();
    }
    else {
        p.claims.push({ claim, nivel, evidencia: evidencia || "", desde: new Date().toISOString() });
    }
    const crypto = await import("node:crypto");
    p.checksum = crypto.createHash("sha256").update(JSON.stringify({ a: p.agente, e: p.emisor, c: p.claims, s: p.sellos, v: p.vence })).digest("hex").slice(0, 32);
    store.save(st);
    return ok({ numero, claims_totales: p.claims.length, claim, nivel, checksum_actualizado: p.checksum });
});
server.tool("stamp", "Sella una entrada/salida: dónde operó el agente, cuándo y con qué resultado.", {
    numero: z.string().describe("Pasaporte"),
    sistema: z.string().describe("Sistema/orquestación visitada"),
    tipo: z.enum(["entrada", "salida", "evento"]).describe("Tipo de sello"),
    resultado: z.string().describe("Resultado de la visita (ok, con incidente, expulsado)").default("ok"),
}, async (args) => {
    const { numero, sistema, tipo, resultado } = args;
    const st = store.load();
    const p = (st.pasaportes || []).find(x => x.numero === numero);
    if (!p)
        return fail("pasaporte no encontrado");
    p.sellos.push({ sistema, tipo, resultado, ts: new Date().toISOString() });
    const crypto = await import("node:crypto");
    p.checksum = crypto.createHash("sha256").update(JSON.stringify({ a: p.agente, e: p.emisor, c: p.claims, s: p.sellos, v: p.vence })).digest("hex").slice(0, 32);
    store.save(st);
    const incidentes = p.sellos.filter(s => s.resultado !== "ok").length;
    return ok({ numero, sello: tipo + " @ " + sistema, sellos_totales: p.sellos.length, incidentes, aviso: incidentes > 2 ? "3+ incidentes registrados: este pasaporte empezará a ser rechazado en sistemas estrictos" : null });
});
server.tool("verify_passport", "Verifica un pasaporte: integridad (checksum), vigencia y nivel de confianza según claims e incidentes.", {
    numero: z.string().describe("Pasaporte a verificar"),
}, async (args) => {
    const { numero } = args;
    const st = store.load();
    const p = (st.pasaportes || []).find(x => x.numero === numero);
    if (!p)
        return fail("pasaporte inexistente: " + numero);
    if (p.anulado)
        return ok({ valido: false, razon: "ANULADO por el emisor: " + (p.motivo_anulacion || "sin motivo") });
    const crypto = await import("node:crypto");
    const esperado = crypto.createHash("sha256").update(JSON.stringify({ a: p.agente, e: p.emisor, c: p.claims, s: p.sellos, v: p.vence })).digest("hex").slice(0, 32);
    const integro = esperado === p.checksum;
    const vigente = new Date(p.vence).getTime() > Date.now();
    const incidentes = p.sellos.filter(s => s.resultado !== "ok").length;
    const certificados = p.claims.filter(c => c.nivel === "certificado").length;
    const probados = p.claims.filter(c => c.nivel === "probado").length;
    const confianza = integro && vigente ? incidentes === 0 && certificados >= 2 ? "ALTA" : incidentes <= 1 && (certificados + probados) >= 2 ? "MEDIA" : "BAJA (claims mayormente declarados o con incidentes)" : "NULA";
    return ok({ numero, agente: p.agente, emisor: p.emisor, integridad: integro ? "integro (checksum coincide)" : "MANIPULADO: el contenido no coincide con el checksum emitido", vigente, vence: p.vence, claims: p.claims.length, sellos: p.sellos.length, incidentes, nivel_confianza: confianza, veredicto: integro && vigente && confianza !== "BAJA (claims mayormente declarados o con incidentes)" ? "ACEPTA: pasaporte verificable y con solvencia" : "RECHAZA o exige refuerzo: " + (integro ? "" : "manipulado ") + (vigente ? "" : "vencido ") + confianza });
});
server.tool("annul_passport", "Anula un pasaporte (robo, desmantelamiento del agente, fraude).", {
    numero: z.string().describe("Pasaporte"),
    motivo: z.string().describe("Motivo de anulación"),
}, async (args) => {
    const { numero, motivo } = args;
    const st = store.load();
    const p = (st.pasaportes || []).find(x => x.numero === numero);
    if (!p)
        return fail("pasaporte no encontrado");
    if (p.anulado)
        return fail("ya anulado");
    p.anulado = true;
    p.motivo_anulacion = motivo;
    p.anulado_ts = new Date().toISOString();
    store.save(st);
    return ok({ numero, anulado: true, motivo, efecto: "toda verificación futura lo rechaza; notifica a los sistemas que lo aceptaron" });
});
server.tool("health_check", "Verifica que el servidor agent-passport está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "agent-passport", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[agent-passport] fatal:", e);
    process.exit(1);
});

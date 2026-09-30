#!/usr/bin/env node
/**
 * MCP Server: Webhook Inspector
 * Inspecciona webhooks entrantes: parse, verificación HMAC y log de eventos
 *
 * Dolor que resuelve: Los webhooks llegan y nadie sabe si son legítimos ni qué trajeron: falta inspección y verificación de firma.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: webhook-inspector
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
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
// ——— persistencia local: ~/.mcp-suite/webhook-inspector/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "webhook-inspector");
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
const server = new McpServer({ name: "webhook-inspector", version: "1.0.0" });
server.tool("inspect", "Inspecciona un webhook: headers normalizados, parsea el body (JSON) y detecta el proveedor por firma típica.", {
    headers: z.any().describe("Headers HTTP recibidos"),
    body: z.string().describe("Body crudo"),
}, async (args) => {
    const { headers, body } = args;
    let parsed = null;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        parsed = null;
    }
    const h = headers || {};
    const proveedores = [["stripe", "stripe-signature"], ["github", "x-hub-signature-256"], ["slack", "x-slack-signature"], ["shopify", "x-shopify-hmac-sha256"], ["generic", "x-signature"]];
    const detectado = proveedores.find(([, header]) => Object.keys(h).some((k) => k.toLowerCase() === header))?.[0] || "desconocido";
    const st = store.load();
    st.eventos = st.eventos || [];
    st.eventos.push({ ts: new Date().toISOString(), proveedor: detectado, tipo: parsed?.type || parsed?.event || null, keys: parsed ? Object.keys(parsed) : [] });
    if (st.eventos.length > 300)
        st.eventos = st.eventos.slice(-300);
    store.save(st);
    return ok({ proveedor_detectado: detectado, body_parseado: parsed, headers_clave: Object.keys(h).filter((k) => k.toLowerCase().includes("sign") || k.toLowerCase().includes("hmac")) });
});
server.tool("verify_hmac", "Verifica la firma HMAC-SHA256 de un webhook dado el secreto compartido y la firma recibida.", {
    body: z.string().describe("Body crudo"),
    secreto: z.string().describe("Secreto compartido"),
    firma_recibida: z.string().describe("Firma (hex o base64)"),
}, async (args) => {
    const { body, secreto, firma_recibida } = args;
    const esperada = createHmac("sha256", secreto).update(body).digest("hex");
    const recibida = String(firma_recibida).replace(/^sha256=/, "").trim();
    const b64 = createHmac("sha256", secreto).update(body).digest("base64");
    const valida = esperada === recibida || b64 === recibida;
    return ok({ valida, esperada_prefix: esperada.slice(0, 12) + "...", recibida_prefix: recibida.slice(0, 12) + "..." });
});
server.tool("recent_events", "Últimos webhooks inspeccionados (proveedor, tipo, timestamp).", {
    limite: z.number().describe("Máx eventos").default(20),
}, async (args) => {
    const { limite } = args;
    const st = store.load();
    return ok({ eventos: (st.eventos || []).slice(-(limite ?? 20)).reverse() });
});
server.tool("health_check", "Verifica que el servidor webhook-inspector está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "webhook-inspector", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[webhook-inspector] fatal:", e);
    process.exit(1);
});
